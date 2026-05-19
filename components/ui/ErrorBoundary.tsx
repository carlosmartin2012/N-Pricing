import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { errorTracker } from '../../utils/errorTracking';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    errorTracker.captureException(error, {
      module: 'ErrorBoundary',
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="p-4 bg-red-950/30 rounded-full mb-4">
            <AlertTriangle size={32} className="text-[color:var(--nfq-danger)]" />
          </div>
          <h3 className="text-lg font-bold text-[color:var(--nfq-text-secondary)] mb-2">
            {this.props.fallbackMessage || 'Something went wrong'}
          </h3>
          <p className="text-xs text-[color:var(--nfq-text-faint)] mb-4 max-w-md font-mono">
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-secondary)] rounded border border-slate-700 text-xs hover:bg-[var(--nfq-bg-highest)]"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
