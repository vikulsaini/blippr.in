import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-error-container/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-error-container" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-6 max-w-sm">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-white font-semibold text-sm rounded-full hover:brightness-105 active:scale-95 transition-all"
          >
            Reload Page
          </button>
          {this.props.showError && this.state.error && (
            <details className="mt-4 text-xs text-text-muted text-left max-w-md">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 p-3 bg-surface-container rounded-xl overflow-auto whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
