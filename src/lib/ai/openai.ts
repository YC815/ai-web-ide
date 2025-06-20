// OpenAI Function Calling 整合模組
// 實現完整的 AI 編輯器與 OpenAI gpt-4o function calling 整合
// 
// @deprecated 此模組已棄用，請使用新的 aiChatSession 工具
// 位置：src/lib/functions/ai/index.ts
// 遷移指南：docs/unified-function-call-system.md

import OpenAI from 'openai';
import { 
  createDockerAIEditorManager, 
  DockerAIEditorConfig, 
  DockerAIEditorManager,
  DockerAIToolName,
  DockerAIToolParameters
} from '../docker/ai-editor-manager';
import { logger } from '../core/logger';

export interface OpenAIIntegrationConfig {
  openaiApiKey: string;
  model?: string;
  dockerAIEditorConfig: DockerAIEditorConfig;
  enableToolCallLogging?: boolean;
  maxToolCalls?: number;
}

export interface ToolCallLog {
  id: string;
  timestamp: Date;
  toolName: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
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

// 定義工具函數類型
type ToolFunction = (args: Record<string, unknown>) => Promise<{
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}>;

// 🚀 OpenAI 整合管理器
export class OpenAIIntegration {
  private openai: OpenAI;
  private dockerAIEditor: DockerAIEditorManager;
  private config: OpenAIIntegrationConfig;
  private toolRegistry: Record<string, ToolFunction> = {};
  private sessions: Map<string, ChatSession> = new Map();

  constructor(config: OpenAIIntegrationConfig) {
    this.config = config;
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.dockerAIEditor = createDockerAIEditorManager(config.dockerAIEditorConfig);
    this.setupToolRegistry();
    
    logger.info('OpenAI-Integration', 'OpenAI Integration initialized', {
      model: config.model || 'gpt-4o',
      maxToolCalls: config.maxToolCalls || 10,
      enableToolCallLogging: config.enableToolCallLogging
    });
  }

  /**
   * 設置工具註冊表
   */
  private setupToolRegistry(): void {
    this.toolRegistry = {
      docker_start_dev_server: (args: DockerAIToolParameters['docker_start_dev_server']) => 
        this.dockerAIEditor.executeDockerAITool('docker_start_dev_server', args),
      
      docker_restart_dev_server: (args: DockerAIToolParameters['docker_restart_dev_server']) => 
        this.dockerAIEditor.executeDockerAITool('docker_restart_dev_server', args),
      
      docker_kill_dev_server: (args: DockerAIToolParameters['docker_kill_dev_server']) => 
        this.dockerAIEditor.executeDockerAITool('docker_kill_dev_server', args),
      
      docker_check_dev_server_status: (args: DockerAIToolParameters['docker_check_dev_server_status']) => 
        this.dockerAIEditor.executeDockerAITool('docker_check_dev_server_status', args),
      
      docker_read_log_tail: (args: DockerAIToolParameters['docker_read_log_tail']) => 
        this.dockerAIEditor.executeDockerAITool('docker_read_log_tail', args),
      
      docker_search_error_logs: (args: DockerAIToolParameters['docker_search_error_logs']) => 
        this.dockerAIEditor.executeDockerAITool('docker_search_error_logs', args),
      
      docker_get_log_files: (args: DockerAIToolParameters['docker_get_log_files']) => 
        this.dockerAIEditor.executeDockerAITool('docker_get_log_files', args),
      
      docker_check_health: (args: DockerAIToolParameters['docker_check_health']) => 
        this.dockerAIEditor.executeDockerAITool('docker_check_health', args),
      
      docker_check_container_health: (args: DockerAIToolParameters['docker_check_container_health']) => 
        this.dockerAIEditor.executeDockerAITool('docker_check_container_health', args),
      
      docker_read_file: (args: DockerAIToolParameters['docker_read_file']) => 
        this.dockerAIEditor.executeDockerAITool('docker_read_file', args),
      
      docker_write_file: (args: DockerAIToolParameters['docker_write_file']) => 
        this.dockerAIEditor.executeDockerAITool('docker_write_file', args),
      
      docker_list_directory: (args: DockerAIToolParameters['docker_list_directory']) => 
        this.dockerAIEditor.executeDockerAITool('docker_list_directory', args),
      
      docker_smart_monitor_and_recover: (args: DockerAIToolParameters['docker_smart_monitor_and_recover']) => 
        this.dockerAIEditor.executeDockerAITool('docker_smart_monitor_and_recover', args),
      
      docker_get_full_status_report: (args: DockerAIToolParameters['docker_get_full_status_report']) => 
        this.dockerAIEditor.executeDockerAITool('docker_get_full_status_report', args),
      
      ask_user: (args: DockerAIToolParameters['ask_user']) => 
        this.dockerAIEditor.executeDockerAITool('ask_user', args)
    };
  }

  /**
   * 創建新的聊天會話
   */
  createSession(systemPrompt?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultSystemPrompt = `你是一個 AI 編程助手，專門幫助用戶在Docker容器內編輯和管理代碼。你可以使用以下Docker工具：

🖥️ 開發伺服器管理：
- docker_start_dev_server: 在容器內啟動開發伺服器
- docker_restart_dev_server: 在容器內重啟開發伺服器
- docker_kill_dev_server: 終止容器內開發伺服器
- docker_check_dev_server_status: 檢查容器內伺服器狀態

📄 日誌監控：
- docker_read_log_tail: 讀取容器內日誌
- docker_search_error_logs: 搜尋容器內錯誤日誌
- docker_get_log_files: 獲取容器內日誌檔案清單

❤️ 健康檢查：
- docker_check_health: 檢查容器內服務健康狀態
- docker_check_container_health: 檢查Docker容器本身健康狀態

📁 檔案系統：
- docker_read_file: 讀取容器內檔案
- docker_write_file: 寫入容器內檔案
- docker_list_directory: 列出容器內目錄內容
- docker_show_directory_tree: 顯示容器內目錄樹狀結構

🤖 智能功能：
- docker_smart_monitor_and_recover: 智能監控與自動修復
- docker_get_full_status_report: 獲取完整狀態報告

💬 用戶互動：
- ask_user: 與用戶確認操作

🔒 安全保證：所有操作都在Docker容器內執行，不會影響宿主機環境。請根據用戶需求選擇合適的工具。`;

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
    
    logger.info('OpenAI-Integration', 'New chat session created', {
      sessionId,
      hasCustomPrompt: !!systemPrompt
    });
    
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

    // 記錄用戶訊息
    logger.info('OpenAI-Integration', 'User message received', {
      sessionId,
      messageLength: userMessage.length,
      messagePreview: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : '')
    });

    // 添加用戶訊息
    session.messages.push({
      role: 'user',
      content: userMessage
    });

    const maxToolCalls = options?.maxToolCalls || this.config.maxToolCalls || 10;
    let toolCallsExecuted = 0;
    const currentMessages = [...session.messages];

    // 獲取工具定義
    const tools = this.dockerAIEditor.getFunctionDefinitionsForOpenAI();

    while (toolCallsExecuted < maxToolCalls) {
      // 發送請求到 OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o',
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
        const aiResponse = message.content || '';
        
        logger.info('OpenAI-Integration', 'AI response generated', {
          sessionId,
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : ''),
          toolCallsExecuted
        });
        
        session.messages = currentMessages;
        session.lastActivity = new Date();
        
        return {
          response: aiResponse,
          toolCallsExecuted,
          session
        };
      }

      // 執行工具調用
      for (const toolCall of message.tool_calls) {
        const startTime = Date.now();
        
        try {
          const toolName = toolCall.function.name as DockerAIToolName;
          const parameters = JSON.parse(toolCall.function.arguments);
          
          logger.info('OpenAI-Integration', 'Tool call initiated', {
            sessionId,
            toolName,
            parameters,
            toolCallId: toolCall.id
          });
          
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
          
          logger.info('OpenAI-Integration', 'Tool call completed', {
            sessionId,
            toolName,
            toolCallId: toolCall.id,
            success: result.success,
            executionTime: `${executionTime}ms`,
            hasData: !!result.data,
            hasError: !!result.error
          });
          
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
          
          logger.error('OpenAI-Integration', 'Tool call failed', error instanceof Error ? error : new Error(errorMessage), {
            sessionId,
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
            executionTime: `${executionTime}ms`,
            parameters: JSON.parse(toolCall.function.arguments)
          });
          
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
  async handleUserConfirmation(actionId: string, confirmed: boolean, data?: Record<string, unknown>): Promise<void> {
    await this.dockerAIEditor.handleUserConfirmation(actionId, confirmed, data);
  }

  /**
   * 獲取待處理的操作
   */
  getPendingActions() {
    return this.dockerAIEditor.getPendingActions();
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

/**
 * 顯示遷移警告
 * @deprecated 請使用新的 aiChatSession 工具替代
 */
export function showMigrationWarning(): void {
  console.warn(`
⚠️ OpenAIIntegration 已棄用
請使用新的 aiChatSession 工具替代
位置：src/lib/functions/ai/index.ts
遷移指南：docs/unified-function-call-system.md
  `);
}

// 預設導出
export default OpenAIIntegration; 