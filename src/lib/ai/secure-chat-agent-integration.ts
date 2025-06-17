/**
 * 安全聊天 AI 與 Agent 控制框架整合模組
 * 使用嚴格的 Docker 工具，完全鎖定在容器內專案目錄
 * 替換不安全的舊版 ChatAgentIntegrator
 */

import { logger } from '../logger';
import { AgentController, AgentConfig, Message, ToolResult } from './agent-controller';
import { StrictToolRegistry } from './strict-tool-registry';
import { StrictAgentFactory } from './strict-agent-factory';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { OpenAIService } from './openai-service';
import { aiOutputLogger } from './ai-output-logger';

export interface SecureChatAgentConfig {
  // 必要配置（安全要求）
  projectName: string;
  dockerContainerId: string;
  conversationId: string;
  apiToken: string;
  
  // Agent 配置
  maxToolCalls?: number;
  maxRetries?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
  
  // 聊天特定配置
  enableAutoRepair?: boolean;
  temperature?: number;
  model?: string;
}

export interface SecureChatAgentResponse {
  message: string;
  success: boolean;
  toolCallsExecuted: number;
  conversationId: string;
  
  // 安全資訊
  securityInfo: {
    securityLevel: 'MAXIMUM';
    workingDirectory: string;
    projectName: string;
    containerId: string;
  };
  
  // Agent 特定資訊
  agentStats: {
    totalToolCalls: number;
    successfulCalls: number;
    failedCalls: number;
    executionTime: number;
  };
  
  // 聊天特定資訊
  session: {
    id: string;
    messageCount: number;
    toolCallCount: number;
  };
  
  // 錯誤處理
  error?: string;
  needsUserInput?: boolean;
  
  // 自動修復相關
  autoRepairResult?: {
    completionStatus: string;
    repairAttempts: number;
    riskLevel: string;
  };
}

/**
 * 安全聊天 Agent 整合器
 * 使用嚴格的 Docker 工具，確保所有操作都限制在專案目錄內
 */
export class SecureChatAgentIntegrator {
  private agentController?: AgentController;
  private strictToolRegistry?: StrictToolRegistry;
  private strictAgentFactory: StrictAgentFactory;
  private dockerManager?: DockerAIEditorManager;
  private openaiService?: OpenAIService;
  
  private config: Required<SecureChatAgentConfig>;
  private conversationHistory: Message[] = [];
  private toolCallStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    executionTimes: [] as number[],
  };

  constructor(config: SecureChatAgentConfig) {
    // 驗證必要配置
    if (!config.projectName || !config.dockerContainerId) {
      throw new Error('projectName 和 dockerContainerId 是安全聊天所必需的配置');
    }

    this.config = {
      maxToolCalls: config.maxToolCalls ?? 3, // 降低以提高安全性
      maxRetries: config.maxRetries ?? 1,     // 降低以提高安全性
      timeoutMs: config.timeoutMs ?? 20000,   // 降低以提高安全性
      enableLogging: config.enableLogging ?? true,
      enableAutoRepair: config.enableAutoRepair ?? false,
      temperature: config.temperature ?? 0.1,
      model: config.model ?? 'gpt-4o',
      ...config,
    };

    this.strictAgentFactory = StrictAgentFactory.getInstance();
  }

  /**
   * 初始化安全 Agent 控制器和相關組件
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[SecureChatAgentIntegrator] 🔒 初始化安全聊天 Agent 整合器: ${this.config.conversationId}`);
      
      // 記錄初始化開始
      await aiOutputLogger.logSystem(
        'SecureChatAgentIntegrator',
        '開始初始化安全聊天 Agent 整合器',
        { 
          conversationId: this.config.conversationId,
          projectName: this.config.projectName,
          containerId: this.config.dockerContainerId,
          securityLevel: 'MAXIMUM'
        }
      );

      // 使用嚴格的 Agent 工廠建立所有組件
      const strictConfig = {
        projectName: this.config.projectName,
        dockerContainerId: this.config.dockerContainerId,
        openaiApiKey: this.config.apiToken,
        openaiModel: this.config.model,
        maxToolCalls: this.config.maxToolCalls,
        maxRetries: this.config.maxRetries,
        timeoutMs: this.config.timeoutMs,
        enableLogging: this.config.enableLogging,
      };

      // 建立嚴格的 Agent 控制器
      this.agentController = await this.strictAgentFactory.createStrictAgentController(strictConfig);
      
      // 獲取系統狀態以確認初始化成功
      const systemStatus = this.strictAgentFactory.getStrictSystemStatus();
      
      if (!systemStatus.dockerManager || !systemStatus.strictToolRegistry || !systemStatus.agentController) {
        throw new Error('嚴格系統組件初始化不完整');
      }

      logger.info(`[SecureChatAgentIntegrator] ✅ 安全聊天 Agent 整合器初始化完成`);
      logger.info(`[SecureChatAgentIntegrator] 🛡️ 安全級別: ${systemStatus.securityLevel}`);
      logger.info(`[SecureChatAgentIntegrator] 📁 工作目錄: ${systemStatus.projectInfo?.workingDirectory}`);
      
      // 記錄初始化完成
      await aiOutputLogger.logSystem(
        'SecureChatAgentIntegrator',
        '安全聊天 Agent 整合器初始化完成',
        { 
          systemStatus,
          securityLevel: 'MAXIMUM',
          workingDirectory: systemStatus.projectInfo?.workingDirectory
        }
      );

    } catch (error) {
      logger.error(`[SecureChatAgentIntegrator] ❌ 初始化失敗: ${error}`);
      await aiOutputLogger.logError(
        'SecureChatAgentIntegrator',
        `初始化失敗: ${error}`,
        { config: this.config, error: String(error) }
      );
      throw new Error(`安全聊天 Agent 整合器初始化失敗: ${error}`);
    }
  }

  /**
   * 處理聊天訊息（使用嚴格的 Agent 控制器）
   */
  async processMessage(userMessage: string): Promise<SecureChatAgentResponse> {
    if (!this.agentController) {
      throw new Error('安全 Agent 控制器尚未初始化');
    }

    const startTime = Date.now();
    let toolCallsExecuted = 0;

    try {
      logger.info(`[SecureChatAgentIntegrator] 📝 處理安全訊息: ${userMessage.substring(0, 100)}...`);
      
      // 記錄訊息處理開始
      await aiOutputLogger.logDecision(
        'SecureChatAgentIntegrator',
        '開始處理聊天訊息',
        { 
          userMessage: userMessage.substring(0, 200),
          conversationId: this.config.conversationId,
          projectName: this.config.projectName,
          securityLevel: 'MAXIMUM'
        }
      );

      // 建立安全的系統提示詞
      const systemPrompt = this.buildSecureChatSystemPrompt();

      // 使用嚴格的 Agent 控制器處理訊息
      const agentResult = await this.agentController.runAgentController(
        userMessage,
        systemPrompt
      );

      // 更新統計資訊
      const executionTime = Date.now() - startTime;
      this.updateStats(true, executionTime);
      
      // 獲取系統狀態
      const systemStatus = this.strictAgentFactory.getStrictSystemStatus();

      const response: SecureChatAgentResponse = {
        message: agentResult,
        success: true,
        toolCallsExecuted: toolCallsExecuted,
        conversationId: this.config.conversationId,
        securityInfo: {
          securityLevel: 'MAXIMUM',
          workingDirectory: systemStatus.projectInfo?.workingDirectory || `/app/workspace/${this.config.projectName}`,
          projectName: this.config.projectName,
          containerId: this.config.dockerContainerId,
        },
        agentStats: {
          totalToolCalls: this.toolCallStats.totalCalls,
          successfulCalls: this.toolCallStats.successfulCalls,
          failedCalls: this.toolCallStats.failedCalls,
          executionTime: executionTime,
        },
        session: {
          id: this.config.conversationId,
          messageCount: this.conversationHistory.length + 1,
          toolCallCount: this.toolCallStats.totalCalls,
        },
      };

      // 更新對話歷史
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: agentResult }
      );

      // 記錄處理完成
      await aiOutputLogger.logOutput(
        'SecureChatAgentIntegrator',
        '聊天訊息處理完成',
        { 
          responseLength: agentResult.length,
          executionTime,
          toolCallsExecuted,
          securityLevel: 'MAXIMUM'
        }
      );

      logger.info(`[SecureChatAgentIntegrator] ✅ 訊息處理完成，執行時間: ${executionTime}ms`);
      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(false, executionTime);
      
      logger.error(`[SecureChatAgentIntegrator] ❌ 訊息處理失敗: ${error}`);
      
      // 記錄處理失敗
      await aiOutputLogger.logError(
        'SecureChatAgentIntegrator',
        `聊天訊息處理失敗: ${error}`,
        { 
          userMessage: userMessage.substring(0, 200),
          executionTime,
          error: String(error)
        }
      );

      // 獲取系統狀態（即使出錯也要提供安全資訊）
      const systemStatus = this.strictAgentFactory.getStrictSystemStatus();

      return {
        message: `處理訊息時發生錯誤: ${error}`,
        success: false,
        toolCallsExecuted: toolCallsExecuted,
        conversationId: this.config.conversationId,
        securityInfo: {
          securityLevel: 'MAXIMUM',
          workingDirectory: systemStatus.projectInfo?.workingDirectory || `/app/workspace/${this.config.projectName}`,
          projectName: this.config.projectName,
          containerId: this.config.dockerContainerId,
        },
        agentStats: {
          totalToolCalls: this.toolCallStats.totalCalls,
          successfulCalls: this.toolCallStats.successfulCalls,
          failedCalls: this.toolCallStats.failedCalls,
          executionTime: executionTime,
        },
        session: {
          id: this.config.conversationId,
          messageCount: this.conversationHistory.length,
          toolCallCount: this.toolCallStats.totalCalls,
        },
        error: String(error),
      };
    }
  }

  /**
   * 建立安全聊天專用的系統提示詞
   */
  private buildSecureChatSystemPrompt(): string {
    const systemStatus = this.strictAgentFactory.getStrictSystemStatus();
    const toolStats = systemStatus.toolStats as any;
    
    return `你是一個專業的 AI 開發助手，正在協助開發專案「${this.config.projectName}」。

## 🔒 安全工作環境
- 專案名稱: ${this.config.projectName}
- 對話 ID: ${this.config.conversationId}
- 安全級別: MAXIMUM
- 工作目錄: ${systemStatus.projectInfo?.workingDirectory}（嚴格鎖定）
- 容器 ID: ${this.config.dockerContainerId}

## 🛠️ 可用的安全工具
你只能使用以下嚴格的 Docker 工具（所有操作都限制在專案目錄內）：
${toolStats?.toolNames?.map((tool: string) => `- ${tool}`).join('\n') || '- 工具載入中...'}

## 🛡️ 安全原則
1. **絕對安全**: 只能操作 ${systemStatus.projectInfo?.workingDirectory} 目錄內的檔案
2. **路徑限制**: 禁止使用 ../ 或絕對路徑訪問專案外的檔案
3. **工具限制**: 只能使用 strict_docker_* 開頭的工具
4. **錯誤處理**: 如果工具執行失敗，嘗試其他安全方法或告知用戶
5. **透明度**: 告知用戶所有操作都在安全沙箱環境中進行

## 📋 工作原則
1. **智能決策**: 根據用戶需求決定是否需要使用工具
2. **先工具後分析**: 使用工具獲取資訊後再進行分析和回應
3. **簡潔回應**: 提供有用且簡潔的回應
4. **繁體中文**: 使用繁體中文進行交流
5. **安全提醒**: 適時提醒用戶當前的安全限制

## 🔧 特殊能力
- 讀取專案內的檔案
- 列出專案內的目錄結構
- 搜尋專案內的檔案
- 獲取專案資訊
- 在專案內創建和修改檔案

## ⚠️ 安全限制
- 無法訪問專案目錄外的任何檔案
- 無法執行系統級命令
- 無法訪問敏感系統檔案
- 所有操作都會進行安全驗證

請協助用戶完成開發任務，同時嚴格遵守安全限制。`;
  }

  /**
   * 更新統計資訊
   */
  private updateStats(success: boolean, executionTime: number): void {
    this.toolCallStats.totalCalls++;
    if (success) {
      this.toolCallStats.successfulCalls++;
    } else {
      this.toolCallStats.failedCalls++;
    }
    this.toolCallStats.executionTimes.push(executionTime);
  }

  /**
   * 獲取統計資訊
   */
  getStats() {
    const avgExecutionTime = this.toolCallStats.executionTimes.length > 0
      ? this.toolCallStats.executionTimes.reduce((a, b) => a + b, 0) / this.toolCallStats.executionTimes.length
      : 0;

    const systemStatus = this.strictAgentFactory.getStrictSystemStatus();

    return {
      conversation: {
        id: this.config.conversationId,
        messageCount: this.conversationHistory.length,
        projectName: this.config.projectName,
      },
      toolCalls: this.toolCallStats,
      performance: {
        averageExecutionTime: Math.round(avgExecutionTime),
        totalExecutionTime: this.toolCallStats.executionTimes.reduce((a, b) => a + b, 0),
      },
      security: {
        level: 'MAXIMUM',
        workingDirectory: systemStatus.projectInfo?.workingDirectory,
        containerId: this.config.dockerContainerId,
        toolCount: systemStatus.toolStats ? (systemStatus.toolStats as any).totalTools : 0,
      },
    };
  }

  /**
   * 獲取對話歷史
   */
  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * 獲取安全報告
   */
  getSecurityReport() {
    const systemStatus = this.strictAgentFactory.getStrictSystemStatus();
    const toolStats = systemStatus.toolStats as any;
    
    return {
      securityLevel: 'MAXIMUM',
      projectName: this.config.projectName,
      containerId: this.config.dockerContainerId,
      workingDirectory: systemStatus.projectInfo?.workingDirectory,
      toolsAvailable: toolStats?.toolNames || [],
      safetyMeasures: [
        'Path traversal protection',
        'Absolute path restriction',
        'System file access prevention',
        'Container isolation',
        'Real-time security validation',
      ],
      conversationId: this.config.conversationId,
      messageCount: this.conversationHistory.length,
    };
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    logger.info(`[SecureChatAgentIntegrator] 🧹 清理對話資源: ${this.config.conversationId}`);
    this.conversationHistory = [];
    this.toolCallStats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      executionTimes: [],
    };
    // 重置嚴格工廠（如果需要）
    // this.strictAgentFactory.reset();
  }
} 