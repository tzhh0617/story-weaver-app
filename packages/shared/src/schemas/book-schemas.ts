import { z } from 'zod';

export const ViralTropeContractSchema = z.enum([
  'rebirth_change_fate',
  'system_growth',
  'hidden_identity',
  'revenge_payback',
  'weak_to_strong',
  'forbidden_bond',
  'case_breaking',
  'sect_or_family_pressure',
  'survival_game',
  'business_or_power_game',
]);

export const ViralStrategySchema = z.object({
  readerPayoff: z.string().optional(),
  protagonistDesire: z.string().optional(),
  tropeContracts: z.array(ViralTropeContractSchema).optional(),
  cadenceMode: z.enum(['fast', 'steady', 'slow_burn', 'suppressed_then_burst']).optional(),
  antiClicheDirection: z.string().optional(),
}).optional();

export const BookCreateSchema = z.object({
  idea: z.string(),
  targetChapters: z.number().int().positive(),
  wordsPerChapter: z.number().int().positive(),
  viralStrategy: ViralStrategySchema,
});

export const BookExportRequestSchema = z.object({
  format: z.enum(['txt', 'md']),
});

export type BookCreateInput = z.infer<typeof BookCreateSchema>;
export type BookExportRequestInput = z.infer<typeof BookExportRequestSchema>;
