// 遷移管理器 - 整合舊的 AI 工具到新的 Function Call 系統
import { ToolCategory, FunctionAccessLevel } from './categories';
import type { FunctionDefinition } from './types';

/**
 * 舊 AI 工具到新 Function Call 系統的遷移映射
 */
export const migrationMapping = {
  // Docker 工具遷移
  'DockerTools.readFileFromDocker': 'dockerReadFile',
  'DockerTools.listDirFromDocker': 'dockerListDirectory', 
  'DockerTools.writeFileToDocker': 'dockerWriteFile',
  'DockerTools.findFiles': 'dockerFindFiles',
  'DockerTools.checkPathExists': 'dockerCheckPathExists',
  'DockerTools.getFileInfo': 'dockerGetProjectInfo',
  
  // 統一 Docker 工具遷移
  'UnifiedDockerTools.readFile': 'dockerReadFile',
  'UnifiedDockerTools.listDirectory': 'dockerListDirectory',
  'UnifiedDockerTools.writeFile': 'dockerWriteFile',
  'UnifiedDockerTools.findFiles': 'dockerFindFiles',
  'UnifiedDockerTools.checkPathExists': 'dockerCheckPathExists',
  'UnifiedDockerTools.getProjectInfo': 'dockerGetProjectInfo',
  
  // AI 代理工具遷移
  'AgentController.runAgentController': 'aiAgentExecute',
  'AgentFactory.createAgent': 'aiAgentExecute',
  'StrictAgentFactory.createStrictAgent': 'aiAgentExecute',
  
  // OpenAI 整合遷移
  'OpenAIIntegration.sendMessage': 'aiChatSession',
  'OpenAIIntegration.createSession': 'aiChatSession',
  'OpenAIIntegration.getSession': 'aiChatSession',
  
  // 工具註冊表遷移
  'ToolRegistry.register': 'aiToolRegistry',
  'ToolRegistry.execute': 'aiToolRegistry',
  'ToolRegistry.list': 'aiToolRegistry',
  'EnhancedToolRegistry.register': 'aiToolRegistry',
  'StrictToolRegistry.register': 'aiToolRegistry',
  
  // 上下文管理遷移
  'AIContextManager.store': 'aiContextManager',
  'AIContextManager.retrieve': 'aiContextManager',
  'AIContextManager.search': 'aiContextManager',
  'EnhancedContextManager.store': 'aiContextManager',
  
  // 日誌工具遷移
  'AIOutputLogger.log': 'logManager',
  'AIOutputLogger.query': 'logManager',
  'AIOutputLogger.clear': 'logManager',
  
  // 安全驗證遷移
  'DockerSecurityValidator.validate': 'securityValidator',
  'DockerSecurityValidator.scan': 'securityValidator',
  
  // 專案分析遷移
  'codeAnalysis': 'codeAnalyzer',
  'projectAnalysis': 'projectInfo',
  'workspaceConfig': 'workspaceManager'
};

/**
 * 已棄用的工具標記
 */
export const deprecatedTools = [
  'docker-tools.ts',
  'docker-tools-v2.ts',
  'agent-controller.ts',
  'agent-factory.ts',
  'strict-agent-factory.ts',
  'openai.ts',
  'context-manager.ts',
  'enhanced-context-manager.ts',
  'ai-output-logger.ts',
  'docker-security-validator.ts',
  'enhanced-tool-registry.ts',
  'strict-tool-registry.ts'
];

/**
 * 遷移狀態追蹤
 */
export interface MigrationStatus {
  oldTool: string;
  newTool: string;
  status: 'pending' | 'migrated' | 'deprecated' | 'removed';
  migrationDate?: Date;
  notes?: string;
}

/**
 * 遷移管理器類
 */
export class MigrationManager {
  private migrationLog: MigrationStatus[] = [];
  
  constructor() {
    this.initializeMigrationLog();
  }
  
  private initializeMigrationLog() {
    Object.entries(migrationMapping).forEach(([oldTool, newTool]) => {
      this.migrationLog.push({
        oldTool,
        newTool,
        status: 'migrated',
        migrationDate: new Date(),
        notes: `自動遷移到統一 Function Call 系統`
      });
    });
    
    deprecatedTools.forEach(tool => {
      this.migrationLog.push({
        oldTool: tool,
        newTool: 'N/A',
        status: 'deprecated',
        migrationDate: new Date(),
        notes: `已標記為棄用，建議使用新的 Function Call 工具`
      });
    });
  }
  
  /**
   * 獲取遷移狀態
   */
  getMigrationStatus(): MigrationStatus[] {
    return this.migrationLog;
  }
  
  /**
   * 查找新工具名稱
   */
  findNewToolName(oldToolName: string): string | null {
    return migrationMapping[oldToolName] || null;
  }
  
  /**
   * 檢查工具是否已棄用
   */
  isDeprecated(toolName: string): boolean {
    return deprecatedTools.includes(toolName);
  }
  
  /**
   * 生成遷移報告
   */
  generateMigrationReport(): {
    summary: {
      totalTools: number;
      migratedTools: number;
      deprecatedTools: number;
      pendingTools: number;
    };
    details: MigrationStatus[];
    recommendations: string[];
  } {
    const summary = {
      totalTools: this.migrationLog.length,
      migratedTools: this.migrationLog.filter(m => m.status === 'migrated').length,
      deprecatedTools: this.migrationLog.filter(m => m.status === 'deprecated').length,
      pendingTools: this.migrationLog.filter(m => m.status === 'pending').length
    };
    
    const recommendations = [
      '🔄 更新所有對舊工具的引用，改用新的 Function Call 系統',
      '🗑️ 移除已棄用的工具文件，保持代碼庫整潔',
      '📚 更新文檔和範例，使用新的工具名稱',
      '🧪 測試新工具的功能，確保遷移後的相容性',
      '🏷️ 為舊的 API 添加 @deprecated 標記，提供遷移指引'
    ];
    
    return {
      summary,
      details: this.migrationLog,
      recommendations
    };
  }
  
  /**
   * 生成向後相容性包裝器
   */
  generateCompatibilityWrapper(oldToolName: string): string | null {
    const newToolName = this.findNewToolName(oldToolName);
    if (!newToolName) return null;
    
    return `
// @deprecated 使用 ${newToolName} 替代
export async function ${oldToolName.split('.').pop()}(...args: any[]) {
  console.warn('⚠️ ${oldToolName} 已棄用，請使用 ${newToolName}');
  // 這裡可以添加參數轉換邏輯
  return await ${newToolName}(...args);
}`;
  }
}

// 創建全域遷移管理器實例
export const migrationManager = new MigrationManager();

/**
 * 遷移輔助函數
 */
export function createMigrationGuide(): {
  title: string;
  sections: Array<{
    title: string;
    content: string;
    examples?: string[];
  }>;
} {
  return {
    title: 'AI 工具遷移指南',
    sections: [
      {
        title: '🎯 遷移概述',
        content: '為了提供更統一和結構化的 AI 工具體驗，我們將所有工具整合到新的 OpenAI Function Call 系統中。',
        examples: [
          '統一的工具介面和參數格式',
          '更好的錯誤處理和驗證',
          '支援權限管理和速率限制',
          '完整的日誌記錄和監控'
        ]
      },
      {
        title: '🔄 主要變更',
        content: '以下是主要的工具遷移映射：',
        examples: Object.entries(migrationMapping).map(([old, newTool]) => 
          `${old} → ${newTool}`
        ).slice(0, 10)
      },
      {
        title: '📝 遷移步驟',
        content: '請按照以下步驟進行遷移：',
        examples: [
          '1. 識別代碼中使用的舊工具',
          '2. 查找對應的新工具名稱',
          '3. 更新函數調用和參數格式',
          '4. 測試新工具的功能',
          '5. 移除對舊工具的引用'
        ]
      },
      {
        title: '⚠️ 注意事項',
        content: '遷移過程中需要注意的重要事項：',
        examples: [
          '新工具的參數格式可能有所不同',
          '返回值結構已標準化',
          '錯誤處理機制已改進',
          '某些舊功能可能已合併或重新設計'
        ]
      }
    ]
  };
}

export default MigrationManager; 