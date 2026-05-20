import { logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
  additionalInfo?: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallbacks: ((error: Error, context: ErrorContext) => void)[] = [];

  private constructor() {
    // Capturar erros não tratados
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        component: 'Global',
        action: 'unhandled_error',
        timestamp: new Date().toISOString()
      });
    });

    // Captitar rejeições de promessas não tratadas
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), {
        component: 'Global',
        action: 'unhandled_promise_rejection',
        timestamp: new Date().toISOString()
      });
    });
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Método principal para tratamento de erros
  handleError(error: Error | string, context: ErrorContext = {}): void {
    const errorObj = error instanceof Error ? error : new Error(error);
    
    // Adicionar timestamp se não fornecido
    if (!context.timestamp) {
      context.timestamp = new Date().toISOString();
    }

    // Logar o erro
    logger.error(
      `Erro em ${context.component || 'Desconhecido'}: ${errorObj.message}`,
      {
        stack: errorObj.stack,
        context,
        severity: this.getErrorSeverity(errorObj)
      },
      context.userId,
      context.sessionId
    );

    // Notificar todos os callbacks registrados
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorObj, context);
      } catch (callbackError) {
        console.error('Erro no callback de tratamento de erro:', callbackError);
      }
    });

    // Aqui você pode adicionar lógica adicional:
    // - Enviar para serviço de monitoramento
    // - Mostrar notificação ao usuário
    // - Salvar para análise posterior
  }

  // Registrar callback para tratamento personalizado
  onError(callback: (error: Error, context: ErrorContext) => void): void {
    this.errorCallbacks.push(callback);
  }

  // Remover callback
  offError(callback: (error: Error, context: ErrorContext) => void): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  // Criar erro com contexto
  createError(
    message: string,
    context: ErrorContext = {},
    originalError?: Error
  ): Error {
    const error = new Error(message);
    
    if (originalError) {
      error.stack = originalError.stack;
    }

    this.handleError(error, context);
    return error;
  }

  // Wrapper para funções assíncronas
  async wrapAsync<T>(
    fn: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), context);
      throw error;
    }
  }

  // Wrapper para funções síncronas
  wrapSync<T>(
    fn: () => T,
    context: ErrorContext
  ): T {
    try {
      return fn();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), context);
      throw error;
    }
  }

  // Classificar severidade do erro
  private getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return 'critical';
    }
    if (message.includes('error') || message.includes('fail')) {
      return 'high';
    }
    if (message.includes('warning') || message.includes('warn')) {
      return 'medium';
    }
    return 'low';
  }

  // Obter estatísticas de erros
  getErrorStats(): {
    total: number;
    byComponent: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{ error: string; context: ErrorContext; timestamp: string }>;
  } {
    const logs = logger.getLogs('error', 100);
    
    const byComponent: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const recent = logs.slice(-10).map(log => ({
      error: log.message,
      context: log.context || {},
      timestamp: log.timestamp
    }));

    logs.forEach(log => {
      const component = log.context?.component || 'Unknown';
      const severity = log.context?.severity || 'unknown';

      byComponent[component] = (byComponent[component] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    });

    return {
      total: logs.length,
      byComponent,
      bySeverity,
      recent
    };
  }

  // Limpar callbacks
  clearCallbacks(): void {
    this.errorCallbacks = [];
  }
}

// Exportar instância global
export const errorHandler = ErrorHandler.getInstance();

// Hook para usar o error handler em componentes React
export const useErrorHandler = () => {
  return {
    handleError: (error: Error | string, context?: ErrorContext) => 
      errorHandler.handleError(error, context),
    onError: (callback: (error: Error, context: ErrorContext) => void) => 
      errorHandler.onError(callback),
    offError: (callback: (error: Error, context: ErrorContext) => void) => 
      errorHandler.offError(callback),
    wrapAsync: <T>(fn: () => Promise<T>, context: ErrorContext) => 
      errorHandler.wrapAsync(fn, context),
    wrapSync: <T>(fn: () => T, context: ErrorContext) => 
      errorHandler.wrapSync(fn, context),
    getErrorStats: () => errorHandler.getErrorStats()
  };
};