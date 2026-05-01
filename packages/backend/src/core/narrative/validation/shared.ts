import type { ValidationResult } from '../types.js';

export const characterRoleTypes = new Set([
  'protagonist',
  'deuteragonist',
  'supporting',
  'antagonist',
  'minor',
]);
export const arcDirections = new Set(['growth', 'fall', 'corruption', 'recovery', 'flat']);
export const worldRuleCategories = new Set([
  'power',
  'society',
  'resource',
  'taboo',
  'law',
  'daily_life',
  'history',
]);
export const narrativeThreadTypes = new Set([
  'main',
  'subplot',
  'relationship',
  'mystery',
  'theme',
  'antagonist',
  'world',
]);
export const narrativeThreadStates = new Set([
  'open',
  'advanced',
  'twisted',
  'paid_off',
  'abandoned',
]);
export const threadImportanceValues = new Set(['critical', 'normal', 'minor']);
export const payoffChangeTargets = new Set([
  'plot',
  'relationship',
  'world',
  'character',
  'theme',
]);
export const readerRewards = new Set([
  'reversal',
  'breakthrough',
  'failure',
  'truth',
  'upgrade',
  'confession',
  'dread',
  'relief',
]);
export const tensionPressureLevels = new Set(['low', 'medium', 'high', 'peak']);
export const dominantTensions = new Set([
  'danger',
  'desire',
  'relationship',
  'mystery',
  'moral_choice',
  'deadline',
  'status_loss',
  'resource_cost',
]);

export function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

export function result(issues: string[]): ValidationResult {
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function collectDuplicateIds(
  items: Array<{ id: string }>,
  label: string
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (isBlank(item.id)) {
      issues.push(`${label} id must not be blank.`);
      continue;
    }
    if (seen.has(item.id)) {
      issues.push(`${label} id ${item.id} must not be duplicated.`);
    }
    seen.add(item.id);
  }

  return issues;
}
