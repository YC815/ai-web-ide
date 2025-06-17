import fs from 'fs';
import path from 'path';

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

  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data, error);
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

    // 同時輸出到控制台
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

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 ${prefix}`, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${prefix}`, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${prefix}`, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${prefix}`, entry.message, entry.error || entry.data || '');
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
}

// 創建全域日誌實例
export const logger = Logger.getInstance();

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

  logToolError(error: Error, executionTime: number): void {
    this.error(`Tool failed after ${executionTime}ms`, error);
  }
} 