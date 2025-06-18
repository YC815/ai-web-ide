import * as fs from 'fs';
import * as path from 'path';

// 保存原始的 console 方法 (從根目錄 logger.ts 移植)
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// 需要過濾的 API 路徑 (從根目錄 logger.ts 移植)
const FILTERED_PATHS = [
  '/api/docker-status',
  '/api/docker-containers',
  'GET /api/docker-status',
  'POST /api/docker-status'
];

// 檢查是否應該過濾此日誌 (從根目錄 logger.ts 移植)
function shouldFilterLog(message: string): boolean {
  return FILTERED_PATHS.some(path => 
    message.includes(path) && (
      message.includes('200 in') || 
      message.includes('GET ') || 
      message.includes('POST ')
    )
  );
}

// 創建過濾版本的 console 方法 (從根目錄 logger.ts 移植)
function createFilteredConsole(originalMethod: (...args: any[]) => void) {
  return (...args: any[]) => {
    const message = args.join(' ');
    if (!shouldFilterLog(message)) {
      originalMethod.apply(console, args);
    }
  };
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile: string;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout;
  private context: string = 'System';

  private constructor() {
    // 創建日誌目錄
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 設定日誌檔案路徑
    const today = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logDir, `ai-creator-${today}.log`);

    // 設定定期刷新日誌到檔案
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000); // 每5秒刷新一次
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  debug(categoryOrMessage: string, message?: string, data?: any): void {
    if (typeof message === 'undefined') {
      // 單參數模式 (兼容根目錄 logger.ts)
      this.log(LogLevel.DEBUG, this.context, categoryOrMessage, data);
    } else {
      // 雙參數模式 (原有模式)
      this.log(LogLevel.DEBUG, categoryOrMessage, message, data);
    }
  }

  info(categoryOrMessage: string, message?: string, data?: any): void {
    if (typeof message === 'undefined') {
      // 單參數模式 (兼容根目錄 logger.ts)
      this.log(LogLevel.INFO, this.context, categoryOrMessage, data);
    } else {
      // 雙參數模式 (原有模式)
      this.log(LogLevel.INFO, categoryOrMessage, message, data);
    }
  }

  warn(categoryOrMessage: string, message?: string, data?: any): void {
    if (typeof message === 'undefined') {
      // 單參數模式 (兼容根目錄 logger.ts)
      this.log(LogLevel.WARN, this.context, categoryOrMessage, data);
    } else {
      // 雙參數模式 (原有模式)
      this.log(LogLevel.WARN, categoryOrMessage, message, data);
    }
  }

  error(categoryOrMessage: string, messageOrError?: string | Error, errorOrData?: Error | any, data?: any): void {
    if (typeof messageOrError === 'undefined') {
      // 單參數模式 (兼容根目錄 logger.ts)
      this.log(LogLevel.ERROR, this.context, categoryOrMessage);
    } else if (typeof messageOrError === 'string') {
      // 雙參數模式 (原有模式)
      this.log(LogLevel.ERROR, categoryOrMessage, messageOrError, errorOrData, data);
    } else {
      // 根目錄 logger.ts 的錯誤處理模式
      const errorData = messageOrError instanceof Error ? {
        name: messageOrError.name,
        message: messageOrError.message,
        stack: messageOrError.stack,
        ...errorOrData
      } : { error: messageOrError, ...errorOrData };
      
      this.log(LogLevel.ERROR, this.context, categoryOrMessage, errorData);
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any, error?: Error): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      error
    };

    this.logBuffer.push(entry);

    // 同時輸出到控制台 (加入過濾功能)
    this.logToConsole(entry);

    // 如果是錯誤級別，立即刷新到檔案
    if (level === LogLevel.ERROR) {
      this.flushLogs();
    }
  }

  private logToConsole(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level];
    const timestamp = entry.timestamp.split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] ${levelStr} [${entry.category}]`;
    const fullMessage = `${prefix} ${entry.message}`;

    // 應用過濾邏輯
    if (shouldFilterLog(fullMessage)) {
      return;
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        originalConsole.log(`🔍 ${fullMessage}`, entry.data || '');
        break;
      case LogLevel.INFO:
        originalConsole.info(`ℹ️ ${fullMessage}`, entry.data || '');
        break;
      case LogLevel.WARN:
        originalConsole.warn(`⚠️ ${fullMessage}`, entry.data || '');
        break;
      case LogLevel.ERROR:
        originalConsole.error(`❌ ${fullMessage}`, entry.error || entry.data || '');
        break;
    }
  }

  private flushLogs(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logLines = this.logBuffer.map(entry => {
      const levelStr = LogLevel[entry.level].padEnd(5);
      const category = entry.category.padEnd(15);
      let line = `${entry.timestamp} ${levelStr} [${category}] ${entry.message}`;
      
      if (entry.data) {
        line += ` | Data: ${JSON.stringify(entry.data)}`;
      }
      
      if (entry.error) {
        line += ` | Error: ${entry.error.message}`;
        if (entry.error.stack) {
          line += `\n${entry.error.stack}`;
        }
      }
      
      return line;
    }).join('\n') + '\n';

    try {
      fs.appendFileSync(this.logFile, logLines);
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write logs to file:', error);
    }
  }

  getRecentLogs(lines: number = 100): LogEntry[] {
    return this.logBuffer.slice(-lines);
  }

  getLogFilePath(): string {
    return this.logFile;
  }

  cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushLogs();
  }

  // 應用日誌過濾器 (從根目錄 logger.ts 移植)
  applyLogFilter(): void {
    console.log = createFilteredConsole(originalConsole.log);
    console.info = createFilteredConsole(originalConsole.info);
    console.warn = createFilteredConsole(originalConsole.warn);
  }

  // 移除日誌過濾器 (從根目錄 logger.ts 移植)
  removeLogFilter(): void {
    Object.assign(console, originalConsole);
  }
}

// 創建全域日誌實例
export const logger = Logger.getInstance();

// 在開發模式下自動應用過濾器
if (process.env.NODE_ENV === 'development') {
  logger.applyLogFilter();
}

// 工具特定的日誌器
export class ToolLogger {
  constructor(private toolName: string, private baseLogger: Logger = logger) {}

  debug(message: string, data?: any): void {
    this.baseLogger.debug(`TOOL:${this.toolName}`, message, data);
  }

  info(message: string, data?: any): void {
    this.baseLogger.info(`TOOL:${this.toolName}`, message, data);
  }

  warn(message: string, data?: any): void {
    this.baseLogger.warn(`TOOL:${this.toolName}`, message, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.baseLogger.error(`TOOL:${this.toolName}`, message, error, data);
  }

  logToolCall(parameters: any, startTime: number): void {
    this.info(`Tool called with parameters`, { parameters, timestamp: startTime });
  }

  logToolResult(result: any, executionTime: number): void {
    this.info(`Tool completed`, { 
      success: result.success, 
      executionTime: `${executionTime}ms`,
      hasData: !!result.data,
      hasError: !!result.error
    });
  }

  logToolError(error: Error, parameters: any): void {
    this.error(`Tool execution failed`, error, { parameters });
  }
}

// 創建專用日誌器的工廠函數
export function createToolLogger(toolName: string): ToolLogger {
  return new ToolLogger(toolName, logger);
} 