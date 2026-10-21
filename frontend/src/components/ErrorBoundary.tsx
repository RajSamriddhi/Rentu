import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Rentu application:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas px-4 font-sans text-ink">
          <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-8 shadow-card text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-brand/10 text-brand rounded-2xl flex items-center justify-center text-3xl">
              ⚡
            </div>
            <h1 className="text-2xl font-black font-display text-ink mb-2">
              Something went slightly off
            </h1>
            <p className="text-sm text-ink-secondary mb-6">
              Rentu⁺ encountered a temporary glitch while loading gear. Click below to refresh the page.
            </p>
            <div className="bg-canvas-subtle p-3 rounded-xl mb-6 text-left overflow-x-auto text-xs font-mono text-ink-muted">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('borrowflex_token');
                window.location.reload();
              }}
              className="w-full py-3.5 px-6 bg-brand hover:bg-brand-hover text-white font-bold rounded-2xl shadow-glow transition-all active:scale-[0.98] cursor-pointer"
            >
              Refresh Application 🔄
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
