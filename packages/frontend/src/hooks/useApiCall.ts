import { useCallback, useRef } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: '资源未找到',
  VALIDATION_ERROR: '输入有误',
  NO_MODEL_CONFIGURED: '未配置模型，请先在设置中添加模型',
  GENERATION_ERROR: '生成失败',
  CONFLICT: '操作冲突',
  INTERNAL_ERROR: '服务器内部错误',
};

type ToastFn = (tone: 'error' | 'success' | 'info', message: string) => void;

export function useApiCall(toast: ToastFn) {
  const toastRef = useRef(toast);
  toastRef.current = toast;

  return useCallback(async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const appError = error as Error & { code: string };
        toastRef.current('error', ERROR_MESSAGES[appError.code] ?? appError.message);
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        toastRef.current('error', '网络连接失败');
      } else if (error instanceof Error) {
        toastRef.current('error', error.message || '操作失败，请重试');
      } else {
        toastRef.current('error', '操作失败，请重试');
      }
      return undefined;
    }
  }, []);
}
