// OpenAI Function Calling 整合模組
// 實現完整的 AI 編輯器與 OpenAI GPT-4 function calling 整合

import OpenAI from 'openai';
import { createAIEditorManager, AIEditorConfig, AIEditorManager } from './ai-editor-manager';
import { 
  AIToolName, 
  AIToolParameters, 
  getFunctionDefinitionsForOpenAI 
} from './ai-function-schemas';

export interface OpenAIIntegrationConfig {
  openaiApiKey: string;
  model?: string;
  aiEditorConfig: AIEditorConfig;
  enableToolCallLogging?: boolean;
  maxToolCalls?: number;
}

export interface ToolCallLog {
  id: string;
  timestamp: Date;
  toolName: string;
  parameters: any;
  result: any;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  toolCallLogs: ToolCallLog[];
  createdAt: Date;
  lastActivity: Date;
}

// 🚀 OpenAI 整合管理器
export class OpenAIIntegration {
  private openai: OpenAI;
  private aiEditor: AIEditorManager;
  private config: OpenAIIntegrationConfig;
  private toolRegistry: Record<string, Function> = {};
  private sessions: Map<string, ChatSession> = new Map();

  constructor(config: OpenAIIntegrationConfig) {
    this.config = config;
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.aiEditor = createAIEditorManager(config.aiEditorConfig);
    this.setupToolRegistry();
  }

  /**
   * 設置工具註冊表
   */
  private setupToolRegistry(): void {
    this.toolRegistry = {
      read_file: (args: AIToolParameters['read_file']) => 
        this.aiEditor.executeAITool('read_file', args),
      
      list_files: (args: AIToolParameters['list_files']) => 
        this.aiEditor.executeAITool('list_files', args),
      
      ask_user: (args: AIToolParameters['ask_user']) => 
        this.aiEditor.executeAITool('ask_user', args),
      
      propose_diff: (args: AIToolParameters['propose_diff']) => 
        this.aiEditor.executeAITool('propose_diff', args),
      
      run_command: (args: AIToolParameters['run_command']) => 
        this.aiEditor.executeAITool('run_command', args),
      
      search_code: (args: AIToolParameters['search_code']) => 
        this.aiEditor.executeAITool('search_code', args),
      
      summarize_file: (args: AIToolParameters['summarize_file']) => 
        this.aiEditor.executeAITool('summarize_file', args),
      
      get_project_context: (args: AIToolParameters['get_project_context']) => 
        this.aiEditor.executeAITool('get_project_context', args),
      
      get_git_diff: (args: AIToolParameters['get_git_diff']) => 
        this.aiEditor.executeAITool('get_git_diff', args),
      
      get_terminal_output: (args: AIToolParameters['get_terminal_output']) => 
        this.aiEditor.executeAITool('get_terminal_output', args),
      
      test_file: (args: AIToolParameters['test_file']) => 
        this.aiEditor.executeAITool('test_file', args)
    };
  }

  /**
   * 創建新的聊天會話
   */
  createSession(systemPrompt?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultSystemPrompt = `你是一個 AI 編程助手，專門幫助用戶編輯和管理代碼。你可以使用以下工具：

🔧 檔案操作：
- read_file: 讀取檔案內容
- list_files: 列出檔案清單
- search_code: 搜尋代碼

✏️ 代碼編輯：
- propose_diff: 提議代碼修改（核心功能）
- summarize_file: 生成檔案摘要

🚀 執行操作：
- run_command: 執行終端指令
- test_file: 執行測試

📊 專案分析：
- get_project_context: 獲取專案結構
- get_git_diff: 獲取 Git 變更
- get_terminal_output: 獲取終端輸出

💬 用戶互動：
- ask_user: 與用戶確認操作

請根據用戶需求選擇合適的工具，並確保操作安全。對於重要的修改，請先使用 ask_user 確認。`;

    const session: ChatSession = {
      id: sessionId,
      messages: [
        {
          role: 'system',
          content: systemPrompt || defaultSystemPrompt
        }
      ],
      toolCallLogs: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * 發送訊息並處理 function calling
   */
  async sendMessage(
    sessionId: string, 
    userMessage: string,
    options?: {
      maxToolCalls?: number;
      temperature?: number;
      stream?: boolean;
    }
  ): Promise<{
    response: string;
    toolCallsExecuted: number;
    session: ChatSession;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`會話 ${sessionId} 不存在`);
    }

    // 添加用戶訊息
    session.messages.push({
      role: 'user',
      content: userMessage
    });

    const maxToolCalls = options?.maxToolCalls || this.config.maxToolCalls || 10;
    let toolCallsExecuted = 0;
    let currentMessages = [...session.messages];

    // 獲取工具定義
    const tools = this.aiEditor.getFunctionDefinitionsForOpenAI();

    while (toolCallsExecuted < maxToolCalls) {
      // 發送請求到 OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: currentMessages,
        tools,
        tool_choice: 'auto',
        temperature: options?.temperature || 0.1
      });

      const message = completion.choices[0].message;
      currentMessages.push(message);

      // 檢查是否有 tool calls
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // 沒有工具調用，返回最終回應
        session.messages = currentMessages;
        session.lastActivity = new Date();
        
        return {
          response: message.content || '',
          toolCallsExecuted,
          session
        };
      }

      // 執行工具調用
      for (const toolCall of message.tool_calls) {
        const startTime = Date.now();
        
        try {
          const toolName = toolCall.function.name as AIToolName;
          const parameters = JSON.parse(toolCall.function.arguments);
          
          console.log(`🔧 執行工具: ${toolName}`, parameters);
          
          // 執行工具
          const toolFunction = this.toolRegistry[toolName];
          if (!toolFunction) {
            throw new Error(`未知的工具: ${toolName}`);
          }
          
          const result = await toolFunction(parameters);
          const executionTime = Date.now() - startTime;
          
          // 記錄工具調用
          const log: ToolCallLog = {
            id: toolCall.id,
            timestamp: new Date(),
            toolName,
            parameters,
            result,
            executionTime,
            success: result.success,
            error: result.error
          };
          
          session.toolCallLogs.push(log);
          
          if (this.config.enableToolCallLogging) {
            console.log(`✅ 工具執行完成: ${toolName} (${executionTime}ms)`, {
              success: result.success,
              hasData: !!result.data
            });
          }
          
          // 添加工具回應到對話
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: result.success,
              data: result.data,
              message: result.message,
              error: result.error
            })
          });
          
          toolCallsExecuted++;
          
        } catch (error) {
          const executionTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // 記錄錯誤
          const log: ToolCallLog = {
            id: toolCall.id,
            timestamp: new Date(),
            toolName: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments),
            result: null,
            executionTime,
            success: false,
            error: errorMessage
          };
          
          session.toolCallLogs.push(log);
          
          console.error(`❌ 工具執行失敗: ${toolCall.function.name}`, errorMessage);
          
          // 添加錯誤回應
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: false,
              error: errorMessage
            })
          });
        }
      }
    }

    // 達到最大工具調用次數
    session.messages = currentMessages;
    session.lastActivity = new Date();
    
    return {
      response: '已達到最大工具調用次數限制',
      toolCallsExecuted,
      session
    };
  }

  /**
   * 獲取會話資訊
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 獲取所有會話
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 刪除會話
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 獲取工具調用統計
   */
  getToolCallStats(sessionId?: string): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
    toolUsage: Record<string, number>;
  } {
    let logs: ToolCallLog[] = [];
    
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      logs = session?.toolCallLogs || [];
    } else {
      // 所有會話的統計
      for (const session of this.sessions.values()) {
        logs.push(...session.toolCallLogs);
      }
    }
    
    const totalCalls = logs.length;
    const successfulCalls = logs.filter(log => log.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const averageExecutionTime = logs.length > 0 
      ? logs.reduce((sum, log) => sum + log.executionTime, 0) / logs.length 
      : 0;
    
    const toolUsage: Record<string, number> = {};
    for (const log of logs) {
      toolUsage[log.toolName] = (toolUsage[log.toolName] || 0) + 1;
    }
    
    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageExecutionTime,
      toolUsage
    };
  }

  /**
   * 處理用戶確認
   */
  async handleUserConfirmation(actionId: string, confirmed: boolean, data?: any): Promise<void> {
    await this.aiEditor.handleUserConfirmation(actionId, confirmed, data);
  }

  /**
   * 獲取待處理的操作
   */
  getPendingActions() {
    return this.aiEditor.getPendingActions();
  }

  /**
   * 導出會話為 JSON
   */
  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return JSON.stringify(session, null, 2);
  }

  /**
   * 導入會話
   */
  importSession(sessionData: string): string {
    const session: ChatSession = JSON.parse(sessionData);
    const newSessionId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    session.id = newSessionId;
    this.sessions.set(newSessionId, session);
    
    return newSessionId;
  }
}

// 工廠函數
export function createOpenAIIntegration(config: OpenAIIntegrationConfig): OpenAIIntegration {
  return new OpenAIIntegration(config);
}

// 預設導出
export default OpenAIIntegration; 