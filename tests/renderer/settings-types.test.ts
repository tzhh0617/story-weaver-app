import { describe, expect, it } from 'vitest';
import Settings from '../../renderer/pages/Settings';
import type { ModelSavePayload } from '@story-weaver/shared/contracts';

type SettingsProps = Parameters<typeof Settings>[0];

function assertSettingsModelPayloadTypes(props: SettingsProps) {
  const saveModel: SettingsProps['onSaveModel'] = (input) => {
    const payload: ModelSavePayload = input;
    payload.provider satisfies 'openai' | 'anthropic';
  };
  const testModel: SettingsProps['onTestModel'] = (input) => {
    const payload: ModelSavePayload = input;
    payload.provider satisfies 'openai' | 'anthropic';
  };

  saveModel({
    id: 'openai:gpt-4o-mini',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    apiKey: 'sk-test',
    baseUrl: '',
    config: {},
  });
  testModel({
    id: 'anthropic:claude-3-5-sonnet',
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet',
    apiKey: 'sk-test',
    baseUrl: '',
    config: {},
  });

  saveModel({
    id: 'custom:model',
    // @ts-expect-error unsupported providers must be rejected before App.
    provider: 'custom',
    modelName: 'model',
    apiKey: 'sk-test',
    baseUrl: '',
    config: {},
  });

  void props;
}

void assertSettingsModelPayloadTypes;

describe('settings model payload types', () => {
  it('keeps model form callbacks aligned with shared model payloads', () => {
    expect(true).toBe(true);
  });
});
