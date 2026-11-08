import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Root Error Caught]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-ink-950 text-ink-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div data-ui className="max-w-md w-full bg-ink-900 border border-ink-700 rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-danger-500/20 text-danger-300 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-ink-50">
              Terjadi Kendala Memuat Aplikasi
            </h2>
            <p className="text-sm text-ink-200 leading-relaxed">
              Sistem mendeteksi kendala pada sesi browser. Silakan pilih tombol di bawah untuk memuat ulang aplikasi:
            </p>
            {this.state.error?.message && (
              <pre data-ui className="text-xs bg-ink-950 p-3 rounded-lg border border-ink-800 text-danger-300 text-left w-full overflow-x-auto max-h-32">
                <code>{this.state.error.message}</code>
              </pre>
            )}
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-h-11 bg-danger-500 hover:bg-danger-600 text-ink-50 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Muat Ulang Aplikasi
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch {
                    // ignore storage errors in restricted browsing modes
                  }
                  window.location.reload();
                }}
                className="min-h-11 bg-ink-800 hover:bg-ink-700 text-ink-100 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Bersihkan Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.dataset.rendered = 'true';
  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  );
}
