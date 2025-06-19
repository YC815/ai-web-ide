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
import type { FunctionDefinition, ExecutionContext } from '../functions/types.js';

/**
 * 將統一工具轉換為 Langchain DynamicTool
 */
export function convertToLangchainTool(functionDef: FunctionDefinition, context: ExecutionContext): DynamicTool {
  return new DynamicTool({
    name: functionDef.schema.name,
    description: functionDef.schema.description,
    func: async (input: string) => {
      try {
        console.log(`[LangChain綁定器] 工具調用: ${functionDef.schema.name}`, { input });
        
        // 解析輸入參數
        let parameters: Record<string, any>;
        try {
          // 嘗試解析為 JSON
          parameters = JSON.parse(input);
          console.log(`[LangChain綁定器] JSON 參數解析成功:`, parameters);

          // 強制修正：如果工具是 docker_list_directory 且參數為 input，則轉換為 dirPath
          if (functionDef.schema.name === 'docker_list_directory' && parameters.input !== undefined) {
            console.log(`[LangChain綁定器] 執行 docker_list_directory 參數強制修正：'input' -> 'dirPath'`);
            parameters.dirPath = parameters.input;
            delete parameters.input;
          }

        } catch {
          // 如果不是 JSON，根據工具類型進行智能參數解析
          console.log(`[LangChain綁定器] JSON 解析失敗，嘗試智能解析:`, { input, toolName: functionDef.schema.name });
          
          if (functionDef.schema.name === 'docker_list_directory') {
            // 專門處理 docker_list_directory 工具
            parameters = { input: input, dirPath: input };
          } else if (functionDef.schema.name.includes('file') && functionDef.schema.name.includes('read')) {
            // 處理讀取檔案工具
            parameters = { filePath: input };
          } else if (functionDef.schema.name.includes('directory') || functionDef.schema.name.includes('list')) {
            // 處理目錄列表工具
            parameters = { dirPath: input, directoryPath: input };
          } else {
            // 通用處理：提供多種可能的參數名稱
            parameters = { 
              input: input,
              path: input,
              filePath: input,
              dirPath: input,
              directoryPath: input
            };
          }
          console.log(`[LangChain綁定器] 智能解析結果:`, parameters);
        }

        // 驗證參數（如果有驗證器）
        if (functionDef.validator) {
          const validation = await functionDef.validator(parameters);
          if (!validation.isValid) {
            const error = `❌ 參數驗證失敗: ${validation.reason}`;
            console.error(`[LangChain綁定器] ${error}`, { parameters });
            return error;
          }
        }

        // 執行工具，並傳入上下文
        console.log(`[LangChain綁定器] 執行工具: ${functionDef.schema.name}`, { parameters, context });
        const result = await functionDef.handler(parameters, context);
        
        console.log(`[LangChain綁定器] 工具執行完成: ${functionDef.schema.name}`, { 
          success: true,
          resultType: typeof result,
          resultLength: Array.isArray(result) ? result.length : undefined
        });
        
        // 格式化結果
        if (typeof result === 'object') {
          return JSON.stringify(result, null, 2);
        }
        return String(result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 特殊處理斷路器異常 - 重新拋出而不是返回錯誤字符串
        if (errorMessage.includes('CIRCUIT BREAKER') || errorMessage.includes('🛑')) {
          console.error(`[LangChain綁定器] 斷路器異常: ${errorMessage}`, { 
            toolName: functionDef.schema.name, 
            input, 
            error 
          });
          throw error; // 重新拋出異常而不是返回字符串
        }
        
        const errorMsg = `❌ 工具執行失敗: ${errorMessage}`;
        console.error(`[LangChain綁定器] ${errorMsg}`, { 
          toolName: functionDef.schema.name, 
          input, 
          error 
        });
        return errorMsg;
      }
    }
  });
}

/**
 * 批量轉換所有工具
 */
export function convertAllToolsToLangchain(context: ExecutionContext): DynamicTool[] {
  return allTools.map(tool => convertToLangchainTool(tool, context));
}

/**
 * 按分類轉換工具
 */
export function convertToolsByCategoryToLangchain(category: string, context: ExecutionContext): DynamicTool[] {
  const categoryTools = toolsByCategory[category] || [];
  return categoryTools.map(tool => convertToLangchainTool(tool, context));
}

/**
 * 創建高優先級工具集合（用於 AI Agent）
 */
export function createHighPriorityToolsForAgent(context: ExecutionContext): DynamicTool[] {
  // 選擇最重要的工具
  const highPriorityCategories = ['ai', 'docker', 'project', 'filesystem'];
  const highPriorityTools: FunctionDefinition[] = [];

  for (const category of highPriorityCategories) {
    const categoryTools = toolsByCategory[category] || [];
    highPriorityTools.push(...categoryTools);
  }

  return highPriorityTools.map(tool => convertToLangchainTool(tool, context));
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
export function selectToolsForRequest(userMessage: string, context: ExecutionContext): DynamicTool[] {
  const message = userMessage.toLowerCase();
  const selectedTools: FunctionDefinition[] = [];

  // 根據關鍵字選擇工具
  if (message.includes('docker') || message.includes('容器')) {
    selectedTools.push(...(toolsByCategory.docker || []));
  }
  
  if (message.includes('檔案') || message.includes('file') || message.includes('read') || message.includes('write')) {
    selectedTools.push(...(toolsByCategory.filesystem || []));
  }
  
  // 🔧 Diff 工具關鍵字檢測
  if (message.includes('diff') || message.includes('patch') || message.includes('修改') || 
      message.includes('apply') || message.includes('變更') || message.includes('更新')) {
    // 優先選擇安全的 Docker diff 工具
    const diffTools = (toolsByCategory.utility || []).filter(tool => 
      tool.id.includes('diff') || tool.schema.name.includes('diff')
    );
    selectedTools.push(...diffTools);
    
    // 如果涉及 diff，也需要 Docker 工具
    selectedTools.push(...(toolsByCategory.docker || []));
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
  
  // 🔒 安全相關工具檢測
  if (message.includes('安全') || message.includes('security') || message.includes('驗證')) {
    const securityTools = (toolsByCategory.utility || []).filter(tool => 
      tool.id.includes('security') || tool.schema.description.includes('安全') ||
      tool.schema.description.includes('🔒')
    );
    selectedTools.push(...securityTools);
  }

  // 如果沒有匹配到特定工具，返回核心工具集
  if (selectedTools.length === 0) {
    // This part is tricky because createHighPriorityToolsForAgent now needs context.
    // Assuming context is available here.
    const highPriorityDynamicTools = createHighPriorityToolsForAgent(context);
    const highPriorityToolNames = highPriorityDynamicTools.map(t => t.name);
    const highPriorityDefs = allTools.filter(t => highPriorityToolNames.includes(t.schema.name));
    selectedTools.push(...highPriorityDefs);
  }

  // 去重並轉換
  const uniqueTools = Array.from(new Set(selectedTools));
  return uniqueTools.map(tool => convertToLangchainTool(tool, context));
}

export default {
  convertToLangchainTool,
  convertAllToolsToLangchain,
  convertToolsByCategoryToLangchain,
  createHighPriorityToolsForAgent,
  generateOpenAIToolDefinitions,
  selectToolsForRequest
};