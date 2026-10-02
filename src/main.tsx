import React, { ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Root Error Caught]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-neutral-800 border border-neutral-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-black tracking-wide uppercase text-neutral-100">
              Terjadi Kendala Memuat Aplikasi
            </h2>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Sistem mendeteksi kendala pada sesi browser. Silakan klik tombol di bawah untuk memuat ulang aplikasi:
            </p>
            {this.state.error?.message && (
              <pre className="text-[11px] font-mono bg-neutral-950 p-3 rounded-lg border border-neutral-700 text-rose-300 text-left w-full overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Muat Ulang Aplikasi
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (e) {}
                  window.location.reload();
                }}
                className="bg-neutral-700 hover:bg-neutral-600 text-neutral-200 font-bold py-2.5 px-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
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
