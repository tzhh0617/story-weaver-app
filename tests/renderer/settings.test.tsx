import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Settings from '../../renderer/pages/Settings';

async function selectProvider(value: string) {
  fireEvent.change(screen.getByLabelText('Provider'), {
    target: { value },
  });
}

describe('Settings', () => {
  it('renders the settings title inside the shared intro panel', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByTestId('settings-intro-panel').className).toContain(
      'rounded-[1.35rem]'
    );
    expect(screen.getByText('Studio Settings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
  });

  it('only offers openai and anthropic model providers', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    const providerOptions = Array.from(
      screen.getByLabelText('Provider').querySelectorAll('option')
    ).map((option) => option.value);

    expect(providerOptions).toEqual(['openai', 'anthropic']);
  });

  it('arranges setting blocks in a waterfall list', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    const settingsList = screen.getByRole('list', { name: '设置项' });
    const settingBlocks = screen.getAllByRole('listitem');

    expect(settingsList).toHaveClass('columns-1');
    expect(settingsList).toHaveClass('xl:columns-2');
    expect(settingBlocks).toHaveLength(2);
    expect(settingBlocks[0]).toHaveTextContent('模型设置');
    expect(settingBlocks[1]).toHaveTextContent('写作设置');
    expect(settingBlocks[0]).toHaveClass('break-inside-avoid');
    expect(settingBlocks[1]).toHaveClass('break-inside-avoid');
  });

  it('uses the shared layout card shell for each settings block', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    for (const block of screen.getAllByRole('listitem')) {
      expect(block.className).toContain('rounded-[1.35rem]');
      expect(block.className).toContain('ring-1');
      expect(block.className).not.toContain('hover:shadow');
    }
  });

  it('submits model settings and global settings', async () => {
    const onSaveModel = vi.fn();
    const onTestModel = vi.fn();
    const onSaveSetting = vi.fn();

    render(
      <Settings
        onSaveModel={onSaveModel}
        onTestModel={onTestModel}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={onSaveSetting}
      />
    );
    await selectProvider('openai');
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.change(screen.getByLabelText('并发上限'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByText('保存模型'));
    fireEvent.click(screen.getByText('保存设置'));

    expect(onSaveModel).toHaveBeenCalledWith({
      id: 'openai:gpt-4o-mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'sk-test',
      baseUrl: '',
      config: {},
    });
    expect(onSaveSetting).toHaveBeenCalledWith({
      concurrencyLimit: 2,
      shortChapterReviewEnabled: true,
    });
  });

  it('saves the short-chapter automatic review toggle', () => {
    const onSaveSetting = vi.fn();

    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        shortChapterReviewEnabled={false}
        onSaveSetting={onSaveSetting}
      />
    );

    fireEvent.click(screen.getByLabelText('短章节自动审查重做'));
    fireEvent.click(screen.getByText('保存设置'));

    expect(onSaveSetting).toHaveBeenCalledWith({
      concurrencyLimit: null,
      shortChapterReviewEnabled: true,
    });
  });

  it('tests the current model settings', async () => {
    const onSaveModel = vi.fn();
    const onTestModel = vi.fn();
    const onSaveSetting = vi.fn();

    render(
      <Settings
        onSaveModel={onSaveModel}
        onTestModel={onTestModel}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={onSaveSetting}
      />
    );

    await selectProvider('anthropic');
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'claude-3-5-sonnet' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(screen.getByText('测试连接'));

    expect(onTestModel).toHaveBeenCalledWith({
      id: 'anthropic:claude-3-5-sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet',
      apiKey: 'sk-test',
      baseUrl: '',
      config: {},
    });
  });

  it('loads a supported saved model directly into the single model form', async () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'anthropic:claude-3-5-sonnet',
            modelName: 'claude-3-5-sonnet',
            provider: 'anthropic',
          },
        ]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveTextContent(
      'anthropic'
    );
    expect(screen.getByLabelText('Model Name')).toHaveValue('claude-3-5-sonnet');
    expect(screen.getByText('模型设置')).toBeInTheDocument();
    expect(screen.queryByText('已保存模型')).toBeNull();
    expect(screen.queryByText('删除模型')).toBeNull();
    expect(screen.queryByText('新建模型')).toBeNull();
  });

  it('keeps the saved provider when updating the single model form', () => {
    const onSaveModel = vi.fn();

    render(
      <Settings
        onSaveModel={onSaveModel}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'anthropic:claude-3-5-sonnet',
            modelName: 'claude-3-5-sonnet',
            provider: 'anthropic',
            apiKey: 'sk-old',
            baseUrl: '',
            config: {},
          },
        ]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-new' },
    });
    fireEvent.click(screen.getByText('保存模型'));

    expect(onSaveModel).toHaveBeenCalledWith({
      id: 'anthropic:claude-3-5-sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet',
      apiKey: 'sk-new',
      baseUrl: '',
      config: {},
    });
  });

  it('clears the single model form when no saved model exists', async () => {
    const { rerender } = render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'anthropic:claude-3-5-sonnet',
            modelName: 'claude-3-5-sonnet',
            provider: 'anthropic',
            apiKey: 'sk-old',
            baseUrl: '',
            config: {},
          },
        ]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    rerender(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Provider' })).toHaveTextContent(
      'openai'
    );
    expect(screen.getByLabelText('Model Name')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
  });

  it('disables save and test until required model fields are complete', async () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '保存模型' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeDisabled();

    await selectProvider('openai');
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });

    expect(screen.getByRole('button', { name: '保存模型' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled();

    await selectProvider('anthropic');

    expect(screen.getByRole('button', { name: '保存模型' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled();
  });

  it('disables saving global settings when the value is unchanged or invalid', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        concurrencyLimit={1}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '保存设置' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('并发上限'), {
      target: { value: '0' },
    });
    expect(screen.getByRole('button', { name: '保存设置' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('并发上限'), {
      target: { value: '2' },
    });
    expect(screen.getByRole('button', { name: '保存设置' })).toBeEnabled();
  });
});
