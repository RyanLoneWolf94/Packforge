import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Stops a single component throw from blanking the whole app — which is exactly
 * what used to happen when a module threw during import.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in render tree:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-[14px] shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-dim text-red flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={26} />
          </div>
          <h1 className="disp text-lg font-extrabold text-ink">Something broke</h1>
          <p className="text-sm text-ink-soft mt-2">
            This screen hit an unexpected error. Your saved studio data is untouched.
          </p>
          <pre className="mt-4 text-left text-[11px] bg-surface-2 border border-line rounded-lg p-3 overflow-x-auto text-ink-soft">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full py-2.5 bg-orange text-white rounded-lg text-sm font-bold hover:bg-orange-deep transition-colors"
          >
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
