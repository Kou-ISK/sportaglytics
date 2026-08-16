#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';

const MATCH_TOLERANCE_SECONDS = 5;
const PRECISE_TOLERANCE_SECONDS = 2;
const QUALITY_GATE = {
  minPrecision: 0.95,
  minRecall: 0.9,
  minEvaluatedMatches: 5,
  minPredictionDistanceFromCodedIntervalWithinTwoSecondsRate: 0.9,
};

const usage = () => {
  console.error(
    'Usage: node scripts/evaluate-event-detection.mjs <ground-truth.json> <predictions.json> <thresholds.json>',
  );
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
};

const isFiniteNonNegative = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const validateGroundTruth = (data) => {
  if (!data || !Array.isArray(data.matches)) {
    throw new Error('Ground truth must contain matches[].');
  }
  const matchIds = new Set();
  for (const match of data.matches) {
    if (!match || typeof match.matchId !== 'string' || !Array.isArray(match.events)) {
      throw new Error('Each ground-truth match requires matchId and events[].');
    }
    if (matchIds.has(match.matchId)) {
      throw new Error(`Duplicate ground-truth matchId: ${match.matchId}`);
    }
    matchIds.add(match.matchId);
    for (const event of match.events) {
      if (
        !event ||
        typeof event.eventType !== 'string' ||
        !isFiniteNonNegative(event.anchorTime) ||
        (event.endTime !== undefined &&
          (!isFiniteNonNegative(event.endTime) || event.endTime < event.anchorTime))
      ) {
        throw new Error(`Invalid ground-truth event in ${match.matchId}.`);
      }
    }
  }

  if (Array.isArray(data.trainingMatchIds)) {
    const overlap = data.trainingMatchIds.filter((matchId) => matchIds.has(matchId));
    if (overlap.length > 0) {
      throw new Error(
        `Evaluation leakage: test matches also appear in trainingMatchIds: ${overlap.join(', ')}`,
      );
    }
  }
};

const validatePredictions = (data) => {
  if (!data || !Array.isArray(data.matches)) {
    throw new Error('Predictions must contain matches[].');
  }
  for (const match of data.matches) {
    if (!match || typeof match.matchId !== 'string' || !Array.isArray(match.events)) {
      throw new Error('Each prediction match requires matchId and events[].');
    }
    for (const event of match.events) {
      if (
        !event ||
        typeof event.eventType !== 'string' ||
        !isFiniteNonNegative(event.anchorTime) ||
        typeof event.confidence !== 'number' ||
        !Number.isFinite(event.confidence) ||
        event.confidence < 0 ||
        event.confidence > 1
      ) {
        throw new Error(`Invalid prediction event in ${match.matchId}.`);
      }
    }
  }
};

const validateThresholds = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Thresholds must be an object keyed by event type.');
  }
  for (const [eventType, threshold] of Object.entries(data)) {
    if (
      typeof threshold !== 'number' ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 1
    ) {
      throw new Error(`Invalid confidence threshold for ${eventType}.`);
    }
  }
};

const groupEvents = (matches, eventType, includePredictionConfidence) => {
  const byMatch = new Map();
  for (const match of matches) {
    const events = match.events
      .filter((event) => event.eventType === eventType)
      .map((event) =>
        includePredictionConfidence
          ? { anchorTime: event.anchorTime, confidence: event.confidence }
          : {
              anchorTime: event.anchorTime,
              endTime:
                isFiniteNonNegative(event.endTime) && event.endTime >= event.anchorTime
                  ? event.endTime
                  : event.anchorTime,
            },
      );
    byMatch.set(match.matchId, events);
  }
  return byMatch;
};

const distanceToCodedInterval = (predictionTime, truth) => {
  if (predictionTime < truth.anchorTime) return truth.anchorTime - predictionTime;
  if (predictionTime > truth.endTime) return predictionTime - truth.endTime;
  return 0;
};

const evaluateEventType = ({
  eventType,
  threshold,
  groundTruthMatches,
  predictionMatches,
}) => {
  const groundTruthByMatch = groupEvents(groundTruthMatches, eventType, false);
  const predictionsByMatch = groupEvents(predictionMatches, eventType, true);
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let withinTwoSeconds = 0;
  let withinInterval = 0;
  const absoluteErrors = [];

  for (const [matchId, truthEvents] of groundTruthByMatch.entries()) {
    const predictions = (predictionsByMatch.get(matchId) ?? [])
      .filter((prediction) => prediction.confidence >= threshold)
      .sort((left, right) => right.confidence - left.confidence);
    const unmatchedTruth = truthEvents.map((event, index) => ({ ...event, index }));

    for (const prediction of predictions) {
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      unmatchedTruth.forEach((truth, index) => {
        const distance = distanceToCodedInterval(prediction.anchorTime, truth);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      if (nearestIndex >= 0 && nearestDistance <= MATCH_TOLERANCE_SECONDS) {
        truePositive += 1;
        absoluteErrors.push(nearestDistance);
        if (nearestDistance <= PRECISE_TOLERANCE_SECONDS) {
          withinTwoSeconds += 1;
        }
        if (nearestDistance === 0) {
          withinInterval += 1;
        }
        unmatchedTruth.splice(nearestIndex, 1);
      } else {
        falsePositive += 1;
      }
    }
    falseNegative += unmatchedTruth.length;
  }

  for (const [matchId, predictions] of predictionsByMatch.entries()) {
    if (groundTruthByMatch.has(matchId)) continue;
    falsePositive += predictions.filter(
      (prediction) => prediction.confidence >= threshold,
    ).length;
  }

  const precision =
    truePositive + falsePositive > 0
      ? truePositive / (truePositive + falsePositive)
      : 0;
  const recall =
    truePositive + falseNegative > 0
      ? truePositive / (truePositive + falseNegative)
      : 0;
  const timestampWithinTwoSecondsRate =
    truePositive > 0 ? withinTwoSeconds / truePositive : 0;
  const withinAnnotatedIntervalRate =
    truePositive > 0 ? withinInterval / truePositive : 0;
  const meanAbsoluteErrorSeconds =
    absoluteErrors.length > 0
      ? absoluteErrors.reduce((sum, value) => sum + value, 0) /
        absoluteErrors.length
      : null;
  const evaluatedMatches = groundTruthMatches.length;
  const passesGate =
    precision >= QUALITY_GATE.minPrecision &&
    recall >= QUALITY_GATE.minRecall &&
    evaluatedMatches >= QUALITY_GATE.minEvaluatedMatches &&
    timestampWithinTwoSecondsRate >=
      QUALITY_GATE.minPredictionDistanceFromCodedIntervalWithinTwoSecondsRate;

  return {
    eventType,
    confidenceThreshold: threshold,
    precision,
    recall,
    evaluatedMatches,
    timestampWithinTwoSecondsRate,
    withinAnnotatedIntervalRate,
    meanAbsoluteErrorSeconds,
    truePositive,
    falsePositive,
    falseNegative,
    passesGate,
  };
};

const main = async () => {
  const [, , groundTruthPath, predictionsPath, thresholdsPath] = process.argv;
  if (!groundTruthPath || !predictionsPath || !thresholdsPath) {
    usage();
    process.exitCode = 2;
    return;
  }

  const [groundTruth, predictions, thresholds] = await Promise.all([
    readJson(groundTruthPath),
    readJson(predictionsPath),
    readJson(thresholdsPath),
  ]);
  validateGroundTruth(groundTruth);
  validatePredictions(predictions);
  validateThresholds(thresholds);

  const results = Object.entries(thresholds).map(([eventType, threshold]) =>
    evaluateEventType({
      eventType,
      threshold,
      groundTruthMatches: groundTruth.matches,
      predictionMatches: predictions.matches,
    }),
  );

  const output = {
    datasetId: groundTruth.datasetId ?? null,
    matchToleranceSeconds: MATCH_TOLERANCE_SECONDS,
    preciseToleranceSeconds: PRECISE_TOLERANCE_SECONDS,
    timingSemantics:
      'Prediction timing is measured to the nearest coded interval boundary; predictions inside a coded interval have zero timing error.',
    qualityGate: QUALITY_GATE,
    allEventsPass: results.length > 0 && results.every((result) => result.passesGate),
    metrics: Object.fromEntries(
      results.map((result) => [
        result.eventType,
        {
          precision: result.precision,
          recall: result.recall,
          evaluatedMatches: result.evaluatedMatches,
          confidenceThreshold: result.confidenceThreshold,
          timestampWithinTwoSecondsRate: result.timestampWithinTwoSecondsRate,
          withinAnnotatedIntervalRate: result.withinAnnotatedIntervalRate,
        },
      ]),
    ),
    details: results,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.allEventsPass) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});