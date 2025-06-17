// Langchain 聊天引擎 - 高品質重構版本
// 專注於上下文管理、tool 調用和自動決策
import { ChatOpenAI } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory, ConversationBufferWindowMemory } from "langchain/memory";
import { 
  AgentExecutor, 
  createReactAgent,
  createStructuredChatAgent
} from "langchain/agents";
import { pull } from "langchain/hub";
import { 
  RunnableSequence, 
  RunnablePassthrough,
  RunnableLambda
} from "@langchain/core/runnables";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { 
  BaseMessage, 
  HumanMessage, 
  AIMessage, 
  SystemMessage 
} from "@langchain/core/messages";
import { DynamicTool, Tool } from "@langchain/core/tools";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

// 引入現有的工具和上下文管理
import { createAIContextManager, ProjectContext, ProjectSnapshot } from './context-manager';
import { createDockerToolkit, DockerToolkit, createDefaultDockerContext } from '../docker/tools';

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
    
    // 創建記憶體管理
    const memory = new ConversationBufferWindowMemory({
      k: this.contextWindow,
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
      new SystemMessagePromptTemplate({
        template: `你是一個智能決策助手。分析用戶請求並決定最佳行動方案。

        當前狀況:
        - 重試次數: {retryCount}/3
        - 上次錯誤: {lastError}
        - 專案上下文: {projectContext}
        
        決策選項:
        1. continue_tools: 需要使用工具來完成任務
        2. respond_to_user: 可以直接回應，不需要工具
        3. need_input: 需要更多用戶資訊才能繼續
        
        請提供:
        1. reasoning: 詳細的推理過程
        2. decision: 選擇的決策 (continue_tools/respond_to_user/need_input)
        3. confidence: 信心度 (0-1)
        
        以 JSON 格式回應。`
      }),
      new HumanMessagePromptTemplate({
        template: "用戶請求: {userMessage}"
      })
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
      const result = await session.agent.invoke({
        input: userMessage,
        chat_history: await session.memory.chatHistory.getMessages()
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
    // 簡單的啟發式規則 - 可以用更複雜的 LLM 判斷
    const continueKeywords = ['錯誤', '失敗', '無法', '需要', '問題'];
    const completeKeywords = ['完成', '成功', '建立', '創建', '已經'];
    
    const lowerOutput = output.toLowerCase();
    
    const hasContinueSignal = continueKeywords.some(keyword => lowerOutput.includes(keyword));
    const hasCompleteSignal = completeKeywords.some(keyword => lowerOutput.includes(keyword));
    
    return hasContinueSignal && !hasCompleteSignal;
  }

  /**
   * 創建專案工具
   */
  private async createProjectTools(projectContext: ProjectContext): Promise<Tool[]> {
    const contextManager = createAIContextManager(projectContext);
    const dockerContext = createDefaultDockerContext(
      `${projectContext.projectId}-container`, 
      `ai-dev-${projectContext.projectName}`,
      projectContext.projectName  // 傳入專案名稱設定工作目錄
    );
    const toolkit = createDockerToolkit(dockerContext);

    const tools: Tool[] = [
      new DynamicTool({
        name: "comprehensive_project_exploration",
        description: "進行完整的專案探索 - 自動深度掃描所有重要目錄和配置檔案。當用戶要求查看專案結構時使用此工具",
        func: async () => {
          const exploration = await this.performComprehensiveExploration(toolkit, projectContext.projectName);
          return exploration;
        }
      }),

      new DynamicTool({
        name: "list_directory",
        description: "列出指定目錄的內容，用於探索檔案結構。路徑相對於專案根目錄",
        func: async (path: string) => {
          const result = await toolkit.fileSystem.listDirectory(path || './');
          return result.success ? `目錄 ${path || './'} 內容:\n${result.data?.join('\n') || '空目錄'}` : result.error || '無法列出目錄';
        }
      }),

      new DynamicTool({
        name: "get_project_snapshot",
        description: "獲取當前專案的完整快照，包含檔案結構、依賴、Git 狀態等",
        func: async () => {
          const result = await contextManager.getProjectSnapshot(true);
          return result.success ? JSON.stringify(result.data, null, 2) : result.error || '無法獲取專案快照';
        }
      }),

      new DynamicTool({
        name: "project_exploration",
        description: "深度探索和分析專案，生成詳細報告和建議",
        func: async () => {
          const report = await contextManager.generateAIProjectReport();
          const suggestions = await contextManager.getSmartSuggestions();
          return `專案報告:\n${report}\n\n建議:\n${suggestions.data?.join('\n') || '無建議'}`;
        }
      }),

      new DynamicTool({
        name: "initialize_project",
        description: "初始化或確保專案已正確設置",
        func: async () => {
          // 檢查專案基本檔案是否存在
          const basePath = `app/workspace/${projectContext.projectName}`;
          const packageJsonResult = await toolkit.fileSystem.readFile(`${basePath}/package.json`);
          if (packageJsonResult.success) {
            return `✅ 專案已初始化（在 ${basePath} 找到 package.json）`;
          } else {
            return `⚠️ 專案可能尚未初始化（在 ${basePath} 找不到 package.json）`;
          }
        }
      }),

      new DynamicTool({
        name: "create_file",
        description: "創建新檔案，輸入格式: path|content。路徑相對於專案根目錄",
        func: async (input: string) => {
          const [path, content] = input.split('|');
          if (!path || content === undefined) {
            return '❌ 輸入格式錯誤，請使用: path|content';
          }
          const result = await toolkit.fileSystem.writeFile(path, content);
          return result.success ? `✅ 檔案 ${path} 創建成功` : result.error || '創建檔案失敗';
        }
      }),

      new DynamicTool({
        name: "read_file",
        description: "讀取檔案內容。路徑相對於專案根目錄",
        func: async (path: string) => {
          const result = await toolkit.fileSystem.readFile(path);
          return result.success ? result.data || '檔案為空' : result.error || '讀取檔案失敗';
        }
      }),

      new DynamicTool({
        name: "execute_command",
        description: "在容器中執行命令",
        func: async (command: string) => {
          // DockerToolkit 沒有直接的 executeCommand 方法，需要通過其他方式實現
          return `⚠️ 命令執行功能暫未實現: ${command}`;
        }
      }),

      // 創建專案路徑檢測工具
      new DynamicTool({
        name: "detect_project_path",
        description: `自動檢測當前專案的根目錄路徑。
        
        這個工具會：
        1. 搜尋包含 package.json 的目錄
        2. 確定正確的專案根路徑
        3. 返回專案基本資訊
        
        使用時機：
        - 當用戶詢問專案結構時
        - 需要確定工作目錄時
        - 開始任何專案操作前`,
        func: async () => {
          try {
            const toolkit = await createDockerToolkit(dockerContext);
            const projectPath = await this.detectProjectPath(toolkit);
            const projectInfo = await this.getProjectInfo(toolkit, projectPath);
            
            return JSON.stringify({
              success: true,
              projectPath,
              projectInfo,
              message: `✅ 專案路徑檢測完成\n路徑: ${projectPath}\n名稱: ${projectInfo.name}\n版本: ${projectInfo.version || 'N/A'}`
            }, null, 2);
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              message: `❌ 專案路徑檢測失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
            }, null, 2);
          }
        }
      }),

      // 創建強化的專案探索工具
      new DynamicTool({
        name: "comprehensive_project_exploration", 
        description: `執行完整的專案結構探索和分析。
        
        這個工具會自動：
        1. 檢測正確的專案根目錄
        2. 探索所有重要的子目錄（src, app, lib, components, pages, public, docs）
        3. 讀取關鍵配置檔案（package.json, tsconfig.json, next.config.js）
        4. 分析專案架構類型（Next.js App Router, Pages Router, React 等）
        5. 生成完整的專案架構報告
        
        ⚠️ 重要：當用戶提到以下詞彙時必須使用此工具：
        - "查看專案"、"專案目錄"、"專案結構"
        - "有哪些檔案"、"檔案架構"、"專案組織"
        - "探索專案"、"分析專案"
        
        絕不能只用 list_directory 工具敷衍了事！`,
        func: async () => {
          try {
            const toolkit = await createDockerToolkit(dockerContext);
            const explorationResult = await this.performComprehensiveExploration(toolkit);
            return `✅ 完整專案探索完成\n\n${explorationResult}`;
          } catch (error) {
            return `❌ 專案探索失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // 創建智能檔案搜尋工具
      new DynamicTool({
        name: "intelligent_file_search",
        description: `智能檔案搜尋和自動導航工具。
        
        當用戶提到檔案名稱時（如 "查看 page.tsx"、"看看 component.js"），此工具會：
        1. 在整個專案中搜尋匹配的檔案
        2. 根據上下文選擇最相關的檔案
        3. 自動讀取並顯示檔案內容
        4. 提供檔案位置和基本分析
        
        支援的檔案類型：.tsx, .ts, .jsx, .js, .json, .md, .css, .scss, .html
        
        搜尋邏輯：
        - 優先匹配完整檔名
        - 次優匹配部分檔名  
        - 考慮檔案在專案中的重要性（如主頁面 > 組件 > 工具檔案）
        
        使用時機：
        - 用戶提到具體檔案名稱
        - 用戶想查看某個組件或頁面
        - 用戶要求查看配置檔案`,
        func: async (input: string) => {
          try {
            const toolkit = await createDockerToolkit(dockerContext);
            
            // 從輸入中提取檔案名稱
            const fileName = this.extractFileName(input);
            if (!fileName) {
              return `❌ 無法從請求中識別檔案名稱。請提供更具體的檔案名稱。`;
            }
            
            const searchResult = await this.performIntelligentFileSearch(toolkit, fileName);
            return searchResult;
            
          } catch (error) {
            return `❌ 檔案搜尋失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      })
    ];

    return tools;
  }

  /**
   * 自動檢測專案根目錄路徑
   */
  private async detectProjectPath(toolkit: any): Promise<string> {
    try {
      // 嘗試在當前目錄查找 package.json
      const result = await toolkit.fileSystem.readFile('./package.json');
      if (result.success) {
        return './';
      }
    } catch (error) {
      // 繼續尋找
    }

    try {
      // 如果在 Docker 容器中，嘗試工作目錄
      const workspaceResult = await toolkit.fileSystem.listDirectory('/app/workspace/');
      if (workspaceResult.success && workspaceResult.data) {
        // 嘗試找到包含 package.json 的專案目錄
        for (const item of workspaceResult.data) {
          try {
            const projectPath = `/app/workspace/${item}`;
            const packageResult = await toolkit.fileSystem.readFile(`${projectPath}/package.json`);
            if (packageResult.success) {
              return projectPath;
            }
          } catch (error) {
            // 繼續尋找下一個
          }
        }
      }
    } catch (error) {
      // 繼續尋找
    }

    // 預設回到當前目錄
    return './';
  }

  /**
   * 從 package.json 提取專案資訊
   */
  private async getProjectInfo(toolkit: any, projectPath: string): Promise<{ name: string; description?: string; version?: string }> {
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
   * 完整專案探索 - 改進版本
   */
  private async performComprehensiveExploration(toolkit: any, projectName?: string): Promise<string> {
    const explorationResults: string[] = [];
    
    // 自動檢測專案路徑
    const projectPath = await this.detectProjectPath(toolkit);
    const projectInfo = await this.getProjectInfo(toolkit, projectPath);
    
    // 定義要探索的目錄（相對於專案根目錄）
    const directoriesToExplore = [
      '',  // 根目錄
      'src',
      'src/app',
      'src/lib',
      'src/components',
      'pages',
      'public',
      'docs',
      'tests'
    ];

    // 關鍵檔案
    const keyFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'next.config.ts',
      'tailwind.config.js',
      'README.md',
      '.gitignore'
    ];

    explorationResults.push(`🔍 開始完整專案探索`);
    explorationResults.push(`📍 專案路徑: ${projectPath}`);
    explorationResults.push(`📦 專案名稱: ${projectInfo.name}`);
    if (projectInfo.description) {
      explorationResults.push(`📝 專案描述: ${projectInfo.description}`);
    }
    if (projectInfo.version) {
      explorationResults.push(`🏷️ 版本: ${projectInfo.version}`);
    }
    explorationResults.push('');

    // 1. 探索目錄結構
    explorationResults.push('📁 目錄結構:');
    for (const dir of directoriesToExplore) {
      try {
        const fullPath = dir ? `${projectPath}/${dir}`.replace(/\/+/g, '/') : projectPath;
        const result = await toolkit.fileSystem.listDirectory(fullPath);
        if (result.success && result.data && result.data.length > 0) {
          const displayPath = dir || '(根目錄)';
          explorationResults.push(`\n📂 ${displayPath}:`);
          result.data.forEach((item: string) => {
            explorationResults.push(`  ├── ${item}`);
          });
        }
      } catch (error) {
        // 目錄不存在時跳過
      }
    }

    // 2. 讀取關鍵檔案
    explorationResults.push('\n\n📄 關鍵配置檔案:');
    for (const file of keyFiles) {
      try {
        const filePath = `${projectPath}/${file}`.replace(/\/+/g, '/');
        const result = await toolkit.fileSystem.readFile(filePath);
        if (result.success && result.data) {
          explorationResults.push(`\n🔧 ${file}:`);
          
          if (file === 'package.json') {
            // 解析 package.json 顯示重要資訊
            try {
              const packageData = JSON.parse(result.data);
              explorationResults.push(`  名稱: ${packageData.name || 'N/A'}`);
              explorationResults.push(`  版本: ${packageData.version || 'N/A'}`);
              explorationResults.push(`  描述: ${packageData.description || 'N/A'}`);
              if (packageData.dependencies) {
                const mainDeps = Object.keys(packageData.dependencies).slice(0, 5);
                explorationResults.push(`  主要依賴: ${mainDeps.join(', ')}`);
              }
              if (packageData.scripts) {
                const scripts = Object.keys(packageData.scripts).slice(0, 5);
                explorationResults.push(`  可用腳本: ${scripts.join(', ')}`);
              }
            } catch (parseError) {
              const lines = result.data.split('\n').slice(0, 5);
              explorationResults.push(`  ${lines.join('\n  ')}`);
            }
          } else {
            // 只顯示前5行以避免過長
            const lines = result.data.split('\n').slice(0, 5);
            explorationResults.push(`  ${lines.join('\n  ')}`);
            if (result.data.split('\n').length > 5) {
              explorationResults.push('  ...(省略其餘內容)');
            }
          }
        }
      } catch (error) {
        // 檔案不存在時跳過
      }
    }

    // 3. 生成架構摘要
    explorationResults.push('\n\n🏗️ 專案架構摘要:');
    explorationResults.push(`├── 專案位於: ${projectPath}`);
    explorationResults.push(`├── 專案名稱: ${projectInfo.name}`);
    
    // 智能架構識別
    try {
      const srcResult = await toolkit.fileSystem.listDirectory(`${projectPath}/src`);
      const appResult = await toolkit.fileSystem.listDirectory(`${projectPath}/src/app`);
      const pagesResult = await toolkit.fileSystem.listDirectory(`${projectPath}/pages`);
      
      if (appResult.success) {
        explorationResults.push('├── 架構類型: Next.js App Router');
      } else if (pagesResult.success) {
        explorationResults.push('├── 架構類型: Next.js Pages Router');
      } else if (srcResult.success) {
        explorationResults.push('├── 架構類型: React 應用');
      } else {
        explorationResults.push('├── 架構類型: 通用 Node.js 專案');
      }
    } catch (error) {
      explorationResults.push('├── 架構類型: 無法確定');
    }
    
    explorationResults.push('├── 開發語言: TypeScript/JavaScript');
    explorationResults.push('└── 狀態: 已完成基礎架構分析');

    return explorationResults.join('\n');
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
      new SystemMessagePromptTemplate({
        template: `你是一個智能的AI專案助理。你有以下能力:

        1. 🔍 專案探索和分析
        2. 📁 檔案管理 (創建、讀取、修改)
        3. ⚡ 命令執行
        4. 🎯 智能決策和自動執行

        ## 🚨 專案探索核心原則：絕不淺嚐

        當用戶要求查看專案結構時，你必須：

        1. **自動深度探索** - 不要停留在根目錄，要主動探索所有重要子目錄
        2. **完整分析** - 讀取關鍵配置檔案，理解專案架構
        3. **結構化報告** - 提供清晰的專案架構總結

        ### 🚨 專案探索觸發詞 - 自動執行規則
        當用戶提到以下詞彙時，**立即使用 comprehensive_project_exploration 工具**：
        - "查看專案"、"專案目錄"、"專案結構"
        - "有哪些檔案"、"檔案架構"、"專案組織"
        - "探索專案"、"分析專案"、"目錄"、"檔案"

        ### 🎯 強制執行規則
        1. **檢測到探索請求** → 立即使用 `comprehensive_project_exploration` 工具
        2. **需要確認專案路徑** → 先使用 `detect_project_path` 工具
        3. **絕不使用** `list_directory` 工具來回應專案探索請求
        4. **必須提供完整分析**，不能只顯示目錄清單

        ### ⚡ 自動工具選擇邏輯

        #### 專案探索請求
        ```
        用戶請求包含 ["專案", "目錄", "檔案", "結構", "探索"] 關鍵詞
        ↓
        立即執行: comprehensive_project_exploration
        ↓
        提供完整的專案架構分析報告
        ```

        #### 智能檔案搜尋請求  
        ```
        用戶請求包含 ["查看 xxx.tsx", "看看 xxx.js", "主頁", "配置"] 等檔案相關詞彙
        ↓
        立即執行: intelligent_file_search
        ↓
        自動在整個專案中搜尋 → 找到最佳匹配 → 顯示檔案內容和分析
        ```

        ### 🎯 檔案搜尋智能識別
        當用戶提到以下模式時，自動使用 `intelligent_file_search`：
        - "查看 [檔案名]"、"看看 [檔案名]"、"打開 [檔案名]"
        - "主頁"、"首頁"、"根頁面" → 自動搜尋 page.tsx
        - "配置"、"設定" → 自動搜尋配置檔案
        - 任何包含檔案副檔名的請求 (.tsx, .ts, .jsx, .js, .json, .md)

        ❌ **絕對禁止**: 只執行 list_directory 就回報結果
        ❌ **絕對禁止**: 淺層探索後詢問用戶要看什麼  
        ❌ **絕對禁止**: 說找不到檔案就結束
        ✅ **正確做法**: 自動使用專用工具進行完整探索或智能搜尋

        工作原則:
        - 主動探索專案結構來理解上下文
        - 自動執行必要的步驟，無需等待用戶確認
        - 遇到錯誤時智能重試和調整策略
        - 保持專案狀態的完整記錄
        - 提供清晰的執行摘要

        可用工具: {tool_names}
        工具描述: {tools}

        當前專案上下文將會動態更新到你的記憶中。`
      }),
      new MessagesPlaceholder("chat_history"),
      new HumanMessagePromptTemplate({
        template: "用戶請求: {input}\n\n請分析需求並自動執行相關步驟。如果是專案探索請求，請進行完整的多層探索。如果需要使用工具，請主動使用。"
      }),
      new MessagesPlaceholder("agent_scratchpad")
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
      maxIterations: 10, // 增加迭代次數以支援深度探索
      earlyStoppingMethod: "generate"
    });
  }

  /**
   * 創建決策鏈 - 用於非工具回應
   */
  private async createDecisionChain(session: ChatSession) {
    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessagePromptTemplate({
        template: `你是一個智能的AI專案助理。基於用戶請求和專案上下文，提供有用的回應。

        專案上下文: {context}
        
        請提供詳細、有用的回應，包含:
        1. 對用戶請求的理解
        2. 基於專案狀態的分析
        3. 具體的建議或解答
        4. 下一步行動建議`
      }),
      new MessagesPlaceholder("chat_history"),
      new HumanMessagePromptTemplate({
        template: "用戶請求: {input}"
      })
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
    for (const [sessionId, session] of this.sessions.entries()) {
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
    // 常見的檔案搜尋關鍵詞
    const searchPatterns = [
      /查看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /看看\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /打開\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /顯示\s*(.+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
      /(\w+\.(?:tsx?|jsx?|json|md|css|scss|html))/i,
    ];

    for (const pattern of searchPatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // 特殊處理：常見的檔案描述
    const specialCases = {
      '主頁': 'page.tsx',
      '首頁': 'page.tsx', 
      '主頁面': 'page.tsx',
      '根頁面': 'page.tsx',
      '配置': 'package.json',
      '設定': 'next.config',
      'README': 'README.md'
    };

    for (const [keyword, fileName] of Object.entries(specialCases)) {
      if (input.includes(keyword)) {
        return fileName;
      }
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