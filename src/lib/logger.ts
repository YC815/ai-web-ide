/**
 * Logger 模組 - 重新導出 core/logger 的功能
 * 保持向後兼容性
 */

export * from './core/logger';
export { Logger, LogLevel, ToolLogger, createToolLogger } from './core/logger';

// 創建默認的 logger 實例
import { Logger } from './core/logger';
export const logger = Logger.getInstance(); 