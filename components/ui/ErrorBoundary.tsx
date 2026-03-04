import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="p-4 bg-red-950/30 rounded-full mb-4">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-2">
            {this.props.fallbackMessage || 'Something went wrong'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-md font-mono">
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded border border-slate-700 text-xs hover:bg-slate-700"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
