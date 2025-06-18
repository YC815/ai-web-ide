/**
 * 統一 Function Call 系統使用範例
 */

import { 
  createHighPriorityToolsForAgent,
  selectToolsForRequest,
  generateOpenAIToolDefinitions 
} from '../lib/functions/langchain-binder';
import { allTools, searchTools } from '../lib/functions/index';

// 範例 1: 為 AI Agent 創建工具集
export async function createAIAgentWithTools() {
  const tools = createHighPriorityToolsForAgent();
  console.log(`創建了 ${tools.length} 個高優先級工具`);
  
  // 這些工具可以直接用於 langchain AgentExecutor
  return tools;
}

// 範例 2: 根據用戶請求智能選擇工具
export async function handleUserRequest(userMessage: string) {
  const relevantTools = selectToolsForRequest(userMessage);
  console.log(`為請求 "${userMessage}" 選擇了 ${relevantTools.length} 個工具`);
  
  return relevantTools;
}

// 範例 3: 為 OpenAI Function Calling 生成定義
export async function setupOpenAIFunctionCalling() {
  const toolDefinitions = generateOpenAIToolDefinitions();
  console.log(`生成了 ${toolDefinitions.length} 個 OpenAI 工具定義`);
  
  return toolDefinitions;
}

// 範例 4: 搜尋特定工具
export async function findSpecificTools(query: string) {
  const foundTools = searchTools(query);
  console.log(`搜尋 "${query}" 找到 ${foundTools.length} 個工具`);
  
  return foundTools;
}

// 範例 5: 執行特定工具
export async function executeUnifiedTool(toolName: string, parameters: any) {
  const tool = allTools.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`找不到工具: ${toolName}`);
  }
  
  // 驗證參數
  if (tool.validator) {
    const validation = await tool.validator(parameters);
    if (!validation.isValid) {
      throw new Error(`參數驗證失敗: ${validation.reason}`);
    }
  }
  
  // 執行工具
  const result = await tool.handler(parameters);
  return result;
}