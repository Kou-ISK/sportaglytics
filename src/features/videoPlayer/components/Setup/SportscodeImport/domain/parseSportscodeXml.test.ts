// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/synthetic-edit-list.xml?raw';
import { parseSportscodeXml } from './parseSportscodeXml';

describe('official Sportscode XML edit-list subset', () => {
  it('preserves decimal seconds, group identity, notes, empty rows, color and order', () => {
    const parsed = parseSportscodeXml(fixture, 1.125);
    expect(parsed.document.rows.map((row) => [row.name, row.color])).toEqual([
      ['Falcon 守備', '#0000ff'],
      ['Coral 攻撃', '#ff8000'],
      ['空行', '#00ff00'],
    ]);
    expect(parsed.document.instances[0]).toEqual({
      id: 'sportscode-1',
      actionName: 'Coral 攻撃',
      startTime: 5.375,
      endTime: 9.875,
      labels: [
        { group: '位置', name: '中央' },
        { group: '方向', name: '中央' },
        { name: '日本語 🙂 & <確認>' },
      ],
      memo: '架空の場面。#50% & 長いノート。\n2行目。',
    });
    expect(parsed.document.instances[1].memo).toBe('');
    expect(parsed.sessionStart).toBe('2026-01-02 10:00:00.00 +0000');
    expect(parsed.warnings).toContain(
      'SESSION_INFOの開始日時は自動補正しません。選んだ映像との秒数補正を確認してください。',
    );
    expect(parseSportscodeXml(fixture, 0)).toEqual(
      parseSportscodeXml(fixture, 0),
    );
  });
  it.each([
    ['malformed', fixture.replace('</file>', '')],
    [
      'wrong root',
      fixture
        .replaceAll('<file>', '<timeline>')
        .replaceAll('</file>', '</timeline>'),
    ],
    ['future version', fixture.replace('<file>', '<file version="99">')],
    ['namespace', fixture.replace('<file>', '<file xmlns="urn:future">')],
    [
      'external entity',
      '<!DOCTYPE file [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + fixture,
    ],
    ['duplicate ID', fixture.replace('<ID>2</ID>', '<ID>01</ID>')],
    ['missing ID', fixture.replace('<ID>1</ID>', '')],
    [
      'duplicate time',
      fixture.replace(
        '<start>4.25</start>',
        '<start>4.25</start><start>5</start>',
      ),
    ],
    ['negative', fixture.replace('<start>4.25</start>', '<start>-1</start>')],
    ['reversed', fixture.replace('<end>8.75</end>', '<end>1</end>')],
    [
      'not numeric',
      fixture.replace('<start>4.25</start>', '<start>NaN</start>'),
    ],
    ['invalid color', fixture.replace('<R>65535</R>', '<R>65536</R>')],
    ['missing color channel', fixture.replace('<G>32768</G>', '')],
    [
      'duplicate label group',
      fixture.replace(
        '<group>位置</group>',
        '<group>位置</group><group>方向</group>',
      ),
    ],
    [
      'duplicate section',
      fixture.replace('</file>', '<ALL_INSTANCES/></file>'),
    ],
  ])('rejects %s instead of partially importing', (_case, xml) => {
    expect(() => parseSportscodeXml(xml, 0)).toThrow();
  });
  it('does not clamp negative offset or infer a timestamp offset', () => {
    expect(() => parseSportscodeXml(fixture, -5)).toThrow();
    expect(() => parseSportscodeXml(fixture, Number.NaN)).toThrow();
    expect(parseSportscodeXml(fixture, 0).document.instances[0].startTime).toBe(
      4.25,
    );
  });
  it('reports unsupported data and synthesizes only a missing code row', () => {
    const xml = fixture
      .replace(
        '<free_text></free_text>',
        '<free_text></free_text><drawing>unsupported</drawing>',
      )
      .replace(
        '<code>Falcon 守備</code><R>0</R><G>0</G><B>65535</B>',
        '<code>別の空行</code><R>0</R><G>0</G><B>65535</B>',
      );
    const parsed = parseSportscodeXml(xml, 0);
    expect(parsed.warnings).toContain(
      '未対応の項目 drawing は読み込みません。',
    );
    expect(parsed.document.rows.map((row) => row.name)).toContain(
      'Falcon 守備',
    );
    expect(new Set(parsed.document.rows.map((row) => row.id)).size).toBe(
      parsed.document.rows.length,
    );
  });
});
