/**
 * 聊天 AI 與 Agent 控制框架整合模組
 * 將新的 Agent 控制器整合到現有的聊天 AI 系統中
 */

import { logger } from '../logger';
import { AgentController, AgentConfig, Message, ToolResult } from './agent-controller';
import { EnhancedToolRegistry, ToolSchema } from './enhanced-tool-registry';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { OpenAIService } from './openai-service';
import { DOCKER_TOOL_REGISTRY, DockerToolDefinition } from '../docker/tool-registry';
import { createDockerToolkit, DockerToolkit } from '../docker/tools';

export interface ChatAgentConfig {
  projectId: string;
  projectName: string;
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

export interface ChatAgentResponse {
  message: string;
  success: boolean;
  toolCallsExecuted: number;
  conversationId: string;
  
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
 * 聊天 Agent 整合器
 * 負責協調新的 Agent 控制器與現有聊天系統
 */
export class ChatAgentIntegrator {
  private agentController?: AgentController;
  private toolRegistry?: EnhancedToolRegistry;
  private dockerManager?: DockerAIEditorManager;
  private openaiService?: OpenAIService;
  private dockerToolkit?: DockerToolkit;
  
  private config: Required<ChatAgentConfig>;
  private conversationHistory: Message[] = [];
  private toolCallStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    executionTimes: [] as number[],
  };

  constructor(config: ChatAgentConfig) {
    this.config = {
      maxToolCalls: config.maxToolCalls ?? 5,
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 30000,
      enableLogging: config.enableLogging ?? true,
      enableAutoRepair: config.enableAutoRepair ?? false,
      temperature: config.temperature ?? 0.1,
      model: config.model ?? 'gpt-4o',
      ...config,
    };
  }

  /**
   * 初始化 Agent 控制器和相關組件
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`[ChatAgentIntegrator] 🚀 初始化聊天 Agent 整合器: ${this.config.conversationId}`);

      // 1. 動態檢測 Docker 配置
      let dockerContext;
      try {
        // 嘗試從 Docker 配置管理器獲取配置
        const { dockerConfigManager } = await import('../docker/docker-context-config');
        const dockerConfig = await dockerConfigManager.autoDetectDockerContext(this.config.projectName);
        
        if (dockerConfig.success && dockerConfig.dockerContext) {
          dockerContext = dockerConfig.dockerContext;
          logger.info(`[ChatAgentIntegrator] ✅ 使用動態檢測的 Docker 配置: ${dockerContext.containerId}`);
        } else {
          throw new Error(`Docker 配置檢測失敗: ${dockerConfig.message}`);
        }
      } catch (error) {
        // 回退到預設配置
        logger.warn(`[ChatAgentIntegrator] ⚠️ Docker 動態檢測失敗，使用預設配置: ${error}`);
        dockerContext = {
          containerId: `ai-web-ide-${this.config.projectName.toLowerCase().replace(/\s+/g, '-')}`,
          containerName: `ai-chat-${this.config.projectName}`,
          workingDirectory: '/app',
          status: 'running' as const
        };
      }

      // 2. 建立 Docker 管理器
      this.dockerManager = new DockerAIEditorManager({
        dockerContext,
        enableUserConfirmation: false, // 聊天模式下不需要用戶確認
        enableActionLogging: this.config.enableLogging,
        enableAdvancedTools: true
      });

      // 3. 建立 Docker 工具包（保持與現有系統的相容性）
      this.dockerToolkit = createDockerToolkit(dockerContext);

      // 4. 建立 OpenAI 服務
      this.openaiService = new OpenAIService(this.config.apiToken);

      // 5. 建立增強的工具註冊器
      this.toolRegistry = new EnhancedToolRegistry(
        this.dockerManager,
        this.config.enableLogging
      );

      // 6. 註冊現有的 Docker 工具
      await this.registerExistingDockerTools();

      // 7. 建立 Agent 控制器
      const agentConfig: AgentConfig = {
        maxToolCalls: this.config.maxToolCalls,
        maxRetries: this.config.maxRetries,
        timeoutMs: this.config.timeoutMs,
        enableLogging: this.config.enableLogging,
      };

      this.agentController = new AgentController(
        this.toolRegistry,
        this.openaiService,
        agentConfig
      );

      logger.info(`[ChatAgentIntegrator] ✅ 聊天 Agent 整合器初始化完成`);

    } catch (error) {
      logger.error(`[ChatAgentIntegrator] ❌ 初始化失敗: ${error}`);
      throw new Error(`聊天 Agent 整合器初始化失敗: ${error}`);
    }
  }

  /**
   * 處理聊天訊息（使用 Agent 控制器）
   */
  async processMessage(userMessage: string): Promise<ChatAgentResponse> {
    if (!this.agentController) {
      throw new Error('Agent 控制器尚未初始化');
    }

    const startTime = Date.now();
    let toolCallsExecuted = 0;

    try {
      logger.info(`[ChatAgentIntegrator] 📝 處理訊息: ${userMessage.substring(0, 100)}...`);

      // 建立專門的系統提示詞
      const systemPrompt = this.buildChatSystemPrompt();

      // 使用 Agent 控制器處理訊息
      const agentResult = await this.agentController.runAgentController(
        userMessage,
        systemPrompt
      );

      // 更新統計資訊
      const executionTime = Date.now() - startTime;
      this.updateStats(true, executionTime);

      // 記錄對話歷史
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: agentResult }
      );

      // 保持歷史記錄在合理範圍內
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-16);
      }

      logger.info(`[ChatAgentIntegrator] ✅ 訊息處理完成，執行時間: ${executionTime}ms`);

      return {
        message: agentResult,
        success: true,
        toolCallsExecuted: toolCallsExecuted,
        conversationId: this.config.conversationId,
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
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(false, executionTime);

      logger.error(`[ChatAgentIntegrator] ❌ 訊息處理失敗: ${error}`);

      return {
        message: `處理訊息時發生錯誤: ${error}`,
        success: false,
        toolCallsExecuted: toolCallsExecuted,
        conversationId: this.config.conversationId,
        error: error instanceof Error ? error.message : '未知錯誤',
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
      };
    }
  }

  /**
   * 註冊現有的 Docker 工具到新的工具註冊器
   */
  private async registerExistingDockerTools(): Promise<void> {
    if (!this.toolRegistry || !this.dockerToolkit) {
      throw new Error('工具註冊器或 Docker 工具包尚未初始化');
    }

    logger.info(`[ChatAgentIntegrator] 🔧 註冊現有 Docker 工具...`);

    // 註冊開發伺服器工具
    this.registerDevServerTools();
    
    // 註冊日誌監控工具
    this.registerLogMonitorTools();
    
    // 註冊健康檢查工具
    this.registerHealthCheckTools();
    
    // 註冊檔案系統工具
    this.registerFileSystemTools();
    
    // 註冊容器管理工具
    this.registerContainerTools();

    logger.info(`[ChatAgentIntegrator] ✅ 現有 Docker 工具註冊完成`);
  }

  /**
   * 註冊開發伺服器工具
   */
  private registerDevServerTools(): void {
    if (!this.toolRegistry) return;

    // 啟動開發伺服器
    this.toolRegistry.addCustomTool(
      'docker_start_dev_server',
      '在 Docker 容器內啟動開發伺服器',
      {
        type: 'object',
        properties: {},
        required: [],
      },
      async () => {
        const result = await this.dockerToolkit!.devServer.startDevServer();
        return {
          success: result.success,
          data: result,
          message: result.message,
          error: result.error,
        };
      }
    );

    // 重啟開發伺服器
    this.toolRegistry.addCustomTool(
      'docker_restart_dev_server',
      '在 Docker 容器內重啟開發伺服器',
      {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '重啟原因' },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.devServer.restartDevServer(params.reason);
        return {
          success: result.success,
          data: result,
          message: result.message,
          error: result.error,
        };
      }
    );

    // 檢查開發伺服器狀態
    this.toolRegistry.addCustomTool(
      'docker_check_dev_server_status',
      '檢查 Docker 容器內開發伺服器狀態',
      {
        type: 'object',
        properties: {},
        required: [],
      },
      async () => {
        const result = await this.dockerToolkit!.devServer.checkDevServerStatus();
        return {
          success: result.success,
          data: result.data,
          message: result.message,
        };
      }
    );
  }

  /**
   * 註冊日誌監控工具
   */
  private registerLogMonitorTools(): void {
    if (!this.toolRegistry) return;

    // 讀取日誌尾部
    this.toolRegistry.addCustomTool(
      'docker_read_log_tail',
      '讀取 Docker 容器內最近日誌',
      {
        type: 'object',
        properties: {
          lines: { type: 'number', description: '讀取行數（預設 3000，最大 10000）', default: 3000 },
          logFile: { type: 'string', description: '日誌檔案名稱（預設 dev.log）', default: 'dev.log' },
          keyword: { type: 'string', description: '搜尋關鍵字' },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.logMonitor.readLogTail(params);
        return {
          success: result.success,
          data: result.data,
          message: result.message,
          error: result.error,
        };
      }
    );

    // 搜尋錯誤日誌
    this.toolRegistry.addCustomTool(
      'docker_search_error_logs',
      '搜尋 Docker 容器內錯誤日誌',
      {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '錯誤關鍵字（預設 Error）', default: 'Error' },
          lines: { type: 'number', description: '搜尋範圍行數（預設 1000）', default: 1000 },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.logMonitor.searchErrorLogs(params.keyword, params.lines);
        return {
          success: result.success,
          data: result.data,
          message: result.message,
        };
      }
    );
  }

  /**
   * 註冊健康檢查工具
   */
  private registerHealthCheckTools(): void {
    if (!this.toolRegistry) return;

    // 容器健康檢查
    this.toolRegistry.addCustomTool(
      'docker_health_check',
      '執行 Docker 容器健康檢查',
      {
        type: 'object',
        properties: {},
        required: [],
      },
      async () => {
        const result = await this.dockerToolkit!.healthCheck.performHealthCheck();
        return {
          success: result.success,
          data: result.data,
          message: result.message,
        };
      }
    );

    // 檢查網路連通性
    this.toolRegistry.addCustomTool(
      'docker_check_network_connectivity',
      '檢查 Docker 容器網路連通性',
      {
        type: 'object',
        properties: {
          target: { type: 'string', description: '目標地址（預設 google.com）', default: 'google.com' },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.healthCheck.checkNetworkConnectivity(params.target);
        return {
          success: result.success,
          data: result.data,
          message: result.message,
        };
      }
    );
  }

  /**
   * 註冊檔案系統工具
   */
  private registerFileSystemTools(): void {
    if (!this.toolRegistry) return;

    // 列出目錄內容 (docker_list_directory)
    this.toolRegistry.addCustomTool(
      'docker_list_directory',
      '列出 Docker 容器內目錄內容',
      {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '目錄路徑（預設為當前目錄）', default: '.' },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.fileSystem.listDirectory(params.dirPath || '.');
        return {
          success: result.success,
          data: result.data,
          message: result.message,
          error: result.error,
        };
      }
    );

    // 列出檔案 (docker_list_files)
    this.toolRegistry.addCustomTool(
      'docker_list_files',
      '列出 Docker 容器內目錄內容',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目錄路徑（預設 /app）', default: '/app' },
          recursive: { type: 'boolean', description: '是否遞迴列出', default: false },
        },
        required: [],
      },
      async (params) => {
        const result = await this.dockerToolkit!.fileSystem.listDirectory(
          params.path || '/app', 
          { recursive: params.recursive || false }
        );
        return {
          success: result.success,
          data: result.data,
          message: result.message,
        };
      }
    );

    // 搜尋檔案 (docker_find_files)
    this.toolRegistry.addCustomTool(
      'docker_find_files',
      '搜尋 Docker 容器內的檔案',
      {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '搜尋模式' },
          searchPath: { type: 'string', description: '搜尋路徑（預設為當前目錄）', default: '.' },
        },
        required: ['pattern'],
      },
      async (params) => {
        const result = await this.dockerToolkit!.fileSystem.listDirectory(
          params.searchPath || '.',
          { recursive: true }
        );
        if (result.success && result.data) {
          const matchingFiles = result.data.filter((item: string) => {
            const fileName = item.split('/').pop() || '';
            return fileName.includes(params.pattern) || fileName.match(new RegExp(params.pattern.replace('*', '.*')));
          });
          return {
            success: true,
            data: matchingFiles,
            message: `找到 ${matchingFiles.length} 個符合 "${params.pattern}" 的檔案`,
          };
        } else {
          return {
            success: false,
            error: `搜尋檔案失敗: ${result.error}`,
          };
        }
      }
    );

    // 創建檔案
    this.toolRegistry.addCustomTool(
      'docker_create_file',
      '在 Docker 容器內創建檔案',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: '檔案路徑' },
          content: { type: 'string', description: '檔案內容' },
        },
        required: ['path', 'content'],
      },
      async (params) => {
        // 使用 writeFile 方法來創建檔案
        const result = await this.dockerToolkit!.fileSystem.writeFile(params.path, params.content);
        return {
          success: result.success,
          data: result.data,
          message: result.message || `成功創建檔案: ${params.path}`,
          error: result.error,
        };
      }
    );

    // 刪除檔案
    this.toolRegistry.addCustomTool(
      'docker_delete_file',
      '刪除 Docker 容器內的檔案',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: '檔案路徑' },
        },
        required: ['path'],
      },
      async (params) => {
        // 使用 Docker 執行 rm 命令來刪除檔案
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          const command = `docker exec ${this.dockerManager!.getDockerContext().containerId} rm "${params.path}"`;
          await execAsync(command);
          
          return {
            success: true,
            data: { deletedPath: params.path },
            message: `成功刪除檔案: ${params.path}`,
          };
        } catch (error) {
          return {
            success: false,
            error: `刪除檔案失敗: ${error}`,
          };
        }
      }
    );
  }

  /**
   * 註冊容器管理工具
   */
  private registerContainerTools(): void {
    if (!this.toolRegistry) return;

    // 執行命令
    this.toolRegistry.addCustomTool(
      'docker_execute_command',
      '在 Docker 容器內執行命令',
      {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要執行的命令' },
        },
        required: ['command'],
      },
      async (params) => {
        const result = await this.dockerToolkit!.container.executeCommand(params.command);
        return {
          success: result.success,
          data: result.output,
          message: result.message,
          error: result.error,
        };
      }
    );
  }

  /**
   * 建立聊天專用的系統提示詞
   */
  private buildChatSystemPrompt(): string {
    const availableTools = this.toolRegistry?.getAllToolNames() || [];
    
    return `你是一個專業的 AI 開發助手，正在協助開發Next.js專案「${this.config.projectName}」。

## 🎯 工作環境
- 專案 ID: ${this.config.projectId}
- 對話 ID: ${this.config.conversationId}
- Docker 容器環境: /app 工作目錄

## 🛠️ 可用工具
你可以使用以下工具來完成任務：
${availableTools.map(tool => `- ${tool}`).join('\n')}

## 📋 工作原則
1. **智能決策**: 根據用戶需求決定是否需要使用工具
2. **先工具後分析**: 使用工具獲取資訊後再進行分析和回應
3. **錯誤處理**: 如果工具執行失敗，嘗試其他方法或告知用戶
4. **簡潔回應**: 提供有用且簡潔的回應
5. **繁體中文**: 使用繁體中文進行交流

## 🔧 特殊能力
- 可以讀取和分析專案檔案
- 可以管理 Docker 容器內的開發伺服器
- 可以監控日誌和錯誤
- 可以執行檔案操作和命令
- 可以進行健康檢查和診斷

## 💡 互動模式
- 當需要獲取資訊時，主動使用相關工具
- 根據工具執行結果提供分析和建議
- 如果無法完成任務，清楚說明原因和可能的解決方案

請根據用戶的需求，智能地使用工具並提供專業的協助。`;
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

    return {
      ...this.toolCallStats,
      averageExecutionTime: Math.round(avgExecutionTime),
      successRate: this.toolCallStats.totalCalls > 0 
        ? (this.toolCallStats.successfulCalls / this.toolCallStats.totalCalls * 100).toFixed(1)
        : '0.0',
    };
  }

  /**
   * 獲取對話歷史
   */
  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    logger.info(`[ChatAgentIntegrator] 🧹 清理資源: ${this.config.conversationId}`);
    // 清理相關資源（如果需要）
  }
} 