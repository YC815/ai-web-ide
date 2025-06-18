/**
 * AI 模組統一導出
 * 🚨 重要：大部分工具已遷移到 src/lib/functions 統一 Function Call 系統
 * 請參考遷移指南：docs/ai-tools-refactoring-guide.md
 */

// 核心組件 (已棄用，請使用 src/lib/functions/ai 中的新工具)
/** @deprecated 使用 aiAgentExecute 替代，位於 src/lib/functions/ai */
export * from './agent-controller';
/** @deprecated 使用 aiAgentExecute 替代，位於 src/lib/functions/ai */
export * from './agent-factory';
/** @deprecated 使用 aiContextManager 替代，位於 src/lib/functions/ai */
export * from './context-manager';

// OpenAI 整合 (部分已棄用)
export * from './openai-service';
/** @deprecated 使用 aiChatSession 替代，位於 src/lib/functions/ai */
export * from './openai';

// 工具系統 (新架構) - 建議使用 src/lib/functions 中的統一系統
export * from './tools';

// LangChain 整合 (保留)
export * from './langchain-chat-engine';

// 提示系統 (保留，但建議整合到新系統)
export * from './prompts';
export * from './prompt-builder';

// 輸出記錄 (已棄用)
/** @deprecated 使用 logManager 替代，位於 src/lib/functions/system */
export * from './ai-output-logger';

// 安全驗證 (已棄用)
/** @deprecated 使用 securityValidator 替代，位於 src/lib/functions/system */
export * from './docker-security-validator';

// 聊天整合 (已棄用)
/** @deprecated 使用 aiChatSession 替代，位於 src/lib/functions/ai */
export * from './chat-agent-integration';
/** @deprecated 使用 aiChatSession 替代，位於 src/lib/functions/ai */
export * from './secure-chat-agent-integration';

// 向後兼容 (全部已棄用，請使用新的 Function Call 系統)
/** @deprecated 使用 aiToolRegistry 替代，位於 src/lib/functions/ai */
export * from './enhanced-tool-registry';
/** @deprecated 使用 aiToolRegistry 替代，位於 src/lib/functions/ai */
export * from './strict-tool-registry';
/** @deprecated 使用 aiAgentExecute 替代，位於 src/lib/functions/ai */
export * from './strict-agent-factory';

// 遷移輔助工具
import { migrationManager } from '../functions/migration-manager';

/**
 * 獲取遷移建議
 * @param toolName 舊工具名稱
 * @returns 遷移建議或 null
 */
export function getMigrationSuggestion(toolName: string): string | null {
  const newToolName = migrationManager.findNewToolName(toolName);
  if (newToolName) {
    return `⚠️ ${toolName} 已棄用，請使用 ${newToolName} 替代。`;
  }
  return null;
}

/**
 * 顯示遷移警告 - 在使用舊工具時調用
 */
export function showMigrationWarning() {
  console.warn(`
🚨 AI 工具遷移通知
===================
src/lib/ai 中的許多工具已遷移到新的統一 Function Call 系統。

新位置：src/lib/functions/
├── ai/        - AI 代理和聊天工具
├── docker/    - Docker 容器操作工具  
├── project/   - 專案管理工具
├── system/    - 系統監控和調試工具
└── ...

主要優勢：
✅ 統一的 OpenAI Function Call 格式
✅ 更好的錯誤處理和參數驗證
✅ 支援權限管理和速率限制  
✅ 完整的日誌記錄和監控
✅ 按功能分類組織，更易維護

遷移指南：docs/ai-tools-refactoring-guide.md
  `);
}

/**
 * 遷移映射表 - 快速查找新工具名稱
 */
export const MIGRATION_MAP = {
  // Docker 工具
  'DockerTools': 'src/lib/functions/docker',
  'UnifiedDockerTools': 'src/lib/functions/docker', 
  
  // AI 代理
  'AgentController': 'aiAgentExecute (src/lib/functions/ai)',
  'AgentFactory': 'aiAgentExecute (src/lib/functions/ai)',
  
  // 聊天和會話
  'OpenAIIntegration': 'aiChatSession (src/lib/functions/ai)',
  
  // 工具註冊表
  'ToolRegistry': 'aiToolRegistry (src/lib/functions/ai)',
  'EnhancedToolRegistry': 'aiToolRegistry (src/lib/functions/ai)',
  
  // 上下文管理
  'AIContextManager': 'aiContextManager (src/lib/functions/ai)',
  'EnhancedContextManager': 'aiContextManager (src/lib/functions/ai)',
  
  // 日誌和監控
  'AIOutputLogger': 'logManager (src/lib/functions/system)',
  
  // 安全驗證
  'DockerSecurityValidator': 'securityValidator (src/lib/functions/system)'
}; 