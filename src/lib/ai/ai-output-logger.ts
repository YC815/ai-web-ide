/**
 * AI 輸出記錄器
 * 用於記錄AI的文字輸出和決策過程到檔案中
 * 支援時間前綴和累加記錄
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger';

export interface AIOutputRecord {
  timestamp: string;
  type: 'output' | 'decision' | 'error' | 'system';
  source: string; // 來源模組名稱
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AIOutputLoggerConfig {
  logDirectory?: string;
  logFileName?: string;
  maxFileSize?: number; // 最大檔案大小（bytes）
  enableRotation?: boolean; // 是否啟用檔案輪轉
  dateFormat?: string;
  enableConsoleOutput?: boolean;
}

export class AIOutputLogger {
  private static instance: AIOutputLogger;
  private config: Required<AIOutputLoggerConfig>;
  private logFilePath: string;
  private isInitialized = false;

  private constructor(config: AIOutputLoggerConfig = {}) {
    this.config = {
      logDirectory: config.logDirectory || './logs/ai-outputs',
      logFileName: config.logFileName || 'ai-output.log',
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
      enableRotation: config.enableRotation ?? true,
      dateFormat: config.dateFormat || 'YYYY-MM-DD HH:mm:ss.SSS',
      enableConsoleOutput: config.enableConsoleOutput ?? false,
    };

    this.logFilePath = path.join(this.config.logDirectory, this.config.logFileName);
  }

  /**
   * 獲取單例實例
   */
  static getInstance(config?: AIOutputLoggerConfig): AIOutputLogger {
    if (!AIOutputLogger.instance) {
      AIOutputLogger.instance = new AIOutputLogger(config);
    }
    return AIOutputLogger.instance;
  }

  /**
   * 初始化記錄器
   */
  async initialize(): Promise<void> {
    try {
      // 確保記錄目錄存在
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      
      // 檢查檔案是否需要輪轉
      if (this.config.enableRotation) {
        await this.checkAndRotateFile();
      }

      this.isInitialized = true;
      
      // 記錄初始化訊息
      await this.logRecord({
        type: 'system',
        source: 'AIOutputLogger',
        content: 'AI輸出記錄器已初始化',
        metadata: {
          config: {
            logDirectory: this.config.logDirectory,
            logFileName: this.config.logFileName,
            maxFileSize: this.config.maxFileSize,
            enableRotation: this.config.enableRotation,
          }
        }
      });

      logger.info(`[AIOutputLogger] ✅ AI輸出記錄器已初始化，記錄檔案: ${this.logFilePath}`);
    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 初始化失敗: ${error}`);
      throw new Error(`AI輸出記錄器初始化失敗: ${error}`);
    }
  }

  /**
   * 記錄AI輸出
   */
  async logOutput(
    source: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logRecord({
      type: 'output',
      source,
      content,
      metadata,
    });
  }

  /**
   * 記錄AI決策過程
   */
  async logDecision(
    source: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logRecord({
      type: 'decision',
      source,
      content,
      metadata,
    });
  }

  /**
   * 記錄錯誤
   */
  async logError(
    source: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logRecord({
      type: 'error',
      source,
      content,
      metadata,
    });
  }

  /**
   * 記錄系統訊息
   */
  async logSystem(
    source: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.logRecord({
      type: 'system',
      source,
      content,
      metadata,
    });
  }

  /**
   * 記錄一般記錄
   */
  private async logRecord(record: Omit<AIOutputRecord, 'timestamp'>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const timestamp = this.formatTimestamp(new Date());
      const fullRecord: AIOutputRecord = {
        ...record,
        timestamp,
      };

      // 格式化記錄內容
      const logLine = this.formatLogLine(fullRecord);

      // 寫入檔案
      await fs.appendFile(this.logFilePath, logLine + '\n', 'utf8');

      // 可選的控制台輸出
      if (this.config.enableConsoleOutput) {
        console.log(`[AI-LOG] ${logLine}`);
      }

      // 檢查檔案大小並輪轉
      if (this.config.enableRotation) {
        await this.checkAndRotateFile();
      }

    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 記錄寫入失敗: ${error}`);
      // 不拋出錯誤，避免影響主要功能
    }
  }

  /**
   * 格式化時間戳
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 格式化記錄行
   */
  private formatLogLine(record: AIOutputRecord): string {
    const metadataStr = record.metadata 
      ? ` | 元數據: ${JSON.stringify(record.metadata)}`
      : '';

    return `[${record.timestamp}] [${record.type.toUpperCase()}] [${record.source}] ${record.content}${metadataStr}`;
  }

  /**
   * 檢查並輪轉檔案
   */
  private async checkAndRotateFile(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFilePath).catch(() => null);
      
      if (stats && stats.size > this.config.maxFileSize) {
        const timestamp = this.formatTimestamp(new Date()).replace(/[:\s]/g, '-');
        const rotatedFileName = this.config.logFileName.replace(
          /\.log$/,
          `_${timestamp}.log`
        );
        const rotatedFilePath = path.join(this.config.logDirectory, rotatedFileName);

        await fs.rename(this.logFilePath, rotatedFilePath);
        
        logger.info(`[AIOutputLogger] 🔄 檔案已輪轉: ${rotatedFileName}`);
      }
    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 檔案輪轉失敗: ${error}`);
    }
  }

  /**
   * 獲取最近的記錄
   */
  async getRecentLogs(lines: number = 100): Promise<string[]> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 讀取記錄失敗: ${error}`);
      return [];
    }
  }

  /**
   * 清理舊記錄檔案
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.includes('ai-output') && file.endsWith('.log')) {
          const filePath = path.join(this.config.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`[AIOutputLogger] 🗑️ 已刪除舊記錄檔案: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 清理舊記錄失敗: ${error}`);
    }
  }

  /**
   * 獲取記錄統計
   */
  async getLogStats(): Promise<{
    totalLines: number;
    fileSize: number;
    lastModified: Date | null;
    recordTypes: Record<string, number>;
  }> {
    try {
      const stats = await fs.stat(this.logFilePath).catch(() => null);
      const content = await fs.readFile(this.logFilePath, 'utf8').catch(() => '');
      
      const lines = content.split('\n').filter(line => line.trim());
      const recordTypes: Record<string, number> = {};

      // 統計記錄類型
      for (const line of lines) {
        const typeMatch = line.match(/\[(OUTPUT|DECISION|ERROR|SYSTEM)\]/);
        if (typeMatch) {
          const type = typeMatch[1].toLowerCase();
          recordTypes[type] = (recordTypes[type] || 0) + 1;
        }
      }

      return {
        totalLines: lines.length,
        fileSize: stats?.size || 0,
        lastModified: stats?.mtime || null,
        recordTypes,
      };
    } catch (error) {
      logger.error(`[AIOutputLogger] ❌ 獲取統計失敗: ${error}`);
      return {
        totalLines: 0,
        fileSize: 0,
        lastModified: null,
        recordTypes: {},
      };
    }
  }
}

// 預設實例
export const aiOutputLogger = AIOutputLogger.getInstance(); 