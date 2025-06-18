// 主要模組導出
export * from './ai';
export * from './docker';
export * from './core';

// 新的統一 Function Call 系統
export * from './functions';

// 保持向後兼容的導出 (已棄用)
/** @deprecated 使用 aiContextManager 替代，位於 src/lib/functions/ai */
export { AIContextManager } from './ai/context-manager';
export { logger, ToolLogger } from './core/logger';
export { createDockerToolkit } from './docker/tools';
export { ToolManager } from './core/tool-manager';
export type { ToolResponse, CallToolInterface, CodeDiff } from './core/tool-types'; 