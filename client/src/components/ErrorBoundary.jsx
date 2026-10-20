import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="glass max-w-md w-full rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-expense/10 text-expense mx-auto flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Something went wrong</h3>
              <p className="text-xs text-gray-400 mt-1">
                An unexpected error occurred while loading this view.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-left font-mono text-[11px] text-red-400 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-savings to-emerald-400 text-white font-semibold text-xs cursor-pointer hover:opacity-95 transition-opacity"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
