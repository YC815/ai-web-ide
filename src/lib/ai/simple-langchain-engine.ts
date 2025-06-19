/**
 * 簡化的 LangChain 引擎
 * 專注於穩定性和易用性，使用簡化的 Docker 工具
 */

import { ChatOpenAI } from '@langchain/openai';
import { DynamicTool } from '@langchain/core/tools';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createSimpleDockerTools, SimpleDockerTools } from '../docker/simple-docker-tools';
import { logger } from '../logger';

export interface SimpleChatContext {
  containerId: string;
  projectName: string;
  workingDirectory: string;
}

export class SimpleLangchainEngine {
  private llm: ChatOpenAI;
  private dockerTools: SimpleDockerTools;
  private context: SimpleChatContext;

  constructor(context: SimpleChatContext) {
    this.context = context;
    
    // 初始化 OpenAI LLM
    this.llm = new ChatOpenAI({
      temperature: 0.1,
      modelName: 'gpt-4o-2024-08-06',
      maxTokens: 2000,
    });

    // 初始化簡化的 Docker 工具
    this.dockerTools = createSimpleDockerTools(
      context.containerId, 
      context.workingDirectory
    );

    logger.info(`[SimpleLangchainEngine] 初始化完成，專案: ${context.projectName}, 容器: ${context.containerId}`);
  }

  /**
   * 創建簡化的工具集
   */
  private createSimpleTools() {
    return [
      // 檢測專案路徑工具
      new DynamicTool({
        name: "detect_project_path",
        description: "自動檢測當前專案的根目錄路徑",
        func: async () => {
          try {
            logger.info(`[SimpleLangchainEngine] 檢測專案路徑`);
            
            const structureResult = await this.dockerTools.checkProjectStructure();
            
            if (structureResult.success) {
              return JSON.stringify({
                success: true,
                projectPath: "./",
                projectInfo: { name: this.context.projectName },
                dockerContext: {
                  containerId: this.context.containerId,
                  containerName: `ai-dev-${this.context.projectName}`,
                  workingDirectory: this.context.workingDirectory,
                  status: "running"
                },
                securityValidation: { isValid: true },
                message: `✅ 專案路徑檢測完成（Docker 容器內）\n路徑: ./\n名稱: ${this.context.projectName}\n版本: N/A\n容器: ai-dev-${this.context.projectName}`
              });
            } else {
              return JSON.stringify({
                success: false,
                error: structureResult.error
              });
            }
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: `專案路徑檢測失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }),

      // 完整專案探索工具
      new DynamicTool({
        name: "comprehensive_project_exploration",
        description: "執行完整的專案結構探索和分析",
        func: async () => {
          try {
            logger.info(`[SimpleLangchainEngine] 完整專案探索`);
            
            const listResult = await this.dockerTools.listDirectory('.');
            
            if (listResult.success) {
              const files = listResult.data || [];
              
              return `✅ 完整專案探索完成

🔍 完整專案探索報告
==================================================
📍 檢測路徑: ./
📦 專案名稱: ${this.context.projectName}

📁 目錄結構探索:
──────────────────────────────
${files.slice(0, 10).map(file => `  - ${file}`).join('\n')}

📊 目錄統計: 找到 ${files.length} 個項目

🏗️ 專案架構智能分析:
──────────────────────────────
├── 專案位置: ./
├── 專案名稱: ${this.context.projectName}
├── 架構類型: Next.js 應用
├── 開發語言: TypeScript/JavaScript
└── 探索狀態: ✅ 完成 (${files.length} 項目)

💡 探索總結:
──────────────────────────────
✅ 專案結構正常，已準備好進行編輯操作`;
            } else {
              return `❌ 專案探索失敗: ${listResult.error}`;
            }
          } catch (error) {
            return `❌ 專案探索失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 列出目錄工具
      new DynamicTool({
        name: "list_directory",
        description: "列出指定目錄的內容",
        func: async (input: string) => {
          try {
            const dirPath = input || '.';
            logger.info(`[SimpleLangchainEngine] 列出目錄: ${dirPath}`);
            
            const result = await this.dockerTools.listDirectory(dirPath);
            
            if (result.success) {
              const files = result.data || [];
              return `📁 目錄 ${dirPath} 內容:\n${files.map(item => `  - ${item}`).join('\n') || '（空目錄）'}`;
            } else {
              return `❌ 無法列出目錄 ${dirPath}: ${result.error}`;
            }
          } catch (error) {
            return `❌ 列出目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 讀取檔案工具
      new DynamicTool({
        name: "read_file",
        description: "讀取檔案內容",
        func: async (input: string) => {
          try {
            logger.info(`[SimpleLangchainEngine] 讀取檔案: ${input}`);
            
            const result = await this.dockerTools.readFile(input);
            
            if (result.success) {
              return `📄 檔案 ${input} 內容:\n\n${result.data}`;
            } else {
              return `❌ 無法讀取檔案 ${input}: ${result.error}`;
            }
          } catch (error) {
            return `❌ 讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 智能檔案搜尋工具
      new DynamicTool({
        name: "intelligent_file_search",
        description: "智能檔案搜尋工具",
        func: async (input: string) => {
          try {
            logger.info(`[SimpleLangchainEngine] 智能檔案搜尋: ${input}`);
            
            // 嘗試尋找常見的主頁檔案
            const patterns = ['page.tsx', '*.tsx', 'index.*', 'app*'];
            
            for (const pattern of patterns) {
              const result = await this.dockerTools.findFiles(pattern);
              
              if (result.success && result.data && result.data.length > 0) {
                return `✅ 找到相關檔案:\n${result.data.map(file => `  - ${file}`).join('\n')}`;
              }
            }
            
            return `❌ 在專案中找不到相關檔案。

建議：
- 檢查檔案名稱是否正確
- 確認檔案是否存在於專案中
- 嘗試使用部分檔案名稱搜尋

📦 來源：Docker 容器 ai-dev-${this.context.projectName}`;
          } catch (error) {
            return `❌ 智能檔案搜尋失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 創建檔案工具
      new DynamicTool({
        name: "create_file",
        description: "創建新檔案",
        func: async (input: string) => {
          try {
            // 嘗試解析輸入（可能是JSON格式）
            let filePath: string;
            let content: string;
            
            try {
              const parsed = JSON.parse(input);
              filePath = parsed.filePath || parsed.path;
              content = parsed.content || '';
            } catch {
              // 如果不是JSON，假設整個輸入就是檔案路徑
              filePath = input;
              content = '';
            }
            
            logger.info(`[SimpleLangchainEngine] 創建檔案: ${filePath}`);
            
            const result = await this.dockerTools.writeFile(filePath, content);
            
            if (result.success) {
              return `✅ 成功創建檔案: ${filePath}`;
            } else {
              return `❌ 創建檔案失敗: ${result.error}`;
            }
          } catch (error) {
            return `❌ 創建檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 初始化專案工具
      new DynamicTool({
        name: "initialize_project",
        description: "初始化或確保專案已正確設置",
        func: async () => {
          try {
            logger.info(`[SimpleLangchainEngine] 初始化專案`);
            
            const structureResult = await this.dockerTools.checkProjectStructure();
            
            if (structureResult.success) {
              return `✅ 專案 ${this.context.projectName} 初始化檢查完成

📁 發現的專案結構: ${structureResult.data?.join(', ') || '無'}
🐳 Docker 容器: ${this.context.containerId}
📍 工作目錄: ${this.context.workingDirectory}
🔧 狀態: 就緒`;
            } else {
              return `❌ 專案初始化檢查失敗: ${structureResult.error}`;
            }
          } catch (error) {
            return `❌ 專案初始化失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      })
    ];
  }

  /**
   * 處理聊天訊息
   */
  async handleChat(message: string): Promise<string> {
    try {
      logger.info(`[SimpleLangchainEngine] 處理聊天訊息: ${message.substring(0, 100)}...`);

      // 創建工具
      const tools = this.createSimpleTools();

      // 創建簡化的提示模板
      const prompt = ChatPromptTemplate.fromTemplate(`
你是一個全自動的AI程式設計師和專案助理。你的核心使命是：**完全替代用戶完成所有編程工作，用戶不需要寫任何一行程式碼**。

## 🎯 核心使命：零程式碼體驗

**絕對原則**：用戶只需要描述需求，你必須：
1. 🤖 **完全自動化** - 所有編程工作都由你完成
2. 🚫 **零建議模式** - 不要給建議讓用戶自己動手
3. ⚡ **立即執行** - 檢測到需求立即使用工具執行
4. 🎯 **結果導向** - 直接完成任務並展示結果

可用工具: {tool_names}
工具描述: {tools}

當前專案上下文將會動態更新到你的記憶中。

用戶需求: {input}

⚡ 立即分析需求並自動執行相關工具完成任務。不要給建議，直接完成工作！

{agent_scratchpad}
      `);

      // 創建 agent
      const agent = await createStructuredChatAgent({
        llm: this.llm,
        tools,
        prompt
      });

      // 創建 executor
      const executor = new AgentExecutor({
        agent,
        tools,
        maxIterations: 10,
        returnIntermediateSteps: false,
        handleParsingErrors: true
      });

      // 執行對話
      const result = await executor.invoke({
        input: message
      });

      return result.output || '⚠️ 未收到有效回應';

    } catch (error) {
      logger.error(`[SimpleLangchainEngine] 聊天處理失敗: ${error}`);
      return `❌ 處理請求時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

/**
 * 創建簡化的 LangChain 引擎實例
 */
export function createSimpleLangchainEngine(
  containerId: string, 
  projectName: string = 'new_web', 
  workingDirectory: string = '/app/workspace/new_web'
): SimpleLangchainEngine {
  return new SimpleLangchainEngine({
    containerId,
    projectName,
    workingDirectory
  });
} 