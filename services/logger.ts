export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: any;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private constructor() {
    this.loadLogs();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private loadLogs(): void {
    try {
      const saved = localStorage.getItem('deliverycity_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  }

  private saveLogs(): void {
    try {
      // Manter apenas os logs mais recentes
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      
      localStorage.setItem('deliverycity_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Erro ao salvar logs:', error);
    }
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: any,
    userId?: string,
    sessionId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId,
      sessionId
    };
  }

  info(message: string, context?: any, userId?: string, sessionId?: string): void {
    const entry = this.createLogEntry('info', message, context, userId, sessionId);
    this.logs.push(entry);
    this.saveLogs();
    console.log(`[INFO] ${message}`, context || '');
  }

  warn(message: string, context?: any, userId?: string, sessionId?: string): void {
    const entry = this.createLogEntry('warn', message, context, userId, sessionId);
    this.logs.push(entry);
    this.saveLogs();
    console.warn(`[WARN] ${message}`, context || '');
  }

  error(message: string, context?: any, userId?: string, sessionId?: string): void {
    const entry = this.createLogEntry('error', message, context, userId, sessionId);
    this.logs.push(entry);
    this.saveLogs();
    console.error(`[ERROR] ${message}`, context || '');
  }

  debug(message: string, context?: any, userId?: string, sessionId?: string): void {
    const entry = this.createLogEntry('debug', message, context, userId, sessionId);
    this.logs.push(entry);
    this.saveLogs();
    console.debug(`[DEBUG] ${message}`, context || '');
  }

  getLogs(level?: LogEntry['level'], limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Enviar logs para um serviço externo (opcional)
  async sendLogsToService(serviceUrl: string, apiKey?: string): Promise<boolean> {
    try {
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey ? `Bearer ${apiKey}` : ''
        },
        body: this.exportLogs()
      });

      if (response.ok) {
        this.info('Logs enviados com sucesso para o serviço externo');
        return true;
      } else {
        this.error('Falha ao enviar logs para o serviço externo', { status: response.status });
        return false;
      }
    } catch (error) {
      this.error('Erro ao enviar logs para o serviço externo', error);
      return false;
    }
  }
}

// Exportar uma instância global
export const logger = Logger.getInstance();

// Hook para usar o logger em componentes React
export const useLogger = () => {
  return {
    info: (message: string, context?: any) => logger.info(message, context),
    warn: (message: string, context?: any) => logger.warn(message, context),
    error: (message: string, context?: any) => logger.error(message, context),
    debug: (message: string, context?: any) => logger.debug(message, context),
    getLogs: (level?: LogEntry['level'], limit?: number) => logger.getLogs(level, limit),
    clearLogs: () => logger.clearLogs(),
    exportLogs: () => logger.exportLogs()
  };
};