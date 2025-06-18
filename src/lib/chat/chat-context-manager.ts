// 聊天上下文管理器
// 整合 SQLite 儲存與現有的聊天 API，提供完整的上下文管理功能
import { chatStorage, ChatRoom, ChatMessage, ChatContext } from '../database/chat-storage';

// 聊天視窗介面（與前端組件保持一致）
export interface ChatWindow {
  id: string;
  title: string;
  messages: ChatMessage[];
  isActive: boolean;
  createdAt: Date;
  totalTokens: number;
  totalCost: number;
  projectId: string;
  projectName: string;
  containerId?: string;
}

// 訊息統計介面
export interface MessageStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  toolUsage: Record<string, number>;
}

// 聊天回應介面
export interface ChatResponse {
  message: string;
  messageId: string;
  tokens?: number;
  cost?: number;
  toolCallsExecuted?: number;
  stats?: MessageStats;
}

/**
 * 聊天上下文管理器
 * 負責管理聊天室的創建、訊息儲存、上下文維護和歷史記錄
 */
export class ChatContextManager {
  private static instance: ChatContextManager;

  private constructor() {}

  /**
   * 獲取單例實例
   */
  static getInstance(): ChatContextManager {
    if (!ChatContextManager.instance) {
      ChatContextManager.instance = new ChatContextManager();
    }
    return ChatContextManager.instance;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * 創建或獲取聊天室
   */
  async getOrCreateChatRoom(
    roomId: string,
    projectId: string,
    projectName: string,
    containerId?: string
  ): Promise<ChatRoom> {
    // 嘗試從資料庫獲取現有聊天室
    let room = chatStorage.getChatRoom(roomId);
    
    if (!room) {
      // 創建新聊天室
      room = chatStorage.createChatRoom({
        id: roomId,
        title: `聊天 - ${projectName}`,
        projectId,
        projectName,
        containerId,
        isActive: true,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
      });

      // 添加歡迎訊息
      await this.addWelcomeMessage(roomId, projectName);
    } else {
      // 更新現有聊天室的活動時間
      chatStorage.updateChatRoom(roomId, {});
    }

    return room;
  }

  /**
   * 添加歡迎訊息
   */
  private async addWelcomeMessage(roomId: string, projectName: string): Promise<void> {
    const welcomeMessage: ChatMessage = {
      id: this.generateId('msg'),
      roomId,
      role: 'assistant',
      content: `歡迎使用 AI Web IDE！我是您的 AI 編程助手，已連接到專案 **${projectName}**。

我具備以下能力：
- 🔍 **專案理解**：完整分析您的專案結構和代碼
- 🛠️ **代碼編輯**：協助修改、重構和優化代碼
- 🐛 **錯誤修復**：自動檢測並修復常見問題
- 📦 **Docker 管理**：管理容器和開發環境
- 🚀 **部署協助**：協助專案部署和配置

請告訴我您需要什麼協助！`,
      timestamp: new Date().toISOString(),
    };

    chatStorage.addChatMessage(welcomeMessage);
  }

  /**
   * 獲取專案的所有聊天室（轉換為前端格式）
   */
  async getChatWindows(projectId: string): Promise<ChatWindow[]> {
    const rooms = chatStorage.getChatRoomsByProject(projectId);
    
    const windows: ChatWindow[] = [];
    
    for (const room of rooms) {
      // 獲取最近的訊息
      const messages = chatStorage.getRecentMessages(room.id, 50);
      
      windows.push({
        id: room.id,
        title: room.title,
        messages,
        isActive: room.isActive,
        createdAt: new Date(room.createdAt),
        totalTokens: room.totalTokens,
        totalCost: room.totalCost,
        projectId: room.projectId,
        projectName: room.projectName,
        containerId: room.containerId,
      });
    }

    return windows;
  }

  /**
   * 獲取單個聊天視窗
   */
  async getChatWindow(roomId: string): Promise<ChatWindow | null> {
    const room = chatStorage.getChatRoom(roomId);
    if (!room) return null;

    const messages = chatStorage.getRecentMessages(roomId, 50);

    return {
      id: room.id,
      title: room.title,
      messages,
      isActive: room.isActive,
      createdAt: new Date(room.createdAt),
      totalTokens: room.totalTokens,
      totalCost: room.totalCost,
      projectId: room.projectId,
      projectName: room.projectName,
      containerId: room.containerId,
    };
  }

  /**
   * 添加用戶訊息
   */
  async addUserMessage(roomId: string, content: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateId('msg'),
      roomId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    chatStorage.addChatMessage(message);
    return message;
  }

  /**
   * 添加 AI 回應訊息
   */
  async addAssistantMessage(
    roomId: string,
    response: ChatResponse
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: response.messageId,
      roomId,
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString(),
      tokens: response.tokens,
      cost: response.cost,
      toolCallsExecuted: response.toolCallsExecuted,
      metadata: response.stats ? {
        stats: response.stats
      } : undefined,
    };

    chatStorage.addChatMessage(message);
    return message;
  }

  /**
   * 獲取聊天歷史（用於 AI 上下文）
   */
  async getChatHistory(roomId: string, messageCount: number = 10): Promise<ChatMessage[]> {
    return chatStorage.getRecentMessages(roomId, messageCount);
  }

  /**
   * 構建 AI 上下文字串
   */
  async buildContextString(roomId: string, maxMessages: number = 10): Promise<string> {
    const messages = await this.getChatHistory(roomId, maxMessages);
    
    if (messages.length === 0) {
      return '';
    }

    const contextParts: string[] = [];
    
    // 添加對話歷史
    contextParts.push('=== 對話歷史 ===');
    
    for (const message of messages) {
      const role = message.role === 'user' ? '用戶' : 'AI助手';
      const timestamp = new Date(message.timestamp).toLocaleString('zh-TW');
      
      contextParts.push(`[${timestamp}] ${role}: ${message.content}`);
      
      // 如果有工具調用資訊，也包含進去
      if (message.toolCallsExecuted && message.toolCallsExecuted > 0) {
        contextParts.push(`  └─ 執行了 ${message.toolCallsExecuted} 個工具操作`);
      }
    }

    // 獲取專案相關的上下文
    const projectContexts = chatStorage.getAllChatContexts(roomId);
    if (projectContexts.length > 0) {
      contextParts.push('\n=== 專案上下文 ===');
      
      for (const context of projectContexts) {
        if (context.contextType === 'project_info') {
          contextParts.push(`${context.contextKey}: ${context.contextValue}`);
        }
      }
    }

    return contextParts.join('\n');
  }

  /**
   * 設置專案上下文
   */
  async setProjectContext(
    roomId: string,
    contextKey: string,
    contextValue: string,
    expiresInHours?: number
  ): Promise<void> {
    const expiresAt = expiresInHours 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : undefined;

    const context: ChatContext = {
      id: this.generateId('ctx'),
      roomId,
      contextType: 'project_info',
      contextKey,
      contextValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt,
    };

    chatStorage.setChatContext(context);
  }

  /**
   * 獲取專案上下文
   */
  async getProjectContext(roomId: string, contextKey: string): Promise<string | null> {
    const context = chatStorage.getChatContext(roomId, 'project_info', contextKey);
    return context?.contextValue || null;
  }

  /**
   * 記錄工具使用情況
   */
  async recordToolUsage(
    roomId: string,
    toolName: string,
    input: any,
    output: any,
    success: boolean
  ): Promise<void> {
    const toolRecord = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      input,
      output,
      success,
    };

    const context: ChatContext = {
      id: this.generateId('tool'),
      roomId,
      contextType: 'tool_usage',
      contextKey: `${toolName}_${Date.now()}`,
      contextValue: JSON.stringify(toolRecord),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小時後過期
    };

    chatStorage.setChatContext(context);
  }

  /**
   * 獲取工具調用記錄
   */
  async getToolCallRecords(roomId: string): Promise<any[]> {
    const contexts = chatStorage.getAllChatContexts(roomId);
    const toolRecords = contexts
      .filter(ctx => ctx.contextType === 'tool_usage')
      .map(ctx => {
        try {
          return JSON.parse(ctx.contextValue);
        } catch (error) {
          console.warn(`解析工具記錄失敗: ${ctx.id}`, error);
          return null;
        }
      })
      .filter(record => record !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return toolRecords;
  }

  /**
   * 獲取思考過程記錄
   */
  async getThoughtProcessRecords(roomId: string): Promise<any[]> {
    const contexts = chatStorage.getAllChatContexts(roomId);
    const thoughtRecords = contexts
      .filter(ctx => ctx.contextKey.startsWith('thought_process_'))
      .map(ctx => {
        try {
          return JSON.parse(ctx.contextValue);
        } catch (error) {
          console.warn(`解析思考過程記錄失敗: ${ctx.id}`, error);
          return null;
        }
      })
      .filter(record => record !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return thoughtRecords;
  }

  /**
   * 獲取特定訊息的工具調用統計
   */
  async getMessageToolStats(roomId: string, messageId: string): Promise<{
    totalToolCalls: number;
    successfulCalls: number;
    failedCalls: number;
    toolTypes: string[];
    averageDuration: number;
  }> {
    const toolRecords = await this.getToolCallRecords(roomId);
    const messageTools = toolRecords.filter(record => 
      record.messageId === messageId || 
      Math.abs(new Date(record.timestamp).getTime() - new Date(messageId).getTime()) < 60000 // 1分鐘內的記錄
    );

    const stats = {
      totalToolCalls: messageTools.length,
      successfulCalls: messageTools.filter(tool => tool.success).length,
      failedCalls: messageTools.filter(tool => !tool.success).length,
      toolTypes: [...new Set(messageTools.map(tool => tool.tool))],
      averageDuration: messageTools.length > 0 
        ? messageTools.reduce((sum, tool) => sum + (tool.duration || 0), 0) / messageTools.length 
        : 0
    };

    return stats;
  }

  /**
   * 獲取聊天室的完整分析報告
   */
  async getChatRoomAnalytics(roomId: string): Promise<{
    messageCount: number;
    toolCallCount: number;
    thoughtProcessCount: number;
    mostUsedTools: Array<{ tool: string; count: number }>;
    successRate: number;
    averageResponseTime: number;
    conversationFlow: Array<{
      timestamp: string;
      type: 'message' | 'tool_call' | 'thought_process';
      content: string;
      success?: boolean;
    }>;
  }> {
    const messages = await this.getChatHistory(roomId, 1000); // 獲取大量歷史
    const toolRecords = await this.getToolCallRecords(roomId);
    const thoughtRecords = await this.getThoughtProcessRecords(roomId);

    // 統計工具使用情況
    const toolUsage = toolRecords.reduce((acc, record) => {
      acc[record.tool] = (acc[record.tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedTools = Object.entries(toolUsage)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 計算成功率
    const successfulTools = toolRecords.filter(record => record.success).length;
    const successRate = toolRecords.length > 0 ? (successfulTools / toolRecords.length) * 100 : 0;

    // 計算平均響應時間
    const averageResponseTime = toolRecords.length > 0 
      ? toolRecords.reduce((sum, record) => sum + (record.duration || 0), 0) / toolRecords.length 
      : 0;

    // 構建對話流程
    const conversationFlow = [
      ...messages.map(msg => ({
        timestamp: msg.timestamp,
        type: 'message' as const,
        content: `${msg.role}: ${msg.content.substring(0, 100)}...`,
      })),
      ...toolRecords.map(tool => ({
        timestamp: tool.timestamp,
        type: 'tool_call' as const,
        content: `工具調用: ${tool.tool}`,
        success: tool.success,
      })),
      ...thoughtRecords.map(thought => ({
        timestamp: thought.timestamp,
        type: 'thought_process' as const,
        content: `思考: ${thought.reasoning.substring(0, 100)}...`,
      }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      messageCount: messages.length,
      toolCallCount: toolRecords.length,
      thoughtProcessCount: thoughtRecords.length,
      mostUsedTools,
      successRate,
      averageResponseTime,
      conversationFlow,
    };
  }

  /**
   * 刪除聊天室
   */
  async deleteChatRoom(roomId: string): Promise<boolean> {
    return chatStorage.deleteChatRoom(roomId);
  }

  /**
   * 更新聊天室標題
   */
  async updateChatRoomTitle(roomId: string, title: string): Promise<boolean> {
    return chatStorage.updateChatRoom(roomId, { title });
  }

  /**
   * 設置聊天室為非活躍狀態
   */
  async deactivateChatRoom(roomId: string): Promise<boolean> {
    return chatStorage.updateChatRoom(roomId, { isActive: false });
  }

  /**
   * 獲取聊天統計資訊
   */
  async getChatStats(projectId?: string): Promise<{
    totalRooms: number;
    activeRooms: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
  }> {
    const stats = chatStorage.getStorageStats();
    
    if (projectId) {
      // 獲取特定專案的統計
      const rooms = chatStorage.getChatRoomsByProject(projectId);
      const projectStats = rooms.reduce((acc, room) => ({
        totalRooms: acc.totalRooms + 1,
        activeRooms: acc.activeRooms + (room.isActive ? 1 : 0),
        totalMessages: acc.totalMessages + room.totalMessages,
        totalTokens: acc.totalTokens + room.totalTokens,
        totalCost: acc.totalCost + room.totalCost,
      }), {
        totalRooms: 0,
        activeRooms: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
      });
      
      return projectStats;
    }

    return {
      totalRooms: stats.totalRooms,
      activeRooms: stats.activeRooms,
      totalMessages: stats.totalMessages,
      totalTokens: 0, // 需要計算所有房間的總 tokens
      totalCost: 0,   // 需要計算所有房間的總成本
    };
  }

  /**
   * 清理過期資料
   */
  async cleanup(): Promise<void> {
    chatStorage.cleanupExpiredContexts();
    chatStorage.cleanupOldChatRooms(30); // 清理30天前的非活躍聊天室
  }
}

// 導出單例實例
export const chatContextManager = ChatContextManager.getInstance(); 