/**
 * 統一 AI Agent 整合器
 * 使用新的統一 Function Call 系統整合所有 AI Agent 功能
 * 
 * 這個模組替代了舊的 chat-agent-integration.ts 和 langchain-chat-engine.ts
 * 提供統一的 AI Agent 體驗，支援 OpenAI Function Calling 和 Langchain 整合
 */

import { ChatOpenAI } from "@langchain/openai";
import { ConversationBufferWindowMemory } from "langchain/memory";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { DynamicTool } from "@langchain/core/tools";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

// 導入新的統一 Function Call 系統
import { 
  allTools, 
  toolsByCategory, 
  searchTools, 
  generateOpenAISchemas,
  type FunctionDefinition,
  type ToolCategory 
} from '../functions';
import { 
  convertToLangchainTool,
  selectToolsForRequest,
  createHighPriorityToolsForAgent
} from '../functions/langchain-binder';
import { logger } from '../logger';

// 類型定義
export interface UnifiedAgentConfig {
  projectId: string;
  projectName: string;
  containerId?: string;
  apiKey: string;
  
  // AI 模型配置
  model?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Agent 配置
  maxIterations?: number;
  maxRetries?: number;
  contextWindow?: number;
  
  // 功能開關
  enableVectorStore?: boolean;
  enableToolSelection?: boolean;
  enableLogging?: boolean;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallResult {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface AgentResponse {
  message: string;
  toolCalls: Array<{
    toolId: string;
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    success: boolean;
    duration: number;
    timestamp: string;
    error?: string;
  }>;
  reasoning?: string;
  confidence?: number;
  sessionInfo: {
    sessionId: string;
    messageCount: number;
    tokenCount: number;
    sessionAge: string;
  };
  contextUpdate?: {
    added: string[];
    updated: string[];
    memoryTokens: number;
  };
  needsUserInput?: boolean;
  error?: string;
}

export interface AgentSession {
  sessionId: string;
  config: UnifiedAgentConfig;
  memory: ConversationBufferWindowMemory;
  vectorStore?: MemoryVectorStore;
  agent: AgentExecutor;
  availableTools: DynamicTool[];
  lastActivity: Date;
  createdAt: Date;
  messageCount: number;
  tokenCount: number;
}

/**
 * 統一 AI Agent 整合器
 * 提供完整的 AI Agent 功能，支援工具調用、記憶管理和智能決策
 */
export class UnifiedAIAgentIntegrator {
  private sessions = new Map<string, AgentSession>();
  private model: ChatOpenAI;
  private embeddings?: OpenAIEmbeddings;

  constructor(private defaultConfig: Partial<UnifiedAgentConfig> = {}) {
    // 延遲初始化
  }

  /**
   * 創建或獲取 AI Agent 會話
   */
  async getOrCreateSession(
    sessionId: string, 
    config: UnifiedAgentConfig
  ): Promise<AgentSession> {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      return session;
    }

    logger.info(`[UnifiedAIAgent] 🚀 創建新的 AI Agent 會話: ${sessionId}`);

    const finalConfig = { ...this.defaultConfig, ...config };

    // 初始化 OpenAI 模型
    if (!this.model) {
      this.model = new ChatOpenAI({
        openAIApiKey: finalConfig.apiKey!,
        modelName: finalConfig.model || "gpt-4o",
        temperature: finalConfig.temperature || 0.1,
        maxTokens: finalConfig.maxTokens || 4000,
      });
    }

    // 創建記憶體管理
    const memory = new ConversationBufferWindowMemory({
      k: finalConfig.contextWindow || 20,
      memoryKey: "chat_history",
      returnMessages: true,
      outputKey: "output",
      inputKey: "input",
    });

    // 選擇工具
    const availableTools = this.selectToolsForSession(finalConfig);
    
    // 創建 Agent
    const agent = await this.createUnifiedAgent(availableTools, memory, finalConfig);

    const session: AgentSession = {
      sessionId,
      config: finalConfig,
      memory,
      agent,
      availableTools,
      lastActivity: new Date(),
      createdAt: new Date(),
      messageCount: 0,
      tokenCount: 0
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 處理用戶訊息
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
    config: UnifiedAgentConfig
  ): Promise<AgentResponse> {
    try {
      const session = await this.getOrCreateSession(sessionId, config);
      
      session.messageCount++;
      session.tokenCount += this.estimateTokens(userMessage);

      const startTime = Date.now();
      const result = await session.agent.invoke({
        input: userMessage,
        chat_history: await session.memory.chatHistory.getMessages()
      });

      const toolCalls = (result.intermediateSteps || []).map((step: any, index: number) => ({
        toolId: `tool_${index}`,
        toolName: step.action?.tool || 'unknown',
        input: step.action?.toolInput || {},
        output: step.observation || '',
        success: !step.observation?.includes('Error'),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: step.observation?.includes('Error') ? step.observation : undefined
      }));

      session.tokenCount += this.estimateTokens(result.output);

      return {
        message: result.output,
        toolCalls,
        reasoning: this.extractReasoning(result),
        confidence: this.calculateConfidence(result, toolCalls),
        sessionInfo: {
          sessionId,
          messageCount: session.messageCount,
          tokenCount: session.tokenCount,
          sessionAge: this.formatDuration(Date.now() - session.createdAt.getTime())
        },
        contextUpdate: {
          added: [`用戶訊息: ${userMessage.substring(0, 50)}...`],
          updated: ['對話歷史'],
          memoryTokens: session.tokenCount
        },
        needsUserInput: false
      };

    } catch (error) {
      logger.error(`[UnifiedAIAgent] ❌ 處理訊息失敗:`, error);
      
      return {
        message: `❌ 處理訊息時發生錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolCalls: [],
        sessionInfo: {
          sessionId,
          messageCount: 0,
          tokenCount: 0,
          sessionAge: '0s'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private selectToolsForSession(config: UnifiedAgentConfig): DynamicTool[] {
    const selectedCategories: ToolCategory[] = ['ai', 'docker', 'filesystem', 'project'];
    const selectedTools: FunctionDefinition[] = [];
    
    for (const category of selectedCategories) {
      const categoryTools = toolsByCategory[category] || [];
      selectedTools.push(...categoryTools);
    }

    return selectedTools.map(convertToLangchainTool);
  }

  private async createUnifiedAgent(
    tools: DynamicTool[],
    memory: ConversationBufferWindowMemory,
    config: UnifiedAgentConfig
  ): Promise<AgentExecutor> {
    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessagePromptTemplate({
        template: `你是專業的 AI 開發助手，協助開發專案「${config.projectName}」。

## 🛠️ 統一工具系統
使用新的統一 Function Call 系統，包含：
- 🤖 AI 工具：代理執行、聊天會話、工具註冊、上下文管理
- 🐳 Docker 工具：容器管理、檔案操作、命令執行
- 📁 檔案系統：檔案讀寫、目錄操作、搜尋
- 📋 專案管理：專案資訊、工作區管理、程式碼分析

可用工具: {tool_names}`
      }),
      new MessagesPlaceholder("chat_history"),
      new HumanMessagePromptTemplate({
        template: "用戶請求: {input}"
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
      verbose: config.enableLogging || false,
      maxIterations: config.maxIterations || 10,
      earlyStoppingMethod: "generate"
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  getSessionStats() {
    const activeSessions = this.sessions.size;
    const totalMemoryUsage = Array.from(this.sessions.values())
      .reduce((total, session) => total + session.tokenCount, 0);

    let oldestSession: string | undefined;
    let sessionAge: string | undefined;

    if (activeSessions > 0) {
      const oldest = Array.from(this.sessions.entries())
        .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      
      oldestSession = oldest[0];
      sessionAge = this.formatDuration(Date.now() - oldest[1].createdAt.getTime());
    }

    return {
      activeSessions,
      totalMemoryUsage,
      oldestSession,
      sessionAge,
      totalMessages: Array.from(this.sessions.values()).reduce((total, session) => total + session.messageCount, 0),
      totalTokens: totalMemoryUsage
    };
  }

  /**
   * 從 Agent 結果中提取推理過程
   */
  private extractReasoning(result: any): string {
    // 嘗試從結果中提取推理信息
    if (result.intermediateSteps && result.intermediateSteps.length > 0) {
      const steps = result.intermediateSteps.map((step: any, index: number) => 
        `步驟 ${index + 1}: 使用 ${step.action?.tool || '工具'} - ${step.observation || '執行完成'}`
      );
      return steps.join('\n');
    }
    return '直接回應用戶請求';
  }

  /**
   * 計算回應的信心度
   */
  private calculateConfidence(result: any, toolCalls: ToolCallResult[]): number {
    let confidence = 0.8; // 基礎信心度

    // 根據工具調用成功率調整
    if (toolCalls.length > 0) {
      const successRate = toolCalls.filter(call => call.success).length / toolCalls.length;
      confidence = confidence * (0.5 + successRate * 0.5);
    }

    // 根據回應長度調整
    if (result.output && result.output.length > 100) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 清理過期會話
   */
  cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > maxAge) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
      logger.info(`[UnifiedAIAgent] 🗑️ 清理過期會話: ${sessionId}`);
    }
  }

  /**
   * 獲取可用工具列表
   */
  getAvailableTools(): { name: string; description: string; category: string }[] {
    return allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category
    }));
  }

  /**
   * 搜尋工具
   */
  searchAvailableTools(query: string): FunctionDefinition[] {
    return searchTools(query);
  }
}

/**
 * 創建統一 AI Agent 整合器實例
 */
export function createUnifiedAIAgent(config?: Partial<UnifiedAgentConfig>): UnifiedAIAgentIntegrator {
  return new UnifiedAIAgentIntegrator(config);
}

/**
 * 顯示遷移警告
 */
export function showMigrationWarning(): void {
  console.warn(`
🚨 遷移通知: 舊的 AI Agent 系統已棄用

請使用新的統一 AI Agent 系統：
- 舊的: langchain-chat-engine.ts, chat-agent-integration.ts
- 新的: unified-ai-agent-integration.ts

新系統提供：
✅ 統一的 Function Call 格式
✅ 更好的工具分類和管理
✅ 改進的錯誤處理和重試機制
✅ 完整的 TypeScript 類型支援
✅ 向後相容的 API

遷移指南: docs/unified-function-call-system.md
`);
}

// 預設導出
export default {
  UnifiedAIAgentIntegrator,
  createUnifiedAIAgent,
  showMigrationWarning
}; 