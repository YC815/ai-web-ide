/**
 * Langchain 工具綁定器
 * 將統一 Function Call 系統與 Langchain 整合
 */

import { DynamicTool, Tool } from '@langchain/core/tools';
import { 
  allTools, 
  toolsByCategory, 
  generateOpenAISchemas 
} from '../functions/index.js';
import type { FunctionDefinition } from '../functions/types.js';

/**
 * 將統一工具轉換為 Langchain DynamicTool
 */
export function convertToLangchainTool(functionDef: FunctionDefinition): DynamicTool {
  return new DynamicTool({
    name: functionDef.name,
    description: functionDef.description,
    func: async (input: string) => {
      try {
        // 解析輸入參數
        let parameters: Record<string, any>;
        try {
          parameters = JSON.parse(input);
        } catch {
          // 如果不是 JSON，嘗試簡單參數解析
          parameters = { input };
        }

        // 驗證參數（如果有驗證器）
        if (functionDef.validator) {
          const validation = await functionDef.validator(parameters);
          if (!validation.isValid) {
            return `❌ 參數驗證失敗: ${validation.reason}`;
          }
        }

        // 執行工具
        const result = await functionDef.handler(parameters);
        
        // 格式化結果
        if (typeof result === 'object') {
          return JSON.stringify(result, null, 2);
        }
        return String(result);

      } catch (error) {
        return `❌ 工具執行失敗: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  });
}

/**
 * 批量轉換所有工具
 */
export function convertAllToolsToLangchain(): DynamicTool[] {
  return allTools.map(convertToLangchainTool);
}

/**
 * 按分類轉換工具
 */
export function convertToolsByCategoryToLangchain(category: string): DynamicTool[] {
  const categoryTools = toolsByCategory[category] || [];
  return categoryTools.map(convertToLangchainTool);
}

/**
 * 創建高優先級工具集合（用於 AI Agent）
 */
export function createHighPriorityToolsForAgent(): DynamicTool[] {
  // 選擇最重要的工具
  const highPriorityCategories = ['ai', 'docker', 'project', 'filesystem'];
  const highPriorityTools: FunctionDefinition[] = [];

  for (const category of highPriorityCategories) {
    const categoryTools = toolsByCategory[category] || [];
    highPriorityTools.push(...categoryTools);
  }

  return highPriorityTools.map(convertToLangchainTool);
}

/**
 * 為 OpenAI Function Calling 生成工具定義
 */
export function generateOpenAIToolDefinitions() {
  return generateOpenAISchemas().map(schema => ({
    type: 'function' as const,
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters
    }
  }));
}

/**
 * 智能工具選擇器
 * 根據用戶請求自動選擇相關工具
 */
export function selectToolsForRequest(userMessage: string): DynamicTool[] {
  const message = userMessage.toLowerCase();
  const selectedTools: FunctionDefinition[] = [];

  // 根據關鍵字選擇工具
  if (message.includes('docker') || message.includes('容器')) {
    selectedTools.push(...(toolsByCategory.docker || []));
  }
  
  if (message.includes('檔案') || message.includes('file') || message.includes('read') || message.includes('write')) {
    selectedTools.push(...(toolsByCategory.filesystem || []));
  }
  
  if (message.includes('專案') || message.includes('project') || message.includes('初始化')) {
    selectedTools.push(...(toolsByCategory.project || []));
  }
  
  if (message.includes('ai') || message.includes('agent') || message.includes('聊天')) {
    selectedTools.push(...(toolsByCategory.ai || []));
  }
  
  if (message.includes('系統') || message.includes('監控') || message.includes('log')) {
    selectedTools.push(...(toolsByCategory.system || []));
  }
  
  if (message.includes('網路') || message.includes('http') || message.includes('api')) {
    selectedTools.push(...(toolsByCategory.network || []));
  }

  // 如果沒有匹配到特定工具，返回核心工具集
  if (selectedTools.length === 0) {
    selectedTools.push(...createHighPriorityToolsForAgent().map(tool => {
      // 從 DynamicTool 轉回 FunctionDefinition 的簡化版本
      return allTools.find(t => t.name === tool.name)!;
    }).filter(Boolean));
  }

  // 去重並轉換
  const uniqueTools = Array.from(new Set(selectedTools));
  return uniqueTools.map(convertToLangchainTool);
}

export default {
  convertToLangchainTool,
  convertAllToolsToLangchain,
  convertToolsByCategoryToLangchain,
  createHighPriorityToolsForAgent,
  generateOpenAIToolDefinitions,
  selectToolsForRequest
};