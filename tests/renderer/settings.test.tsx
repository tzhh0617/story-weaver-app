import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Settings from '../../renderer/pages/Settings';

describe('Settings', () => {
  it('submits model settings and global settings', () => {
    const onSaveModel = vi.fn();
    const onTestModel = vi.fn();
    const onSaveSetting = vi.fn();

    render(
      <Settings
        onSaveModel={onSaveModel}
        onTestModel={onTestModel}
        models={[]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={onSaveSetting}
      />
    );
    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'openai' },
    });
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
    });
  });

  it('tests the current model settings', () => {
    const onSaveModel = vi.fn();
    const onTestModel = vi.fn();
    const onSaveSetting = vi.fn();

    render(
      <Settings
        onSaveModel={onSaveModel}
        onTestModel={onTestModel}
        models={[]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={onSaveSetting}
      />
    );

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'anthropic' },
    });
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

  it('deletes a saved model from the model list', () => {
    const onDeleteModel = vi.fn();

    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'openai:gpt-4o-mini',
            modelName: 'gpt-4o-mini',
            provider: 'openai',
          },
        ]}
        onDeleteModel={onDeleteModel}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('删除模型'));

    expect(onDeleteModel).toHaveBeenCalledWith('openai:gpt-4o-mini');
  });

  it('loads a saved model into the form when selected from the list', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'deepseek:deepseek-chat',
            modelName: 'deepseek-chat',
            provider: 'deepseek',
          },
        ]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('deepseek-chat · deepseek'));

    expect(screen.getByLabelText('Provider')).toHaveValue('deepseek');
    expect(screen.getByLabelText('Model Name')).toHaveValue('deepseek-chat');
    expect(screen.getByText('编辑模型')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'deepseek-chat · deepseek' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('已保存模型列表')).toBeInTheDocument();
  });

  it('clears the form after deleting the selected saved model', () => {
    const { rerender } = render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'deepseek:deepseek-chat',
            modelName: 'deepseek-chat',
            provider: 'deepseek',
            apiKey: 'sk-old',
            baseUrl: 'https://api.deepseek.com',
            config: {},
          },
        ]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('deepseek-chat · deepseek'));
    rerender(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Provider')).toHaveValue('openai');
    expect(screen.getByLabelText('Model Name')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
  });

  it('returns the form to new-model mode when clearing the current selection', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[
          {
            id: 'deepseek:deepseek-chat',
            modelName: 'deepseek-chat',
            provider: 'deepseek',
            apiKey: 'sk-old',
            baseUrl: 'https://api.deepseek.com',
            config: {},
          },
        ]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('deepseek-chat · deepseek'));
    fireEvent.click(screen.getByText('新建模型'));

    expect(screen.getByLabelText('Provider')).toHaveValue('openai');
    expect(screen.getByLabelText('Model Name')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('Base URL')).toHaveValue('');
  });

  it('disables save and test until required model fields are complete', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        onDeleteModel={vi.fn()}
        concurrencyLimit={null}
        onSaveSetting={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '保存模型' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByLabelText('Model Name'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test' },
    });

    expect(screen.getByRole('button', { name: '保存模型' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'deepseek' },
    });

    expect(screen.getByRole('button', { name: '保存模型' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://api.deepseek.com' },
    });

    expect(screen.getByRole('button', { name: '保存模型' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled();
  });

  it('disables saving global settings when the value is unchanged or invalid', () => {
    render(
      <Settings
        onSaveModel={vi.fn()}
        onTestModel={vi.fn()}
        models={[]}
        onDeleteModel={vi.fn()}
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
