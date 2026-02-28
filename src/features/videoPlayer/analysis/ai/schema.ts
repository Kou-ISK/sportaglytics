import { z } from 'zod';

export const aiResponseSchema = z.object({
  summary: z.string().min(1),
  hypotheses: z.array(
    z.object({
      text: z.string().min(1),
      evidenceIds: z.array(z.string().min(1)).min(1),
    }),
  ),
  evidenceHighlights: z.array(
    z.object({
      id: z.string().min(1),
      why: z.string().min(1),
    }),
  ),
  recommendedClips: z.array(
    z.object({
      title: z.string().min(1),
      centerId: z.string().min(1),
      preSeconds: z.number().nonnegative(),
      postSeconds: z.number().nonnegative(),
      reason: z.string().min(1),
      evidenceIds: z.array(z.string().min(1)).min(1),
    }),
  ),
});

export type AiResponseSchema = z.infer<typeof aiResponseSchema>;
