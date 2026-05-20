import React, { ReactNode, useState, useEffect } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export function ErrorBoundary({ children, fallback, onError }: Props) {
  const [state, setState] = useState<State>({
    hasError: false,
    error: null,
    errorInfo: null
  });

  useEffect(() => {
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
      setState({
        hasError: true,
        error,
        errorInfo
      });

      onError?.(error, errorInfo);
    };

    const handleGlobalError = (event: ErrorEvent) => {
      handleError(new Error(event.error), {
        componentStack: event.filename + ':' + event.lineno,
      } as React.ErrorInfo);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(new Error(event.reason), {
        componentStack: 'Unhandled Promise Rejection',
      } as React.ErrorInfo);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [onError]);

  if (state.hasError) {
    // Se houver um fallback personalizado, usá-lo
    if (fallback) {
      return <>{fallback}</>;
    }

    // Fallback padrão
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Algo deu errado</h3>
            <p className="mt-2 text-sm text-gray-500">
              Desculpe pelo inconveniente. Nossa equipe foi notificada sobre este problema.
            </p>
            
            {process.env.NODE_ENV === 'development' && state.error && (
              <div className="mt-4 text-left">
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                    Detalhes do erro (apenas em desenvolvimento)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded">
                    <p className="font-mono text-xs text-red-600">
                      {state.error.message}
                    </p>
                    {state.error.stack && (
                      <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                        {state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            )}
            
            <div className="mt-6">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Wrapper para componentes funcionais
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}