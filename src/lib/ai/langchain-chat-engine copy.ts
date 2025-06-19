// Langchain 聊天引擎 - 高品質重構版本
// 專注於上下文管理、tool 調用和自動決策
// 
// @deprecated 此模組已棄用，請使用新的 aiChatSession 工具
// 位置：src/lib/functions/ai/index.ts
// 遷移指南：docs/unified-function-call-system.md

import { ChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { 
  AgentExecutor, 
  createStructuredChatAgent
} from "langchain/agents";
import { 
  RunnableSequence, 
  RunnablePassthrough,
  RunnableLambda
} from "@langchain/core/runnables";
import {
  ChatPromptTemplate
} from "@langchain/core/prompts";
import { DynamicTool, Tool } from "@langchain/core/tools";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

// 引入現有的工具和上下文管理
import { createAIContextManager, ProjectContext } from './context-manager';
import { createDockerToolkit, createDefaultDockerContext } from '../docker/tools';
import { DockerSecurityValidator } from './docker-security-validator';

// 統一 Function Call 系統整合
// 注意：這些導入可能不存在，因為 langchain-binder 還未實現
// import { 
//   createHighPriorityToolsForAgent,
//   selectToolsForRequest,
//   convertToLangchainTool 
// } from '../functions/langchain-binder';
// import { allTools, toolsByCategory } from '../functions/index';

// 嚴格定義類型，替換 any
export interface ToolCallResult {
  tool: string;
  input: string | Record<string, unknown> | unknown[];
  output: string | Record<string, unknown> | unknown[];
  success: boolean;
  duration?: number;
  timestamp?: string;
}

export interface ThoughtProcess {
  reasoning: string;
  decision: 'continue_tools' | 'respond_to_user' | 'need_input';
  confidence: number;
  contextUsed?: string[];
  decisionFactors?: string[];
}

export interface ContextUpdate {
  added: string[];
  updated: string[];
  memoryTokens: number;
  vectorDocuments?: number;
  knowledgeExtracted?: string[];
}

export interface SessionStats {
  activeSessions: number;
  totalMemoryUsage: number;
  oldestSession?: string;
  sessionAge?: string;
  totalMessages?: number;
  totalTokens?: number;
}

export interface LangchainChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  sessionId: string;
  projectContext: ProjectContext;
  memory: BufferMemory;
  vectorStore: MemoryVectorStore;
  agent: AgentExecutor;
  lastActivity: Date;
  createdAt: Date;
  messageCount: number;
  tokenCount: number;
}

export interface LangchainChatResponse {
  message: string;
  toolCalls?: ToolCallResult[];
  thoughtProcess?: ThoughtProcess;
  contextUpdate?: ContextUpdate;
  autoActions?: string[];
  needsUserInput?: boolean;
  sessionInfo?: {
    sessionId: string;
    messageCount: number;
    tokenCount: number;
    sessionAge: string;
  };
  error?: string;
}

/**
 * Langchain 聊天引擎 - 高品質重構版本
 * 專注於上下文管理、工具調用自動化和智能決策
 */
export class LangchainChatEngine {
  private sessions = new Map<string, ChatSession>();
  private model: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private securityValidator: DockerSecurityValidator;
  private maxRetries = 3;
  private contextWindow = 20; // 保留最近 20 條訊息

  constructor(private apiKey: string, private options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}) {
    this.model = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: options.model || "gpt-4o",
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 4000,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
    });

    this.securityValidator = DockerSecurityValidator.getInstance();
  }

  /**
   * 創建或獲取聊天會話 - 增強的上下文管理
   */
  async getOrCreateSession(sessionId: string, projectContext: ProjectContext): Promise<ChatSession> {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      
      console.log(`🔄 載入現有會話: ${sessionId} (訊息數: ${session.messageCount}, Token數: ${session.tokenCount})`);
      
      // 更新專案上下文以確保最新狀態
      session.projectContext = projectContext;
      await this.updateProjectContext(session);
      
      return session;
    }

    console.log(`🚀 創建新的 Langchain 聊天會話: ${sessionId}`);
    
    // 創建記憶體管理 - 使用 BufferMemory 替代已棄用的 ConversationBufferWindowMemory
    const memory = new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
      outputKey: "output",
      inputKey: "input",
    });

    // 創建向量存儲用於專案上下文
    const vectorStore = new MemoryVectorStore(this.embeddings);

    // 創建專案工具
    const tools = await this.createProjectTools(projectContext);

    // 創建智能代理
    const agent = await this.createIntelligentAgent(tools, memory, vectorStore);

    const session: ChatSession = {
      sessionId,
      projectContext,
      memory,
      vectorStore,
      agent,
      lastActivity: new Date(),
      createdAt: new Date(),
      messageCount: 0,
      tokenCount: 0
    };

    this.sessions.set(sessionId, session);

    // 初始化專案上下文到向量存儲
    await this.initializeProjectContext(session);

    console.log(`✅ 會話創建完成: ${sessionId}`);
    return session;
  }

  /**
   * 處理用戶訊息 - 智能決策和自動執行
   */
  async processMessage(
    sessionId: string, 
    userMessage: string, 
    projectContext: ProjectContext
  ): Promise<LangchainChatResponse> {
    try {
      const session = await this.getOrCreateSession(sessionId, projectContext);
      console.log(`💬 Langchain 處理訊息: ${userMessage}`);

      // 增加訊息計數和 token 估算
      session.messageCount++;
      const estimatedTokens = this.estimateTokens(userMessage);
      session.tokenCount += estimatedTokens;

      // 保存用戶訊息到記憶體
      await this.addMessageToMemory(session, userMessage, 'user');

      // 更新專案上下文
      await this.updateProjectContext(session);

      // 使用智能決策鏈處理訊息
      const result = await this.processWithIntelligentDecision(session, userMessage);

      // 保存 AI 回應到記憶體
      if (result.message) {
        await this.addMessageToMemory(session, result.message, 'assistant');
        const responseTokens = this.estimateTokens(result.message);
        session.tokenCount += responseTokens;
      }

      // 添加會話資訊到回應
      result.sessionInfo = {
        sessionId,
        messageCount: session.messageCount,
        tokenCount: session.tokenCount,
        sessionAge: this.formatDuration(Date.now() - session.createdAt.getTime())
      };

      return result;

    } catch (error) {
      console.error('Langchain 聊天引擎錯誤:', error);
      return {
        message: `❌ 處理訊息時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        needsUserInput: false
      };
    }
  }

  /**
   * 添加訊息到記憶體和向量存儲
   */
  private async addMessageToMemory(
    session: ChatSession, 
    message: string, 
    role: 'user' | 'assistant'
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      
      // 添加到向量存儲以支援相似性搜尋
      await session.vectorStore.addDocuments([
        new Document({
          pageContent: `${role === 'user' ? '用戶' : 'AI'}: ${message}`,
          metadata: { 
            type: `${role}_message`,
            timestamp,
            sessionId: session.sessionId,
            role
          }
        })
      ]);

      console.log(`📝 已保存${role === 'user' ? '用戶' : 'AI'}訊息到上下文存儲`);
    } catch (error) {
      console.error('❌ 保存訊息到記憶體失敗:', error);
    }
  }

  /**
   * 估算 token 數量
   */
  private estimateTokens(text: string): number {
    // 簡單估算：1 token ≈ 4 字符（英文）或 1.5 字符（中文）
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 格式化持續時間
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天${hours % 24}小時`;
    if (hours > 0) return `${hours}小時${minutes % 60}分鐘`;
    return `${minutes}分鐘`;
  }

  /**
   * 標準化專案名稱：將短橫線轉換為底線
   * 這是因為容器內的實際目錄使用底線格式
   */
  private normalizeProjectName(projectName: string): string {
    return projectName.replace(/-/g, '_');
  }

  /**
   * 智能決策處理流程
   */
  private async processWithIntelligentDecision(
    session: ChatSession, 
    userMessage: string
  ): Promise<LangchainChatResponse> {
    let retryCount = 0;
    let lastError: string | undefined;
    const toolCalls: ToolCallResult[] = [];
    const autoActions: string[] = [];

    // 創建智能決策鏈
    const decisionChain = await this.createDecisionChain(session);

    while (retryCount < this.maxRetries) {
      try {
        console.log(`🔄 決策循環 #${retryCount + 1}`);

        // Step 1: 智能分析和決策
        const decision = await this.makeIntelligentDecision(
          session, 
          userMessage, 
          lastError,
          retryCount
        );

        console.log('🧠 AI 決策:', decision);

        // Step 2: 根據決策執行行動
        if (decision.decision === 'continue_tools') {
          // 繼續使用工具
          const toolResult = await this.executeToolsWithRetry(session, userMessage, retryCount);
          toolCalls.push(...toolResult.toolCalls);
          autoActions.push(...toolResult.actions);

          if (toolResult.success) {
            // 工具執行成功，檢查是否需要繼續
            const shouldContinue = await this.shouldContinueWithTools(session, toolResult.output);
            if (!shouldContinue) {
              return {
                message: `✅ 任務完成！${toolResult.output}`,
                toolCalls,
                thoughtProcess: decision,
                autoActions,
                needsUserInput: false,
                contextUpdate: {
                  added: [`工具執行: ${toolCalls.length} 次`],
                  updated: ['專案狀態'],
                  memoryTokens: session.tokenCount,
                  vectorDocuments: toolCalls.length
                }
              };
            }
          } else {
            lastError = toolResult.error;
            retryCount++;
            continue;
          }
        } else if (decision.decision === 'respond_to_user') {
          // 直接回應用戶
          const relevantContext = await this.getRelevantContext(session, userMessage);
          const response = await decisionChain.invoke({
            input: userMessage,
            context: relevantContext
          });

          return {
            message: response.output,
            thoughtProcess: {
              ...decision,
              contextUsed: relevantContext ? [relevantContext.substring(0, 100) + '...'] : []
            },
            autoActions,
            toolCalls,
            needsUserInput: false,
            contextUpdate: {
              added: ['AI 回應'],
              updated: ['對話歷史'],
              memoryTokens: session.tokenCount
            }
          };
        } else {
          // 需要用戶輸入
          return {
            message: decision.reasoning,
            thoughtProcess: decision,
            autoActions,
            toolCalls,
            needsUserInput: true
          };
        }

        break;

      } catch (error) {
        console.error(`❌ 決策循環 #${retryCount + 1} 失敗:`, error);
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retryCount++;
        
        if (retryCount >= this.maxRetries) {
          return {
            message: `❌ 經過 ${this.maxRetries} 次重試後仍無法完成任務。最後錯誤: ${lastError}`,
            error: lastError,
            toolCalls,
            autoActions,
            needsUserInput: false
          };
        }
      }
    }

    return {
      message: '⚠️ 處理完成，但可能未達到預期結果',
      toolCalls,
      autoActions,
      needsUserInput: false
    };
  }

  /**
   * 智能決策 - 分析是否需要工具、重試或回應
   */
  private async makeIntelligentDecision(
    session: ChatSession,
    userMessage: string,
    lastError?: string,
    retryCount: number = 0
  ): Promise<{
    reasoning: string;
    decision: 'continue_tools' | 'respond_to_user' | 'need_input';
    confidence: number;
  }> {
    const decisionPrompt = ChatPromptTemplate.fromMessages([
      ["system", `你是一個全自動程式設計師的決策引擎。你的使命是最大化工具使用，最小化純文字回應。

        當前狀況:
        - 重試次數: {retryCount}/3
        - 上次錯誤: {lastError}
        - 專案上下文: {projectContext}
        
        決策選項:
        1. continue_tools: 使用工具來完成任務（**強烈優先**）
        2. respond_to_user: 直接回應（僅限任務已完全完成）
        3. need_input: 需要更多資訊（極少使用）
        
        **決策優先級**（按重要性排序）:
        1. **檔案編輯需求** → continue_tools（修改、創建、更新檔案）
        2. **專案探索需求** → continue_tools（查看、分析、探索專案）
        3. **檔案搜尋需求** → continue_tools（查找、顯示特定檔案）
        4. **技術實現需求** → continue_tools（添加功能、修復錯誤）
        5. **已完成任務** → respond_to_user（僅當工具已執行完成）
        
        **強制使用工具的關鍵詞**:
        - 修改、改成、更改、編輯、調整、優化
        - 創建、添加、新增、加入
        - 查看、看看、顯示、探索、分析
        - 主頁、檔案、專案、結構
        - 把...改成、讓...變成、將...修改為
        
        **判斷規則**:
        - 🎯 **預設選擇 continue_tools** - 除非任務已100%完成
        - ✅ 只有在工具已成功執行且任務完全完成時才選 respond_to_user
        - 🔄 錯誤或失敗時必須選 continue_tools 重試
        - ❌ 絕不因為"可能需要用戶確認"而選 respond_to_user
        
        請提供:
        1. reasoning: 分析用戶需求類型和所需工具
        2. decision: 決策（強烈傾向 continue_tools）
        3. confidence: 信心度 (0-1)
        
        以 JSON 格式回應。`],
      ["human", "用戶需求: {userMessage}\n\n分析是否需要使用工具來完成這個需求。傾向於使用工具而不是純文字回應。"]
    ]);

    const decisionChain = decisionPrompt.pipe(this.model).pipe(new StringOutputParser());

    const projectSnapshot = await this.getProjectSnapshot(session);
    
    const result = await decisionChain.invoke({
      userMessage,
      retryCount,
      lastError: lastError || '無',
      projectContext: JSON.stringify(projectSnapshot, null, 2)
    });

    try {
      return JSON.parse(result);
    } catch {
      // 如果解析失敗，使用預設決策
      return {
        reasoning: `分析用戶請求: ${userMessage}`,
        decision: retryCount === 0 ? 'continue_tools' : 'respond_to_user',
        confidence: 0.5
      };
    }
  }

  /**
   * 執行工具並處理重試
   */
  private async executeToolsWithRetry(
    session: ChatSession,
    userMessage: string,
    retryCount: number
  ): Promise<{
    success: boolean;
    output: string;
    error?: string;
    toolCalls: ToolCallResult[];
    actions: string[];
  }> {
    try {
      const startTime = Date.now();
      
      // 獲取 session 中已有的工具列表和描述
      const agentTools = session.agent.tools || [];
      const toolNames = agentTools.map(tool => tool.name).join(", ");
      const toolDescriptions = agentTools.map(tool => `${tool.name}: ${tool.description || ''}`).join("\n");
      
      const result = await session.agent.invoke({
        input: userMessage,
        chat_history: await session.memory.chatHistory.getMessages(),
        tool_names: toolNames,
        tools: toolDescriptions,
        agent_scratchpad: ""
      });

      // 將 intermediateSteps 轉換為 ToolCallResult
      const toolCalls: ToolCallResult[] = (result.intermediateSteps || []).map((step: unknown, index: number) => {
        const duration = Date.now() - startTime;
        return {
          tool: `tool_${index}`,
          input: typeof step === 'object' && step !== null ? step : String(step),
          output: result.output || '',
          success: true,
          duration,
          timestamp: new Date().toISOString()
        };
      });

      return {
        success: true,
        output: result.output,
        toolCalls,
        actions: [`執行代理工具 (嘗試 ${retryCount + 1})`]
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Tool execution failed',
        toolCalls: [],
        actions: [`工具執行失敗 (嘗試 ${retryCount + 1})`]
      };
    }
  }

  /**
   * 判斷是否需要繼續使用工具
   */
  private async shouldContinueWithTools(session: ChatSession, output: string): Promise<boolean> {
    // 檢查明確的完成信號
    const completeKeywords = ['✅', '成功', '完成', '建立', '創建', '已經', '修改完成', '檔案創建成功'];
    const continueKeywords = ['❌', '錯誤', '失敗', '無法', '需要', '問題', '重試'];
    
    const lowerOutput = output.toLowerCase();
    
    // 如果輸出包含成功標記，則認為任務完成
    const hasCompleteSignal = completeKeywords.some(keyword => 
      lowerOutput.includes(keyword.toLowerCase()) || output.includes(keyword)
    );
    
    // 如果輸出包含錯誤標記，則需要繼續
    const hasContinueSignal = continueKeywords.some(keyword => 
      lowerOutput.includes(keyword.toLowerCase()) || output.includes(keyword)
    );
    
    // 特別檢查檔案操作成功的情況
    if (output.includes('檔案') && (output.includes('創建成功') || output.includes('修改成功'))) {
      return false; // 檔案操作成功，不需要繼續
    }
    
    // 如果有明確的完成信號且沒有錯誤信號，則停止
    if (hasCompleteSignal && !hasContinueSignal) {
      return false;
    }
    
    // 如果有錯誤信號，則繼續
    if (hasContinueSignal) {
      return true;
    }
    
    // 預設情況下，如果沒有明確信號，則不繼續（避免無限循環）
    return false;
  }

  /**
   * 創建專案工具 - 重構版本
   */
  private async createProjectTools(projectContext: ProjectContext): Promise<Tool[]> {
    const normalizedProjectName = this.normalizeProjectName(projectContext.projectName);
    
    // 創建默認的 Docker 上下文，因為 ProjectContext 中沒有 dockerContext 欄位
    const dockerContext = {
      containerId: projectContext.containerId || `ai-web-ide-${normalizedProjectName}`,
      containerName: `ai-dev-${normalizedProjectName}`,
      workingDirectory: `/app/workspace/${normalizedProjectName}`,
      status: projectContext.containerStatus
    };
    
    console.log(`[LangchainChatEngine] 🐳 創建 Docker 上下文:`, {
      containerId: dockerContext.containerId,
      containerName: dockerContext.containerName,
      workingDirectory: dockerContext.workingDirectory,
      status: dockerContext.status
    });
    
    // 創建通用工具包
    const toolkit = {
      fileSystem: {
        readFile: async (path: string) => {
          // 驗證檔案路徑安全性
          const validation = this.securityValidator.validateFilePath(path, dockerContext, normalizedProjectName);
          if (!validation.isValid) {
            return { success: false, error: validation.reason };
          }
          
          try {
            // 直接調用 Docker 工具進行檔案讀取，而不是透過 securityValidator
            const { createDockerToolkit } = await import('../docker/tools');
            const toolkit = createDockerToolkit(dockerContext);
            const result = await toolkit.fileSystem.readFile(path);
            return { success: result.success, data: result.data, error: result.error };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        },
        
        listDirectory: async (path: string) => {
          // 驗證目錄路徑安全性
          const validation = this.securityValidator.validateDirectoryPath(path, dockerContext, normalizedProjectName);
          if (!validation.isValid) {
            return { success: false, error: validation.reason };
          }
          
          try {
            // 直接調用 Docker 工具進行目錄列表，而不是透過 securityValidator
            const { createDockerToolkit } = await import('../docker/tools');
            const toolkit = createDockerToolkit(dockerContext);
            const result = await toolkit.fileSystem.listDirectory(path);
            return { success: result.success, data: result.data, error: result.error };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        },
        
        writeFile: async (path: string, content: string) => {
          // 驗證檔案路徑安全性
          const validation = this.securityValidator.validateFilePath(path, dockerContext, normalizedProjectName);
          if (!validation.isValid) {
            return { success: false, error: validation.reason };
          }
          
          try {
            // 直接調用 Docker 工具進行檔案寫入，而不是透過 securityValidator
            const { createDockerToolkit } = await import('../docker/tools');
            const toolkit = createDockerToolkit(dockerContext);
            const result = await toolkit.fileSystem.writeFile(path, content);
            return { success: result.success, error: result.error };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        }
      }
    };

    const tools = [
      // 專案路徑檢測工具
      new DynamicTool({
        name: "detect_project_path",
        description: "自動檢測當前專案的根目錄路徑",
        func: async () => {
          try {
            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const projectPath = await this.detectProjectPath(toolkit);
            const projectInfo = await this.getProjectInfo(toolkit, projectPath);
            
            return JSON.stringify({
              success: true,
              projectPath,
              projectInfo,
              dockerContext: {
                containerId: dockerContext.containerId,
                containerName: dockerContext.containerName,
                workingDirectory: dockerContext.workingDirectory,
                status: dockerContext.status
              },
              securityValidation: dockerValidation,
              message: `✅ 專案路徑檢測完成（Docker 容器內）\n路徑: ${projectPath}\n名稱: ${projectInfo.name}\n版本: ${projectInfo.version || 'N/A'}\n容器: ${dockerContext.containerName || dockerContext.containerId}`
            });
          } catch (error) {
            return `❌ 專案路徑檢測失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 完整專案探索工具
      new DynamicTool({
        name: "comprehensive_project_exploration",
        description: "執行完整的專案結構探索和分析",
        func: async () => {
          try {
            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const projectPath = await this.detectProjectPath(toolkit);
            const projectInfo = await this.getProjectInfo(toolkit, projectPath);
            const explorationResult = await this.performComprehensiveExploration(toolkit, projectInfo.name);
            
            return `✅ 完整專案探索完成\n\n🔍 完整專案探索報告\n${'='.repeat(50)}\n📍 檢測路徑: ${projectPath}\n📦 專案名稱: ${projectInfo.name}\n\n${explorationResult}`;
          } catch (error) {
            return `❌ 專案探索失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 簡化的目錄列表工具
      new DynamicTool({
        name: "list_directory",
        description: "列出指定目錄的內容",
        func: async (input: string) => {
          try {
            let path = input || '.';
            if (typeof input === 'object' && input !== null && 'path' in (input as object)) {
              path = (input as any).path || '.';
            }

            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const result = await toolkit.fileSystem.listDirectory(path);
            if (!result.success) {
              return `❌ 無法列出目錄 ${path}: ${result.error}`;
            }

            return `📁 目錄 ${path} 內容:\n${result.data?.map(item => `  - ${item}`).join('\n') || '（空目錄）'}`;
          } catch (error) {
            return `❌ 列出目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 專案初始化工具
      new DynamicTool({
        name: "initialize_project",
        description: "初始化或確保專案已正確設置",
        func: async () => {
          try {
            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const projectPath = await this.detectProjectPath(toolkit);
            const packageJsonPath = `${projectPath}/package.json`.replace(/\/+/g, '/');
            
            console.log('🔍 開始檢測專案路徑...');
            console.log('📁 檢查當前工作目錄是否包含 package.json...');
            
            const result = await toolkit.fileSystem.readFile(packageJsonPath);
            if (result.success) {
              return `✅ 專案已正確初始化\n路徑: ${projectPath}\n配置: package.json 存在`;
            } else {
              console.log('❌ 當前目錄未找到 package.json');
              return `⚠️ 專案可能尚未初始化（在 ${projectPath} 找不到 package.json）`;
            }
          } catch (error) {
            return `❌ 專案初始化檢查失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 檔案讀取工具
      new DynamicTool({
        name: "read_file",
        description: "讀取檔案內容",
        func: async (input: string) => {
          try {
            let filePath = input;
            if (typeof input === 'object' && input !== null && 'path' in (input as object)) {
              filePath = (input as any).path;
            }

            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const result = await toolkit.fileSystem.readFile(filePath);
            if (!result.success) {
              return `❌ 無法讀取檔案 ${filePath}: ${result.error}`;
            }

            return `📄 檔案: ${filePath}\n\`\`\`\n${result.data}\n\`\`\``;
          } catch (error) {
            return `❌ 讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 檔案創建工具
      new DynamicTool({
        name: "create_file",
        description: "創建新檔案",
        func: async (input: string) => {
          try {
            let filePath = '';
            let content = '';
            
            if (typeof input === 'string') {
              // 支援 'path|content' 格式
              const parts = input.split('|');
              if (parts.length >= 2) {
                filePath = parts[0].trim();
                content = parts.slice(1).join('|').trim();
              } else {
                return `❌ 無效格式。請使用 'path|content' 格式`;
              }
            } else if (typeof input === 'object' && input !== null) {
              const obj = input as any;
              filePath = obj.path || '';
              content = obj.content || '';
            }

            if (!filePath || !content) {
              return `❌ 缺少必要參數：檔案路徑或內容`;
            }

            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }

            const result = await toolkit.fileSystem.writeFile(filePath, content);
            if (!result.success) {
              return `❌ 無法創建檔案 ${filePath}: ${result.error}`;
            }

            return `✅ 檔案創建成功: ${filePath}\n📄 內容已寫入 ${content.length} 個字符`;
          } catch (error) {
            return `❌ 創建檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 智能檔案搜尋工具 - 簡化版本
      new DynamicTool({
        name: "intelligent_file_search",
        description: "智能檔案搜尋工具",
        func: async (input: string) => {
          try {
            const dockerValidation = this.securityValidator.validateDockerContext(dockerContext, normalizedProjectName);
            if (!dockerValidation.isValid) {
              return `❌ Docker 安全驗證失敗: ${dockerValidation.reason}`;
            }
            
            // 簡化輸入處理
            let searchQuery = input;
            if (typeof input === 'object' && input !== null) {
              const obj = input as any;
              searchQuery = obj.query || obj.file_name || obj.filename || '';
            }
            
            if (!searchQuery || typeof searchQuery !== 'string') {
              return '❌ 請提供搜尋關鍵詞';
            }
            
            console.log(`🔍 智能檔案搜尋: "${searchQuery}"`);
            
            // 提取檔案名稱
            const fileName = this.extractFileName(searchQuery);
            if (!fileName) {
              return `❌ 無法從 "${searchQuery}" 中識別檔案名稱\n\n💡 建議格式：\n- "查看 page.tsx"\n- "主頁檔案"\n- "配置檔案"`;
            }
            
            console.log(`📝 提取檔案名稱: "${fileName}"`);
            
            // 執行搜尋
            const searchResult = await this.performIntelligentFileSearch(toolkit, fileName);
            return `${searchResult}\n\n📦 來源：Docker 容器 ${dockerContext.containerName || dockerContext.containerId}`;
          } catch (error) {
            return `❌ 智能檔案搜尋失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      })
    ];

    console.log(`🔧 創建了 ${tools.length} 個專案工具`);
    return tools;
  }

  /**
   * 自動檢測專案根目錄路徑 - 修正版本
   */
  private async detectProjectPath(toolkit: { fileSystem: { readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>; listDirectory: (path: string) => Promise<{ success: boolean; data?: string[]; error?: string }> } }): Promise<string> {
    console.log('🔍 開始檢測專案路徑...');
    
    try {
      // 1. 首先嘗試當前工作目錄
      console.log('📁 檢查當前工作目錄是否包含 package.json...');
      const currentDirResult = await toolkit.fileSystem.readFile('./package.json');
      if (currentDirResult.success) {
        console.log('✅ 在當前目錄找到 package.json');
        return './';
      }
      console.log('❌ 當前目錄未找到 package.json');
    } catch (error) {
      console.log('❌ 檢查當前目錄時出錯:', error);
    }

    try {
      // 2. 檢查 /app 目錄是否包含 package.json
      console.log('📁 檢查 /app 目錄...');
      const appDirResult = await toolkit.fileSystem.readFile('/app/package.json');
      if (appDirResult.success) {
        console.log('✅ 在 /app 目錄找到 package.json');
        return '/app';
      }
      console.log('❌ /app 目錄未找到 package.json');
    } catch (error) {
      console.log('❌ 檢查 /app 目錄時出錯:', error);
    }

    try {
      // 3. 探索 /app/workspace 目錄下的所有子目錄
      console.log('📁 探索 /app/workspace 目錄...');
      const workspaceResult = await toolkit.fileSystem.listDirectory('/app/workspace');
      
      if (workspaceResult.success && workspaceResult.data && workspaceResult.data.length > 0) {
        console.log(`📂 找到 ${workspaceResult.data.length} 個工作區目錄:`, workspaceResult.data);
        
        // 嘗試每個子目錄
        for (const subDir of workspaceResult.data) {
          try {
            const projectPath = `/app/workspace/${subDir}`;
            console.log(`🔍 檢查專案目錄: ${projectPath}`);
            
            const packageResult = await toolkit.fileSystem.readFile(`${projectPath}/package.json`);
            if (packageResult.success) {
              console.log(`✅ 在 ${projectPath} 找到 package.json`);
              return projectPath;
            } else {
              console.log(`❌ ${projectPath} 未找到 package.json`);
            }
          } catch (error) {
            console.log(`❌ 檢查 ${subDir} 時出錯:`, error);
          }
        }
      } else {
        console.log('❌ /app/workspace 目錄為空或不存在');
      }
    } catch (error) {
      console.log('❌ 探索 /app/workspace 時出錯:', error);
    }

    try {
      // 4. 最後嘗試直接使用專案名稱構建路徑
      const projectContext = this.sessions.values().next().value?.projectContext;
      if (projectContext?.projectName) {
        // 嘗試多種專案名稱格式，重點是標準化的底線格式
        const projectNameVariants = [
          this.normalizeProjectName(projectContext.projectName), // 優先使用標準化格式
          projectContext.projectName,
          projectContext.projectName.replace(/_/g, '-'), // 底線轉短橫線
          projectContext.projectName.toLowerCase(),
          this.normalizeProjectName(projectContext.projectName.toLowerCase()),
          projectContext.projectName.toLowerCase().replace(/_/g, '-')
        ];

        for (const variant of projectNameVariants) {
          try {
            const projectPath = `/app/workspace/${variant}`;
            console.log(`🔍 嘗試專案名稱變體: ${projectPath}`);
            
            const packageResult = await toolkit.fileSystem.readFile(`${projectPath}/package.json`);
            if (packageResult.success) {
              console.log(`✅ 使用專案名稱變體找到路徑: ${projectPath}`);
              return projectPath;
            }
          } catch {
            // 繼續嘗試下一個變體
          }
        }
      }
    } catch (error) {
      console.log('❌ 使用專案名稱構建路徑時出錯:', error);
    }

    // 5. 如果都失敗了，回退到當前目錄
    console.log('⚠️ 所有路徑檢測都失敗，回退到當前目錄');
    return './';
  }

  /**
   * 從 package.json 提取專案資訊
   */
  private async getProjectInfo(toolkit: { fileSystem: { readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }> } }, projectPath: string): Promise<{ name: string; description?: string; version?: string }> {
    try {
      const packagePath = projectPath.endsWith('/') ? `${projectPath}package.json` : `${projectPath}/package.json`;
      const result = await toolkit.fileSystem.readFile(packagePath);
      if (result.success && result.data) {
        const packageJson = JSON.parse(result.data);
        return {
          name: packageJson.name || 'unknown-project',
          description: packageJson.description,
          version: packageJson.version
        };
      }
    } catch (error) {
      console.log('無法讀取 package.json:', error);
    }
    
    return { name: 'unknown-project' };
  }

  /**
   * 完整專案探索 - 簡化版本
   */
  private async performComprehensiveExploration(
    toolkit: { 
      fileSystem: { 
        readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>; 
        listDirectory: (path: string) => Promise<{ success: boolean; data?: string[]; error?: string }> 
      } 
    }, 
    projectName?: string
  ): Promise<string> {
    const explorationResults: string[] = [];
    
    console.log(`🔍 開始專案探索，專案名稱: ${projectName}`);
    
    const projectPath = await this.detectProjectPath(toolkit);
    const projectInfo = await this.getProjectInfo(toolkit, projectPath);
    
    // 構建目錄路徑的輔助函數
    const getDirectoryPath = (subDir: string) => {
      if (!subDir) return projectPath;
      return `${projectPath}/${subDir}`.replace(/\/+/g, '/');
    };

    // 1. 探索重要目錄
    explorationResults.push('📁 目錄結構探索:');
    explorationResults.push('─'.repeat(30));
    
    const importantDirectories = [
      'src', 'app', 'pages', 'components', 'lib', 'public', 'docs', 'styles', 'utils'
    ];
    
    let foundDirectories = 0;
    for (const dir of importantDirectories) {
      try {
        const dirPath = getDirectoryPath(dir);
        const result = await toolkit.fileSystem.listDirectory(dirPath);
        
        if (result.success && result.data && result.data.length > 0) {
          foundDirectories++;
          explorationResults.push(`📂 ${dir}/ (${result.data.length} 項目)`);
          
          // 顯示前幾個重要項目
          const importantItems = result.data.slice(0, 5);
          for (const item of importantItems) {
            explorationResults.push(`  ├── ${item}`);
          }
          
          if (result.data.length > 5) {
            explorationResults.push(`  └── ... 還有 ${result.data.length - 5} 個項目`);
          }
        }
      } catch (error) {
        // 忽略不存在的目錄
      }
    }

    explorationResults.push(`\n📊 目錄統計: 找到 ${foundDirectories} 個目錄，共 ${importantDirectories.length} 個檢查項目\n`);

    // 2. 分析關鍵配置檔案
    explorationResults.push('\n📄 關鍵配置檔案分析:');
    explorationResults.push('─'.repeat(30));
    
    const configFiles = [
      'package.json', 'tsconfig.json', 'next.config.js', 'next.config.ts', 
      'tailwind.config.js', 'eslint.config.js', '.eslintrc.json', 'README.md'
    ];
    
    let foundFiles = 0;
    for (const file of configFiles) {
      try {
        const filePath = getDirectoryPath(file);
        const result = await toolkit.fileSystem.readFile(filePath);
        
        if (result.success && result.data) {
          foundFiles++;
          explorationResults.push(`📄 ${file}`);
          
          // 特殊處理 package.json
          if (file === 'package.json') {
            try {
              const packageData = JSON.parse(result.data);
              explorationResults.push(`  ├── 名稱: ${packageData.name || 'N/A'}`);
              explorationResults.push(`  ├── 版本: ${packageData.version || 'N/A'}`);
              
              if (packageData.scripts) {
                const scripts = Object.keys(packageData.scripts);
                explorationResults.push(`  └── 可用腳本: ${scripts.join(', ')}`);
              }
            } catch {
              // 解析 JSON 失敗時顯示原始內容
              const lines = result.data.split('\n').slice(0, 3);
              explorationResults.push(`  └── 內容預覽:\n    ${lines.join('\n    ')}`);
            }
          } else if (file.endsWith('.json')) {
            // 其他 JSON 檔案
            try {
              const jsonData = JSON.parse(result.data);
              const keys = Object.keys(jsonData).slice(0, 5);
              explorationResults.push(`  └── 主要配置: ${keys.join(', ')}`);
            } catch {
              // 解析 JSON 失敗時顯示原始內容
              const lines = result.data.split('\n').slice(0, 3);
              explorationResults.push(`  └── 內容預覽:\n    ${lines.join('\n    ')}`);
            }
          } else {
            // 其他檔案只顯示前幾行
            const lines = result.data.split('\n').slice(0, 3);
            const totalLines = result.data.split('\n').length;
            explorationResults.push(`  └── 內容預覽 (共 ${totalLines} 行):\n    ${lines.join('\n    ')}`);
          }
        } else {
          console.log(`❌ 檔案 ${filePath} 不存在或無法讀取`);
        }
      } catch (error) {
        console.log(`❌ 讀取檔案 ${file} 時出錯:`, error);
      }
    }

    explorationResults.push(`\n📊 檔案統計: 找到 ${foundFiles} 個關鍵配置檔案`);

    // 3. 生成智能架構分析
    explorationResults.push('\n\n🏗️ 專案架構智能分析:');
    explorationResults.push('─'.repeat(30));
    explorationResults.push(`├── 專案位置: ${projectPath}`);
    explorationResults.push(`├── 專案名稱: ${projectInfo.name}`);
    
    // 智能架構識別
    let architectureType = '未知架構';
    const frameworkInfo: string[] = [];
    
    try {
      // 檢查是否為 Next.js 專案
      const packageJsonPath = getDirectoryPath('package.json');
      const packageResult = await toolkit.fileSystem.readFile(packageJsonPath);
      
      if (packageResult.success && packageResult.data) {
        const packageData = JSON.parse(packageResult.data);
        const deps = { ...packageData.dependencies, ...packageData.devDependencies };
        
        if (deps.next) {
          // 檢查是否使用 App Router
          const appDirResult = await toolkit.fileSystem.listDirectory(getDirectoryPath('src/app'));
          const appRootResult = await toolkit.fileSystem.listDirectory(getDirectoryPath('app'));
          
          if (appDirResult.success || appRootResult.success) {
            architectureType = 'Next.js App Router';
            frameworkInfo.push('使用最新的 App Router 架構');
          } else {
            const pagesDirResult = await toolkit.fileSystem.listDirectory(getDirectoryPath('pages'));
            if (pagesDirResult.success) {
              architectureType = 'Next.js Pages Router';
              frameworkInfo.push('使用傳統的 Pages Router 架構');
            } else {
              architectureType = 'Next.js (架構待確認)';
            }
          }
          
          frameworkInfo.push(`Next.js 版本: ${deps.next}`);
        } else if (deps.react) {
          architectureType = 'React 應用';
          frameworkInfo.push(`React 版本: ${deps.react}`);
          
          if (deps['react-scripts']) {
            frameworkInfo.push('使用 Create React App');
          } else if (deps.vite) {
            frameworkInfo.push('使用 Vite 建構工具');
          }
        } else if (deps.vue) {
          architectureType = 'Vue.js 應用';
          frameworkInfo.push(`Vue 版本: ${deps.vue}`);
        } else {
          architectureType = 'Node.js 專案';
        }
        
        // 檢查其他重要技術
        if (deps.typescript) frameworkInfo.push(`TypeScript: ${deps.typescript}`);
        if (deps.tailwindcss) frameworkInfo.push('使用 Tailwind CSS');
        if (deps.eslint) frameworkInfo.push('配置了 ESLint');
        if (deps.prettier) frameworkInfo.push('配置了 Prettier');
      }
    } catch (error) {
      console.log('❌ 架構分析時出錯:', error);
    }
    
    explorationResults.push(`├── 架構類型: ${architectureType}`);
    if (frameworkInfo.length > 0) {
      explorationResults.push(`├── 技術棧: ${frameworkInfo.join(', ')}`);
    }
    explorationResults.push(`├── 開發語言: ${projectInfo.name.includes('typescript') || foundFiles ? 'TypeScript/JavaScript' : 'JavaScript'}`);
    explorationResults.push(`└── 探索狀態: ✅ 完成 (${foundDirectories} 目錄, ${foundFiles} 配置檔案)`);

    // 4. 總結和建議
    explorationResults.push('\n\n💡 探索總結:');
    explorationResults.push('─'.repeat(30));
    
    if (foundDirectories === 0) {
      explorationResults.push('⚠️ 警告: 未找到任何目錄，可能存在路徑配置問題');
      explorationResults.push('🔧 建議: 檢查 Docker 容器的工作目錄設定');
    } else if (foundFiles === 0) {
      explorationResults.push('⚠️ 警告: 未找到關鍵配置檔案');
      explorationResults.push('🔧 建議: 確認專案是否正確初始化');
    } else {
      explorationResults.push(`✅ 專案結構完整，找到 ${foundDirectories} 個目錄和 ${foundFiles} 個配置檔案`);
      explorationResults.push('🚀 專案已準備就緒，可以進行開發工作');
    }

    const result = explorationResults.join('\n');
    console.log('✅ 專案探索完成');
    return result;
  }

  /**
   * 創建智能代理
   */
  private async createIntelligentAgent(
    tools: Tool[], 
    memory: BufferMemory,
    vectorStore: MemoryVectorStore
  ): Promise<AgentExecutor> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `你是一個全自動的AI程式設計師和專案助理。你的核心使命是：**完全替代用戶完成所有編程工作，用戶不需要寫任何一行程式碼**。

## 🎯 核心使命：零程式碼體驗

**絕對原則**：用戶只需要描述需求，你必須：
1. 🤖 **完全自動化** - 所有編程工作都由你完成
2. 🚫 **零建議模式** - 不要給建議讓用戶自己動手
3. ⚡ **立即執行** - 檢測到需求立即使用工具執行
4. 🎯 **結果導向** - 直接完成任務並展示結果

可用工具: {tool_names}
工具描述: {tools}

當前專案上下文將會動態更新到你的記憶中。`],
      ["placeholder", "{chat_history}"],
      ["human", "用戶需求: {input}\n\n⚡ 立即分析需求並自動執行相關工具完成任務。不要給建議，直接完成工作！"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    const agent = await createStructuredChatAgent({
      llm: this.model,
      tools,
      prompt
    });

    return new AgentExecutor({
      agent,
      tools,
      memory,
      verbose: true,
      maxIterations: 15, // 增加迭代次數以支援深度探索和複雜任務
      earlyStoppingMethod: "force"
    });
  }

  /**
   * 創建決策鏈 - 用於非工具回應
   */
  private async createDecisionChain(session: ChatSession) {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `你是一個全自動的AI程式設計師。你的使命是完全替代用戶完成所有編程工作。

        專案上下文: {context}
        
        **核心原則**：
        1. 🚫 **絕不給建議** - 用戶不需要自己動手
        2. ⚡ **直接完成** - 立即執行所需的操作
        3. 🎯 **結果導向** - 展示完成的結果，不是步驟
        4. 🤖 **全自動化** - 所有技術工作都由你完成

        **回應模式**：
        - ✅ "我已經完成了..."
        - ✅ "已成功修改..."
        - ✅ "檔案已創建完成..."
        - ❌ "您可以..."
        - ❌ "建議您..."
        - ❌ "下一步您需要..."
        
        基於專案狀態和用戶需求，直接提供完成的結果和成果展示。`],
      ["placeholder", "{chat_history}"],
      ["human", "用戶需求: {input}\n\n直接完成任務並展示結果，不要給建議！"]
    ]);

    return RunnableSequence.from([
      {
        input: new RunnablePassthrough(),
        context: new RunnableLambda({
          func: async (input: any) => await this.getRelevantContext(session, input.input)
        }),
        chat_history: new RunnableLambda({
          func: async () => await session.memory.chatHistory.getMessages()
        })
      },
      prompt,
      this.model,
      new StringOutputParser(),
      new RunnableLambda({
        func: async (output: string) => ({ output })
      })
    ]);
  }

  /**
   * 初始化專案上下文到向量存儲
   */
  private async initializeProjectContext(session: ChatSession): Promise<void> {
    try {
      const contextManager = createAIContextManager(session.projectContext);
      const snapshotResult = await contextManager.getProjectSnapshot(true);
      
      if (snapshotResult.success && snapshotResult.data) {
        const snapshot = snapshotResult.data;
        
        // 將專案資訊轉換為文檔
        const docs = [
          new Document({
            pageContent: `專案名稱: ${snapshot.projectInfo.name}\n類型: ${snapshot.projectInfo.type}\n初始化狀態: ${snapshot.projectInfo.isInitialized}`,
            metadata: { type: 'project_info' }
          }),
          new Document({
            pageContent: `檔案結構:\n${snapshot.fileStructure.files.join('\n')}\n目錄:\n${snapshot.fileStructure.directories.join('\n')}`,
            metadata: { type: 'file_structure' }
          }),
          new Document({
            pageContent: `依賴項目:\n${Object.keys(snapshot.dependencies.dependencies).join('\n')}\n開發依賴:\n${Object.keys(snapshot.dependencies.devDependencies).join('\n')}`,
            metadata: { type: 'dependencies' }
          })
        ];

        await session.vectorStore.addDocuments(docs);
        console.log('✅ 專案上下文已初始化到向量存儲');
      }
    } catch (error) {
      console.error('❌ 初始化專案上下文失敗:', error);
    }
  }

  /**
   * 更新專案上下文
   */
  private async updateProjectContext(session: ChatSession): Promise<void> {
    try {
      const contextManager = createAIContextManager(session.projectContext);
      const report = await contextManager.generateAIProjectReport();
      
      // 添加最新的專案報告到向量存儲
      const doc = new Document({
        pageContent: report,
        metadata: { 
          type: 'project_report',
          timestamp: new Date().toISOString()
        }
      });

      await session.vectorStore.addDocuments([doc]);
    } catch (error) {
      console.error('❌ 更新專案上下文失敗:', error);
    }
  }

  /**
   * 獲取相關上下文
   */
  private async getRelevantContext(session: ChatSession, query: string): Promise<string> {
    try {
      const results = await session.vectorStore.similaritySearch(query, 3);
      return results.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
      console.error('❌ 獲取相關上下文失敗:', error);
      return '無可用上下文';
    }
  }

  /**
   * 獲取專案快照
   */
  private async getProjectSnapshot(session: ChatSession): Promise<any> {
    const contextManager = createAIContextManager(session.projectContext);
    const result = await contextManager.getProjectSnapshot();
    return result.success ? result.data : null;
  }

  /**
   * 清理過期會話
   */
  cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastActivity.getTime() > maxAge) {
        this.sessions.delete(sessionId);
        console.log(`🧹 清理過期會話: ${sessionId}`);
      }
    }
  }

  /**
   * 獲取會話統計 - 增強版本
   */
  getSessionStats(): SessionStats {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    
    // 計算活躍會話（最近 30 分鐘內有活動）
    const activeSessions = sessions.filter(
      session => now - session.lastActivity.getTime() < 30 * 60 * 1000
    );

    const totalMessages = sessions.reduce((sum, session) => sum + session.messageCount, 0);
    const totalTokens = sessions.reduce((sum, session) => sum + session.tokenCount, 0);

    let oldestSession: string | undefined;
    let sessionAge: string | undefined;

    if (sessions.length > 0) {
      const oldest = sessions.sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      oldestSession = oldest.sessionId;
      sessionAge = this.formatDuration(now - oldest.createdAt.getTime());
    }

    return {
      activeSessions: activeSessions.length,
      totalMemoryUsage: totalTokens,
      oldestSession,
      sessionAge,
      totalMessages,
      totalTokens
    };
  }

  /**
   * 從用戶輸入中提取檔案名稱
   */
  private extractFileName(input: string): string | null {
    // 1. 直接檔案名匹配
    const filePatterns = [
      /(\w+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /查看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /看看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /打開\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /顯示\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i
    ];

    for (const pattern of filePatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // 2. 特殊檔案關鍵詞映射 - 大幅擴展
    const fileMap: Record<string, string> = {
      // 主頁相關
      '主頁': 'page.tsx',
      '首頁': 'page.tsx', 
      '主頁面': 'page.tsx',
      '根頁面': 'page.tsx',
      '主頁改成': 'page.tsx',
      '主頁內容': 'page.tsx',
      '主頁改': 'page.tsx',
      '網頁編輯': 'page.tsx',
      '編輯主頁': 'page.tsx',
      '修改主頁': 'page.tsx',
      '更新主頁': 'page.tsx',
      '主要頁面': 'page.tsx',
      'homepage': 'page.tsx',
      'home page': 'page.tsx',
      'index page': 'page.tsx',
      'main page': 'page.tsx',
      
      // 配置檔案
      '配置': 'package.json',
      '配置檔': 'package.json',
      '專案配置': 'package.json',
      '設定': 'next.config.js',
      '設定檔': 'next.config.js',
      'config': 'next.config.js',
      'package': 'package.json',
      'tsconfig': 'tsconfig.json',
      
      // 文檔
      'README': 'README.md',
      '說明': 'README.md',
      '文檔': 'README.md',
      '文件': 'README.md',
      
      // 樣式
      '樣式': 'globals.css',
      '全域樣式': 'globals.css',
      'style': 'globals.css',
      'css': 'globals.css',
      
      // 布局
      '布局': 'layout.tsx',
      '版型': 'layout.tsx',
      'layout': 'layout.tsx'
    };

    // 3. 檢查精確匹配
    const inputLower = input.toLowerCase().trim();
    for (const [keyword, fileName] of Object.entries(fileMap)) {
      if (input.includes(keyword) || inputLower.includes(keyword.toLowerCase())) {
        return fileName;
      }
    }

    // 4. 語境分析 - 檢測編輯意圖
    const editPatterns = [
      /(?:把|將|讓|使)\s*主頁/i,
      /主頁\s*(?:改成|變成|修改|更新|編輯)/i,
      /(?:編輯|修改|更新|改)\s*(?:主頁|首頁|網頁|頁面)/i,
      /(?:查看|看看|打開|顯示)\s*(?:主頁|首頁|頁面)/i,
      /AI網頁編輯/i,
      /網頁.*編輯/i,
      /homepage.*file/i
    ];

    for (const pattern of editPatterns) {
      if (pattern.test(input)) {
        return 'page.tsx';
      }
    }

    // 5. 寬鬆匹配 - 如果包含特定關鍵詞
    if (/(?:主頁|首頁|主要|網頁|homepage|index)/i.test(input)) {
      return 'page.tsx';
    }

    if (/(?:配置|config|package|設定)/i.test(input)) {
      return 'package.json';
    }

    return null;
  }

  /**
   * 執行智能檔案搜尋
   */
  private async performIntelligentFileSearch(toolkit: any, fileName: string): Promise<string> {
    const projectPath = await this.detectProjectPath(toolkit);
    const searchResults: Array<{path: string; score: number; type: string}> = [];

    // 定義搜尋目錄和優先級
    const searchDirectories = [
      { path: 'src/app', priority: 10, type: 'app-router' },
      { path: 'src/pages', priority: 9, type: 'pages-router' },
      { path: 'src/components', priority: 8, type: 'component' },
      { path: 'src/lib', priority: 7, type: 'library' },
      { path: 'src', priority: 6, type: 'source' },
      { path: 'pages', priority: 5, type: 'legacy-pages' },
      { path: 'components', priority: 4, type: 'legacy-component' },
      { path: '', priority: 3, type: 'root' },
      { path: 'public', priority: 2, type: 'static' },
      { path: 'docs', priority: 1, type: 'documentation' }
    ];

    // 遞迴搜尋檔案
    for (const searchDir of searchDirectories) {
      try {
        const fullPath = searchDir.path ? 
          `${projectPath}/${searchDir.path}`.replace(/\/+/g, '/') : 
          projectPath;
        
        const foundFiles = await this.searchFilesRecursively(
          toolkit, 
          fullPath, 
          fileName, 
          searchDir.priority,
          searchDir.type
        );
        searchResults.push(...foundFiles);
      } catch (error) {
        // 目錄不存在時跳過
      }
    }

    // 排序結果（分數越高越優先）
    searchResults.sort((a, b) => b.score - a.score);

    if (searchResults.length === 0) {
      return `❌ 在專案中找不到檔案 "${fileName}"。\n\n建議：\n- 檢查檔案名稱是否正確\n- 確認檔案是否存在於專案中\n- 嘗試使用部分檔案名稱搜尋`;
    }

    // 選擇最佳匹配
    const bestMatch = searchResults[0];
    
    try {
      // 讀取檔案內容
      const fileContent = await toolkit.fileSystem.readFile(bestMatch.path);
      
      if (!fileContent.success) {
        return `❌ 找到檔案 "${bestMatch.path}" 但無法讀取內容。`;
      }

      // 分析檔案內容
      const analysis = this.analyzeFileContent(fileContent.data, bestMatch.path);
      
      let result = `✅ 找到檔案：${bestMatch.path}\n`;
      result += `📍 位置類型：${bestMatch.type}\n`;
      
      if (searchResults.length > 1) {
        result += `🔍 其他匹配檔案：${searchResults.slice(1, 3).map(f => f.path).join(', ')}\n`;
      }
      
      result += `\n📄 檔案內容：\n`;
      result += `\`\`\`${this.getFileLanguage(bestMatch.path)}\n`;
      result += fileContent.data;
      result += `\n\`\`\`\n`;
      
      result += `\n📊 檔案分析：\n${analysis}`;
      
      return result;
      
    } catch (error) {
      return `❌ 讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * 遞迴搜尋檔案
   */
  private async searchFilesRecursively(
    toolkit: any, 
    directory: string, 
    targetFileName: string, 
    basePriority: number,
    type: string,
    depth: number = 0
  ): Promise<Array<{path: string; score: number; type: string}>> {
    const results: Array<{path: string; score: number; type: string}> = [];
    
    if (depth > 3) return results; // 限制遞迴深度

    try {
      const dirResult = await toolkit.fileSystem.listDirectory(directory);
      if (!dirResult.success || !dirResult.data) return results;

      for (const item of dirResult.data) {
        const itemPath = `${directory}/${item}`.replace(/\/+/g, '/');
        
        // 檢查是否為目標檔案
        if (this.isFileMatch(item, targetFileName)) {
          const score = this.calculateFileScore(item, targetFileName, basePriority, type);
          results.push({ path: itemPath, score, type });
        }
        
        // 如果是目錄且不是 node_modules，繼續遞迴搜尋
        if (!item.includes('.') && item !== 'node_modules' && item !== '.git' && item !== '.next') {
          try {
            const subResults = await this.searchFilesRecursively(
              toolkit, 
              itemPath, 
              targetFileName, 
              basePriority - 1, 
              type, 
              depth + 1
            );
            results.push(...subResults);
          } catch (error) {
            // 子目錄搜尋失敗時跳過
          }
        }
      }
    } catch (error) {
      // 目錄讀取失敗時跳過
    }

    return results;
  }

  /**
   * 檢查檔案是否匹配
   */
  private isFileMatch(fileName: string, targetFileName: string): boolean {
    const normalizedTarget = targetFileName.toLowerCase();
    const normalizedFile = fileName.toLowerCase();

    // 完全匹配
    if (normalizedFile === normalizedTarget) return true;
    
    // 去除副檔名匹配
    const targetWithoutExt = normalizedTarget.replace(/\.[^.]+$/, '');
    const fileWithoutExt = normalizedFile.replace(/\.[^.]+$/, '');
    if (fileWithoutExt === targetWithoutExt) return true;
    
    // 部分匹配
    if (normalizedFile.includes(normalizedTarget) || normalizedTarget.includes(normalizedFile)) {
      return true;
    }

    return false;
  }

  /**
   * 計算檔案匹配分數
   */
  private calculateFileScore(
    fileName: string, 
    targetFileName: string, 
    basePriority: number, 
    type: string
  ): number {
    let score = basePriority;

    // 完全匹配加分
    if (fileName.toLowerCase() === targetFileName.toLowerCase()) {
      score += 50;
    }

    // 檔案名稱相似度加分
    const similarity = this.calculateStringSimilarity(fileName.toLowerCase(), targetFileName.toLowerCase());
    score += Math.floor(similarity * 20);

    // 特殊檔案類型加分
    if (fileName === 'page.tsx' || fileName === 'page.js') {
      score += 30; // 主頁面加分
    }
    if (fileName === 'index.tsx' || fileName === 'index.js') {
      score += 20; // 索引檔案加分  
    }
    if (fileName.includes('component') || fileName.includes('Component')) {
      score += 10; // 組件檔案加分
    }

    return score;
  }

  /**
   * 計算字串相似度
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 計算編輯距離
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 分析檔案內容
   */
  private analyzeFileContent(content: string, filePath: string): string {
    const analysis: string[] = [];
    
    // 檔案大小
    const lines = content.split('\n');
    analysis.push(`📏 檔案大小：${lines.length} 行，${content.length} 字元`);
    
    // 檔案類型分析
    const fileType = this.getFileLanguage(filePath);
    analysis.push(`🏷️ 檔案類型：${fileType}`);
    
    // React 組件分析
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      if (content.includes('export default') || content.includes('export function')) {
        analysis.push(`⚛️ React 組件：包含導出組件`);
      }
      if (content.includes('useState') || content.includes('useEffect')) {
        analysis.push(`🎣 使用 Hooks：useState, useEffect 等`);
      }
    }
    
    // 導入分析
    const imports = content.match(/^import .+$/gm);
    if (imports && imports.length > 0) {
      analysis.push(`📦 導入模組：${imports.length} 個`);
    }
    
    // 函數分析
    const functions = content.match(/(?:function|const .+?=|export function)/g);
    if (functions && functions.length > 0) {
      analysis.push(`🔧 函數數量：${functions.length} 個`);
    }

    return analysis.join('\n');
  }

  /**
   * 獲取檔案語言類型
   */
  private getFileLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'tsx': 'typescript',
      'ts': 'typescript', 
      'jsx': 'javascript',
      'js': 'javascript',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'html': 'html'
    };
    return languageMap[ext || ''] || 'text';
  }
}

/**
 * 工廠函數
 */
export function createLangchainChatEngine(apiKey: string, options?: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): LangchainChatEngine {
  return new LangchainChatEngine(apiKey, options);
}

/**
 * 顯示遷移警告
 * @deprecated 請使用新的 aiChatSession 工具替代
 */
export function showMigrationWarning(): void {
  console.warn(`
⚠️ LangchainChatEngine 已棄用
請使用新的 aiChatSession 工具替代
位置：src/lib/functions/ai/index.ts
遷移指南：docs/unified-function-call-system.md
  `);
}