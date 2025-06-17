// 增強的上下文管理器 - 專注於會話持久化和對話記憶
import { ChatMessage } from '@langchain/core/messages';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createAIContextManager, ProjectContext, ProjectSnapshot } from './context-manager';

/**
 * 會話上下文 - 包含完整的對話狀態
 */
export interface SessionContext {
  sessionId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  lastActivity: string;
  totalMessages: number;
  contextTokens: number;
  
  // 對話歷史
  conversationHistory: ChatMessage[];
  
  // 專案狀態快照
  projectSnapshot: ProjectSnapshot | null;
  
  // 重要記憶點
  keyMemories: string[];
  
  // AI 學到的專案知識
  projectKnowledge: {
    fileStructure: string[];
    dependencies: string[];
    technologies: string[];
    components: string[];
    insights: string[];
  };
  
  // 工具使用歷史
  toolHistory: Array<{
    timestamp: string;
    tool: string;
    input: unknown;
    output: unknown;
    success: boolean;
  }>;
}

/**
 * 上下文更新記錄
 */
export interface ContextUpdate {
  sessionId: string;
  timestamp: string;
  updateType: 'message' | 'project_scan' | 'tool_execution' | 'knowledge_update';
  changes: {
    added: string[];
    updated: string[];
    removed: string[];
  };
  tokenDelta: number;
}

/**
 * 增強的上下文管理器
 * 
 * 功能：
 * 1. 完整的會話持久化
 * 2. 智能對話歷史管理
 * 3. 專案狀態追蹤
 * 4. 向量化記憶搜尋
 * 5. 上下文壓縮和清理
 */
export class EnhancedContextManager {
  private sessionStore = new Map<string, SessionContext>();
  private vectorStores = new Map<string, MemoryVectorStore>();
  private embeddings: OpenAIEmbeddings;
  
  // 設定參數
  private readonly MAX_CONVERSATION_LENGTH = 50; // 最大對話長度
  private readonly MAX_SESSIONS = 100; // 最大會話數
  private readonly SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4小時超時
  private readonly CONTEXT_COMPRESSION_THRESHOLD = 10000; // 上下文壓縮閾值

  constructor(apiKey: string) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
    });
  }

  /**
   * 獲取或創建會話上下文
   */
  async getOrCreateSession(
    sessionId: string,
    projectContext: ProjectContext
  ): Promise<SessionContext> {
    // 檢查現有會話
    if (this.sessionStore.has(sessionId)) {
      const session = this.sessionStore.get(sessionId)!;
      session.lastActivity = new Date().toISOString();
      return session;
    }

    console.log(`🆕 創建新的上下文會話: ${sessionId}`);

    // 創建新會話
    const session: SessionContext = {
      sessionId,
      projectId: projectContext.projectId,
      projectName: projectContext.projectName || 'Unknown Project',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      totalMessages: 0,
      contextTokens: 0,
      conversationHistory: [],
      projectSnapshot: null,
      keyMemories: [],
      projectKnowledge: {
        fileStructure: [],
        dependencies: [],
        technologies: [],
        components: [],
        insights: []
      },
      toolHistory: []
    };

    // 初始化向量存儲
    const vectorStore = new MemoryVectorStore(this.embeddings);
    this.vectorStores.set(sessionId, vectorStore);

    // 執行專案掃描
    await this.performProjectScan(session, projectContext);

    // 保存會話
    this.sessionStore.set(sessionId, session);

    // 清理過期會話
    this.cleanupExpiredSessions();

    return session;
  }

  /**
   * 添加用戶訊息到上下文
   */
  async addUserMessage(sessionId: string, message: string): Promise<ContextUpdate> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`會話 ${sessionId} 不存在`);
    }

    const timestamp = new Date().toISOString();
    const userMessage: ChatMessage = {
      content: message,
      additional_kwargs: {
        role: 'user',
        timestamp
      }
    };

    session.conversationHistory.push(userMessage);
    session.totalMessages++;
    session.lastActivity = timestamp;

    // 添加到向量存儲
    const vectorStore = this.vectorStores.get(sessionId)!;
    await vectorStore.addDocuments([
      new Document({
        pageContent: `用戶訊息: ${message}`,
        metadata: { 
          type: 'user_message', 
          timestamp,
          sessionId 
        }
      })
    ]);

    // 管理對話長度
    if (session.conversationHistory.length > this.MAX_CONVERSATION_LENGTH) {
      await this.compressConversationHistory(session);
    }

    const update: ContextUpdate = {
      sessionId,
      timestamp,
      updateType: 'message',
      changes: {
        added: [`用戶訊息: ${message.substring(0, 50)}...`],
        updated: ['對話歷史'],
        removed: []
      },
      tokenDelta: this.estimateTokens(message)
    };

    session.contextTokens += update.tokenDelta;
    return update;
  }

  /**
   * 添加 AI 回應到上下文
   */
  async addAIResponse(
    sessionId: string, 
    response: string,
    toolCalls?: Array<{tool: string; input: unknown; output: unknown; success: boolean}>
  ): Promise<ContextUpdate> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`會話 ${sessionId} 不存在`);
    }

    const timestamp = new Date().toISOString();
    const aiMessage: ChatMessage = {
      content: response,
      additional_kwargs: {
        role: 'assistant',
        timestamp,
        toolCalls
      }
    };

    session.conversationHistory.push(aiMessage);
    session.totalMessages++;
    session.lastActivity = timestamp;

    // 記錄工具使用
    if (toolCalls) {
      for (const tool of toolCalls) {
        session.toolHistory.push({
          timestamp,
          tool: tool.tool,
          input: tool.input,
          output: tool.output,
          success: tool.success
        });
      }
    }

    // 添加到向量存儲
    const vectorStore = this.vectorStores.get(sessionId)!;
    await vectorStore.addDocuments([
      new Document({
        pageContent: `AI 回應: ${response}`,
        metadata: { 
          type: 'ai_response', 
          timestamp,
          sessionId,
          toolCalls: toolCalls?.length || 0
        }
      })
    ]);

    // 提取知識更新
    await this.extractKnowledgeFromResponse(session, response, toolCalls);

    const update: ContextUpdate = {
      sessionId,
      timestamp,
      updateType: 'message',
      changes: {
        added: [`AI 回應: ${response.substring(0, 50)}...`],
        updated: ['對話歷史'],
        removed: []
      },
      tokenDelta: this.estimateTokens(response)
    };

    session.contextTokens += update.tokenDelta;
    return update;
  }

  /**
   * 執行專案掃描並更新上下文
   */
  async performProjectScan(session: SessionContext, projectContext: ProjectContext): Promise<void> {
    try {
      const contextManager = createAIContextManager(projectContext);
      const snapshotResult = await contextManager.getProjectSnapshot(true);

      if (snapshotResult.success && snapshotResult.data) {
        session.projectSnapshot = snapshotResult.data;
        
        // 更新專案知識
        const snapshot = snapshotResult.data;
        session.projectKnowledge.fileStructure = snapshot.fileStructure.files;
        session.projectKnowledge.dependencies = Object.keys(snapshot.dependencies.dependencies);
        
        // 推測技術棧
        session.projectKnowledge.technologies = this.detectTechnologies(snapshot);
        
        // 添加到向量存儲
        const vectorStore = this.vectorStores.get(session.sessionId)!;
        await vectorStore.addDocuments([
          new Document({
            pageContent: `專案架構: ${JSON.stringify(snapshot.fileStructure, null, 2)}`,
            metadata: { type: 'project_structure', sessionId: session.sessionId }
          }),
          new Document({
            pageContent: `專案依賴: ${JSON.stringify(snapshot.dependencies, null, 2)}`,
            metadata: { type: 'project_dependencies', sessionId: session.sessionId }
          }),
          new Document({
            pageContent: `專案資訊: ${JSON.stringify(snapshot.projectInfo, null, 2)}`,
            metadata: { type: 'project_info', sessionId: session.sessionId }
          })
        ]);

        console.log(`✅ 專案掃描完成: ${session.projectName}`);
      }
    } catch (error) {
      console.error('❌ 專案掃描失敗:', error);
    }
  }

  /**
   * 搜尋相關上下文
   */
  async searchRelevantContext(sessionId: string, query: string, limit: number = 5): Promise<string[]> {
    const vectorStore = this.vectorStores.get(sessionId);
    if (!vectorStore) {
      return [];
    }

    try {
      const results = await vectorStore.similaritySearch(query, limit);
      return results.map(doc => doc.pageContent);
    } catch (error) {
      console.error('❌ 上下文搜尋失敗:', error);
      return [];
    }
  }

  /**
   * 獲取會話摘要
   */
  getSessionSummary(sessionId: string): {
    session: SessionContext | null;
    stats: {
      totalMessages: number;
      contextTokens: number;
      toolCallsCount: number;
      sessionAge: string;
      knowledgeItems: number;
    };
  } {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return { session: null, stats: { totalMessages: 0, contextTokens: 0, toolCallsCount: 0, sessionAge: '0', knowledgeItems: 0 } };
    }

    const sessionAge = this.formatDuration(
      Date.now() - new Date(session.createdAt).getTime()
    );

    const knowledgeItems = Object.values(session.projectKnowledge).reduce(
      (total, items) => total + items.length, 0
    );

    return {
      session,
      stats: {
        totalMessages: session.totalMessages,
        contextTokens: session.contextTokens,
        toolCallsCount: session.toolHistory.length,
        sessionAge,
        knowledgeItems
      }
    };
  }

  /**
   * 獲取所有會話統計
   */
  getAllSessionsStats(): {
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    totalTokens: number;
    oldestSession?: string;
    newestSession?: string;
  } {
    const sessions = Array.from(this.sessionStore.values());
    const now = Date.now();
    
    const activeSessions = sessions.filter(
      session => now - new Date(session.lastActivity).getTime() < this.SESSION_TIMEOUT
    );

    const totalMessages = sessions.reduce((sum, session) => sum + session.totalMessages, 0);
    const totalTokens = sessions.reduce((sum, session) => sum + session.contextTokens, 0);

    let oldestSession: string | undefined;
    let newestSession: string | undefined;

    if (sessions.length > 0) {
      const sorted = sessions.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      oldestSession = sorted[0].sessionId;
      newestSession = sorted[sorted.length - 1].sessionId;
    }

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalMessages,
      totalTokens,
      oldestSession,
      newestSession
    };
  }

  /**
   * 清理過期會話
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessionStore.entries()) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > this.SESSION_TIMEOUT) {
        this.sessionStore.delete(sessionId);
        this.vectorStores.delete(sessionId);
        cleanedCount++;
      }
    }

    // 如果會話太多，清理最舊的
    if (this.sessionStore.size > this.MAX_SESSIONS) {
      const sessions = Array.from(this.sessionStore.entries())
        .sort(([,a], [,b]) => 
          new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
        );

      const toRemove = sessions.slice(0, this.sessionStore.size - this.MAX_SESSIONS);
      for (const [sessionId] of toRemove) {
        this.sessionStore.delete(sessionId);
        this.vectorStores.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 個過期或過多的會話`);
    }
  }

  /**
   * 壓縮對話歷史
   */
  private async compressConversationHistory(session: SessionContext): Promise<void> {
    if (session.conversationHistory.length <= this.MAX_CONVERSATION_LENGTH) {
      return;
    }

    // 保留最近的重要對話
    const recentMessages = session.conversationHistory.slice(-this.MAX_CONVERSATION_LENGTH);
    
    // 將舊的對話轉為摘要存入向量存儲
    const oldMessages = session.conversationHistory.slice(0, -this.MAX_CONVERSATION_LENGTH);
    const summary = this.summarizeMessages(oldMessages);
    
    session.keyMemories.push(summary);
    session.conversationHistory = recentMessages;

    // 添加摘要到向量存儲
    const vectorStore = this.vectorStores.get(session.sessionId)!;
    await vectorStore.addDocuments([
      new Document({
        pageContent: `對話摘要: ${summary}`,
        metadata: { 
          type: 'conversation_summary', 
          timestamp: new Date().toISOString(),
          sessionId: session.sessionId 
        }
      })
    ]);

    console.log(`📝 壓縮會話 ${session.sessionId} 的對話歷史`);
  }

  /**
   * 從 AI 回應中提取知識
   */
  private async extractKnowledgeFromResponse(
    session: SessionContext,
    response: string,
    toolCalls?: Array<{tool: string; input: unknown; output: unknown; success: boolean}>
  ): Promise<void> {
    // 檢測提到的檔案
    const fileMatches = response.match(/[a-zA-Z0-9_-]+\.(tsx?|jsx?|json|md|css|scss|html)/g);
    if (fileMatches) {
      session.projectKnowledge.components.push(...fileMatches);
    }

    // 檢測技術關鍵字
    const techKeywords = ['React', 'Next.js', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Node.js', 'Express'];
    for (const tech of techKeywords) {
      if (response.includes(tech) && !session.projectKnowledge.technologies.includes(tech)) {
        session.projectKnowledge.technologies.push(tech);
      }
    }

    // 從工具調用中提取知識
    if (toolCalls) {
      for (const tool of toolCalls) {
        if (tool.success && typeof tool.output === 'string') {
          session.projectKnowledge.insights.push(
            `${tool.tool}: ${tool.output.substring(0, 100)}...`
          );
        }
      }
    }

    // 去重
    session.projectKnowledge.components = [...new Set(session.projectKnowledge.components)];
    session.projectKnowledge.technologies = [...new Set(session.projectKnowledge.technologies)];
    session.projectKnowledge.insights = session.projectKnowledge.insights.slice(-20); // 保留最近20個洞察
  }

  /**
   * 檢測專案技術棧
   */
  private detectTechnologies(snapshot: ProjectSnapshot): string[] {
    const technologies: string[] = [];
    
    // 從依賴檢測
    const deps = Object.keys(snapshot.dependencies.dependencies);
    if (deps.includes('react')) technologies.push('React');
    if (deps.includes('next')) technologies.push('Next.js');
    if (deps.includes('typescript')) technologies.push('TypeScript');
    if (deps.includes('express')) technologies.push('Express');
    if (deps.includes('tailwindcss')) technologies.push('Tailwind CSS');
    
    // 從檔案類型檢測
    const files = snapshot.fileStructure.files;
    if (files.some(f => f.endsWith('.tsx'))) technologies.push('React TypeScript');
    if (files.some(f => f.endsWith('.jsx'))) technologies.push('React JavaScript');
    if (files.some(f => f.endsWith('.ts'))) technologies.push('TypeScript');
    if (files.includes('package.json')) technologies.push('Node.js');
    
    return [...new Set(technologies)];
  }

  /**
   * 摘要化訊息
   */
  private summarizeMessages(messages: ChatMessage[]): string {
    const userMessages = messages.filter(m => m.additional_kwargs?.role === 'user');
    const aiMessages = messages.filter(m => m.additional_kwargs?.role === 'assistant');
    
    return `對話摘要 (${messages.length} 條訊息): 用戶詢問了 ${userMessages.length} 個問題，AI 提供了 ${aiMessages.length} 個回應。主要內容: ${userMessages.slice(0, 3).map(m => m.content.substring(0, 30)).join(', ')}...`;
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
    
    if (days > 0) return `${days}天`;
    if (hours > 0) return `${hours}小時`;
    return `${minutes}分鐘`;
  }
}

/**
 * 工廠函數
 */
export function createEnhancedContextManager(apiKey: string): EnhancedContextManager {
  return new EnhancedContextManager(apiKey);
} 