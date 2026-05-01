import { z } from 'zod';

export const SettingUpdateSchema = z.object({
  value: z.string(),
});

export type SettingUpdateInput = z.infer<typeof SettingUpdateSchema>;
