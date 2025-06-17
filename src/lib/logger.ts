/**
 * 日誌系統
 * 提供統一的日誌介面和過濾功能
 */

// 保存原始的 console 方法
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// 需要過濾的 API 路徑
const FILTERED_PATHS = [
  '/api/docker-status',
  '/api/docker-containers',
  'GET /api/docker-status',
  'POST /api/docker-status'
];

// 檢查是否應該過濾此日誌
function shouldFilterLog(message: string): boolean {
  return FILTERED_PATHS.some(path => 
    message.includes(path) && (
      message.includes('200 in') || 
      message.includes('GET ') || 
      message.includes('POST ')
    )
  );
}

// 創建過濾版本的 console 方法
function createFilteredConsole(originalMethod: (...args: any[]) => void) {
  return (...args: any[]) => {
    const message = args.join(' ');
    if (!shouldFilterLog(message)) {
      originalMethod.apply(console, args);
    }
  };
}

// 日誌級別
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 日誌介面
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: any;
  error?: Error;
}

// Logger 類別
export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string = 'Default', minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = this.context ? `[${this.context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    return `${timestamp} ${levelName} ${contextStr} ${message}${dataStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, data);
      if (!shouldFilterLog(formatted)) {
        originalConsole.log(formatted);
      }
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message, data);
      if (!shouldFilterLog(formatted)) {
        originalConsole.info(formatted);
      }
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message, data);
      if (!shouldFilterLog(formatted)) {
        originalConsole.warn(formatted);
      }
    }
  }

  error(message: string, error?: Error | any, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorData = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...data
      } : { error, ...data };
      
      const formatted = this.formatMessage(LogLevel.ERROR, message, errorData);
      if (!shouldFilterLog(formatted)) {
        originalConsole.error(formatted);
      }
    }
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setContext(context: string): void {
    this.context = context;
  }
}

// 預設 logger 實例
export const logger = new Logger('System', LogLevel.INFO);

// 應用日誌過濾器
export function applyLogFilter() {
  console.log = createFilteredConsole(originalConsole.log);
  console.info = createFilteredConsole(originalConsole.info);
  console.warn = createFilteredConsole(originalConsole.warn);
}

// 移除日誌過濾器
export function removeLogFilter() {
  Object.assign(console, originalConsole);
}

// 在開發模式下自動應用過濾器
if (process.env.NODE_ENV === 'development') {
  applyLogFilter();
} 