/**
 * 動態提示建構器 - 簡化版本
 * 用於替代已刪除的原始 prompt-builder.ts
 * @deprecated 請使用新的統一 Function Call 系統
 */

export interface ConversationContext {
  projectName?: string;
  recentMessages?: string[];
  projectSnapshot?: any;
  autoRepairMode?: boolean;
  repairAttempt?: number;
}

export class DynamicPromptBuilder {
  /**
   * 建構完整提示
   */
  buildCompletePrompt(userMessage: string, context?: ConversationContext): string {
    const systemPrompt = this.buildSystemPrompt(context);
    const contextSection = this.buildContextSection(context);
    
    return `${systemPrompt}

${contextSection}

用戶訊息: ${userMessage}

請根據上下文提供詳細且有用的回應。`;
  }

  /**
   * 建構簡化提示
   */
  buildSimplifiedPrompt(userMessage: string, projectSnapshot?: any): string {
    let prompt = `你是一個專業的 AI 助理。`;
    
    if (projectSnapshot) {
      prompt += `\n\n專案資訊：
- 專案名稱: ${projectSnapshot.name || '未知'}
- 專案類型: ${projectSnapshot.type || '未知'}`;
    }
    
    prompt += `\n\n用戶訊息: ${userMessage}

請提供清晰、準確的回應。`;
    
    return prompt;
  }

  /**
   * 建構自動修復提示
   */
  buildAutoRepairPrompt(userMessage: string, context?: ConversationContext): string {
    const basePrompt = this.buildCompletePrompt(userMessage, context);
    
    return `${basePrompt}

🔧 自動修復模式已啟用
- 當前嘗試次數: ${context?.repairAttempt || 0}
- 請仔細分析問題並提供解決方案
- 如果遇到高風險操作，請明確說明並要求用戶確認`;
  }

  /**
   * 建構系統提示
   */
  private buildSystemPrompt(context?: ConversationContext): string {
    let prompt = `你是一個專業的 AI 開發助理，專精於：
- 程式碼分析和開發
- 專案管理和結構優化
- 問題診斷和解決方案
- 檔案操作和內容管理`;

    if (context?.autoRepairMode) {
      prompt += `\n- 自動修復和錯誤處理`;
    }

    return prompt;
  }

  /**
   * 建構上下文區段
   */
  private buildContextSection(context?: ConversationContext): string {
    if (!context) {
      return '';
    }

    let contextSection = '';

    if (context.projectName) {
      contextSection += `專案名稱: ${context.projectName}\n`;
    }

    if (context.recentMessages && context.recentMessages.length > 0) {
      contextSection += `\n最近的對話:\n${context.recentMessages.slice(-3).join('\n')}\n`;
    }

    if (context.projectSnapshot) {
      contextSection += `\n專案快照:\n${JSON.stringify(context.projectSnapshot, null, 2)}\n`;
    }

    return contextSection;
  }
}

/**
 * 工廠函數
 */
export function createDynamicPromptBuilder(): DynamicPromptBuilder {
  return new DynamicPromptBuilder();
}

/**
 * 顯示遷移警告
 * @deprecated 請使用新的統一 Function Call 系統
 */
export function showMigrationWarning(): void {
  console.warn(`
⚠️ DynamicPromptBuilder 已棄用
請使用新的統一 Function Call 系統中的提示工具
位置：src/lib/functions/ai/index.ts
遷移指南：docs/unified-function-call-system.md
  `);
} 