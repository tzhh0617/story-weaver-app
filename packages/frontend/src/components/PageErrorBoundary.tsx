import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onToast: (tone: 'error', message: string) => void;
};

type State = {
  hasError: boolean;
  message: string;
};

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || '页面加载失败' };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onToast('error', this.state.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{this.state.message}</p>
          <button
            className="mt-2 text-sm underline"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
