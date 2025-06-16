// Docker AI 編輯器管理器 - 統一管理所有 Docker AI 工具和功能
// 這個模組是 Docker AI 編輯器的核心控制器，負責協調 Docker 工具和容器操作

import { createDockerToolkit, DockerToolkit, DockerContext } from './docker-tools';
import { 
  DockerAIToolName, 
  DockerAIToolParameters, 
  DockerAIToolResponse,
  getDockerFunctionDefinitionsForOpenAI,
  getDockerFunctionDefinitionsGeneric
} from './docker-function-schemas';

export interface DockerAIEditorConfig {
  dockerContext: DockerContext;
  enableUserConfirmation?: boolean;
  enableActionLogging?: boolean;
  enableAdvancedTools?: boolean;
}

export interface UserConfirmationRequest {
  message: string;
  options?: string[];
  timeout?: number;
}

export interface PendingAction {
  id: string;
  toolName: DockerAIToolName;
  parameters: Record<string, unknown>;
  confirmationRequest?: UserConfirmationRequest;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'error';
}

// 🐳 Docker AI 編輯器管理器
export class DockerAIEditorManager {
  private config: DockerAIEditorConfig;
  private dockerToolkit: DockerToolkit;
  private pendingActions: Map<string, PendingAction> = new Map();
  private userConfirmationCallbacks: Map<string, (confirmed: boolean, data?: unknown) => void> = new Map();

  constructor(config: DockerAIEditorConfig) {
    this.config = config;
    this.dockerToolkit = createDockerToolkit(config.dockerContext);
  }

  /**
   * 執行 Docker AI 工具調用
   * @param toolName 工具名稱
   * @param parameters 工具參數
   */
  async executeDockerAITool<T extends DockerAIToolName>(
    toolName: T, 
    parameters: DockerAIToolParameters[T]
  ): Promise<DockerAIToolResponse<T>> {
    try {
      // 記錄工具調用
      if (this.config.enableActionLogging) {
        console.log(`🐳 Docker AI Tool Call: ${toolName}`, parameters);
      }

      // 根據工具類型執行相應邏輯
      switch (toolName) {
        case 'docker_start_dev_server':
          return await this.handleStartDevServer() as DockerAIToolResponse<T>;
        
        case 'docker_restart_dev_server':
          return await this.handleRestartDevServer(parameters as DockerAIToolParameters['docker_restart_dev_server']) as DockerAIToolResponse<T>;
        
        case 'docker_kill_dev_server':
          return await this.handleKillDevServer() as DockerAIToolResponse<T>;
        
        case 'docker_check_dev_server_status':
          return await this.handleCheckDevServerStatus() as DockerAIToolResponse<T>;
        
        case 'docker_read_log_tail':
          return await this.handleReadLogTail(parameters as DockerAIToolParameters['docker_read_log_tail']) as DockerAIToolResponse<T>;
        
        case 'docker_search_error_logs':
          return await this.handleSearchErrorLogs(parameters as DockerAIToolParameters['docker_search_error_logs']) as DockerAIToolResponse<T>;
        
        case 'docker_get_log_files':
          return await this.handleGetLogFiles() as DockerAIToolResponse<T>;
        
        case 'docker_check_health':
          return await this.handleCheckHealth(parameters as DockerAIToolParameters['docker_check_health']) as DockerAIToolResponse<T>;
        
        case 'docker_check_container_health':
          return await this.handleCheckContainerHealth() as DockerAIToolResponse<T>;
        
        case 'docker_read_file':
          return await this.handleReadFile(parameters as DockerAIToolParameters['docker_read_file']) as DockerAIToolResponse<T>;
        
        case 'docker_write_file':
          return await this.handleWriteFile(parameters as DockerAIToolParameters['docker_write_file']) as DockerAIToolResponse<T>;
        
        case 'docker_smart_monitor_and_recover':
          return await this.handleSmartMonitorAndRecover() as DockerAIToolResponse<T>;
        
        case 'docker_get_full_status_report':
          return await this.handleGetFullStatusReport() as DockerAIToolResponse<T>;
        
        case 'ask_user':
          return await this.handleAskUser(parameters as DockerAIToolParameters['ask_user']) as DockerAIToolResponse<T>;
        
        default:
          return {
            success: false,
            error: `未知的Docker工具: ${toolName}`
          } as DockerAIToolResponse<T>;
      }
    } catch (error) {
      if (this.config.enableActionLogging) {
        console.error(`❌ Docker AI Tool Error: ${toolName}`, error);
      }

      return {
        success: false,
        error: `Docker工具執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as DockerAIToolResponse<T>;
    }
  }

  // ==================== Docker 工具處理方法 ====================

  private async handleStartDevServer(): Promise<DockerAIToolResponse<'docker_start_dev_server'>> {
    const result = await this.dockerToolkit.devServer.startDevServer();
    return {
      success: result.success,
      data: result.data ? {
        message: result.message || '開發伺服器啟動完成',
        containerOutput: result.containerOutput
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleRestartDevServer(params: DockerAIToolParameters['docker_restart_dev_server']): Promise<DockerAIToolResponse<'docker_restart_dev_server'>> {
    const result = await this.dockerToolkit.devServer.restartDevServer(params.reason);
    return {
      success: result.success,
      data: result.data ? {
        message: result.message || '開發伺服器重啟完成',
        containerOutput: result.containerOutput,
        restartCount: (result.data as any)?.restartCount
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleKillDevServer(): Promise<DockerAIToolResponse<'docker_kill_dev_server'>> {
    const result = await this.dockerToolkit.devServer.killDevServer();
    return {
      success: result.success,
      data: result.success ? {
        message: result.message || '開發伺服器已終止',
        containerOutput: result.containerOutput
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleCheckDevServerStatus(): Promise<DockerAIToolResponse<'docker_check_dev_server_status'>> {
    const result = await this.dockerToolkit.devServer.checkDevServerStatus();
    return {
      success: result.success,
      data: result.data ? {
        isRunning: result.data.isRunning,
        pid: result.data.pid,
        port: result.data.port,
        message: result.message || '狀態檢查完成'
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleReadLogTail(params: DockerAIToolParameters['docker_read_log_tail']): Promise<DockerAIToolResponse<'docker_read_log_tail'>> {
    const result = await this.dockerToolkit.logMonitor.readLogTail({
      lines: params.lines,
      logFile: params.logFile,
      keyword: params.keyword
    });
    return {
      success: result.success,
      data: result.data || [],
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleSearchErrorLogs(params: DockerAIToolParameters['docker_search_error_logs']): Promise<DockerAIToolResponse<'docker_search_error_logs'>> {
    const result = await this.dockerToolkit.logMonitor.searchErrorLogs(params.keyword, params.lines);
    return {
      success: result.success,
      data: result.data || [],
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleGetLogFiles(): Promise<DockerAIToolResponse<'docker_get_log_files'>> {
    const result = await this.dockerToolkit.logMonitor.getLogFiles();
    return {
      success: result.success,
      data: result.data || [],
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleCheckHealth(_params: DockerAIToolParameters['docker_check_health']): Promise<DockerAIToolResponse<'docker_check_health'>> {
    const result = await this.dockerToolkit.healthCheck.checkHealth();
    return {
      success: result.success,
      data: result.data ? {
        status: result.data.status,
        responseTimeMs: result.data.responseTimeMs,
        containerHealth: result.data.containerHealth || 'healthy',
        message: result.message || '健康檢查完成'
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleCheckContainerHealth(): Promise<DockerAIToolResponse<'docker_check_container_health'>> {
    const result = await this.dockerToolkit.healthCheck.checkContainerHealth();
    return {
      success: result.success,
      data: result.success ? {
        message: result.message || '容器健康檢查完成',
        containerOutput: result.containerOutput
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleReadFile(params: DockerAIToolParameters['docker_read_file']): Promise<DockerAIToolResponse<'docker_read_file'>> {
    const result = await this.dockerToolkit.fileSystem.readFile(params.filePath);
    return {
      success: result.success,
      data: result.data || '',
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleWriteFile(params: DockerAIToolParameters['docker_write_file']): Promise<DockerAIToolResponse<'docker_write_file'>> {
    const result = await this.dockerToolkit.fileSystem.writeFile(params.filePath, params.content);
    return {
      success: result.success,
      data: result.success ? {
        message: result.message || '檔案寫入完成',
        containerOutput: result.containerOutput
      } : undefined,
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleSmartMonitorAndRecover(): Promise<DockerAIToolResponse<'docker_smart_monitor_and_recover'>> {
    const result = await this.dockerToolkit.smartMonitorAndRecover();
    return {
      success: result.success,
      data: result.data || [],
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleGetFullStatusReport(): Promise<DockerAIToolResponse<'docker_get_full_status_report'>> {
    const result = await this.dockerToolkit.getFullStatusReport();
    return {
      success: result.success,
      data: result.data || {
        containerHealth: null,
        devServerStatus: null,
        serviceHealth: null,
        recentLogs: []
      },
      error: result.error,
      message: result.message,
      containerOutput: result.containerOutput
    };
  }

  private async handleAskUser(params: DockerAIToolParameters['ask_user']): Promise<DockerAIToolResponse<'ask_user'>> {
    // 如果不啟用用戶確認，直接返回預設回應
    if (!this.config.enableUserConfirmation) {
      return {
        success: true,
        data: '自動確認',
        message: 'User confirmation disabled, auto-confirming'
      };
    }

    // 實際上需要實作與前端的互動機制
    // 這裡先返回簡單的回應
    return {
      success: true,
      data: params.prompt,
      message: 'User interaction placeholder'
    };
  }

  // ==================== 公共方法 ====================

  /**
   * 獲取 OpenAI Function Calling 格式的工具定義
   */
  getFunctionDefinitionsForOpenAI(): unknown[] {
    return getDockerFunctionDefinitionsForOpenAI();
  }

  /**
   * 獲取通用格式的工具定義
   */
  getFunctionDefinitionsGeneric() {
    return getDockerFunctionDefinitionsGeneric();
  }

  /**
   * 獲取Docker上下文資訊
   */
  getDockerContext(): DockerContext {
    return this.config.dockerContext;
  }

  /**
   * 更新Docker上下文
   */
  updateDockerContext(dockerContext: Partial<DockerContext>): void {
    this.config.dockerContext = { ...this.config.dockerContext, ...dockerContext };
    this.dockerToolkit = createDockerToolkit(this.config.dockerContext);
  }

  /**
   * 獲取工具統計資訊
   */
  getToolStatistics() {
    const functionDefs = this.getFunctionDefinitionsGeneric();
    return {
      total: functionDefs.length,
      mvpTools: [
        'docker_start_dev_server',
        'docker_restart_dev_server', 
        'docker_read_log_tail',
        'docker_check_health',
        'docker_smart_monitor_and_recover'
      ],
      categories: {
        devServer: ['docker_start_dev_server', 'docker_restart_dev_server', 'docker_kill_dev_server', 'docker_check_dev_server_status'],
        logMonitor: ['docker_read_log_tail', 'docker_search_error_logs', 'docker_get_log_files'],
        healthCheck: ['docker_check_health', 'docker_check_container_health'],
        fileSystem: ['docker_read_file', 'docker_write_file'],
        smart: ['docker_smart_monitor_and_recover', 'docker_get_full_status_report'],
        interaction: ['ask_user']
      }
    };
  }

  /**
   * 健康檢查：確保Docker容器可用
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const containerHealthResult = await this.dockerToolkit.healthCheck.checkContainerHealth();
      return {
        healthy: containerHealthResult.success,
        message: containerHealthResult.message || 'Docker容器狀態檢查完成'
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Docker容器健康檢查失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// 🏭 工廠函數
export function createDockerAIEditorManager(config: DockerAIEditorConfig): DockerAIEditorManager {
  return new DockerAIEditorManager(config);
}

// 🎯 預設Docker上下文配置
export function createDefaultDockerContext(containerId: string, containerName?: string): DockerContext {
  return {
    containerId,
    containerName: containerName || `ai-dev-${containerId.substring(0, 12)}`,
    workingDirectory: '/app',
    status: 'running'
  };
}

// 📊 Docker AI 編輯器管理器摘要
export const DOCKER_AI_EDITOR_SUMMARY = `
# 🐳 Docker AI 編輯器管理器

## ✨ 核心特色
- 🔧 統一管理所有Docker AI工具
- 🐳 完全在Docker容器內操作，不影響宿主機
- 🛡️ 內建安全機制與防護措施
- 📡 事件驅動的工具通訊
- 🎯 智能工具選擇與執行

## 🚀 快速開始

\`\`\`typescript
import { createDockerAIEditorManager, createDefaultDockerContext } from './docker-ai-editor-manager';

// 建立Docker上下文
const dockerContext = createDefaultDockerContext('your-container-id');

// 建立配置
const config = {
  dockerContext,
  enableUserConfirmation: true,
  enableActionLogging: true,
  enableAdvancedTools: true
};

// 創建管理器
const dockerAIEditor = createDockerAIEditorManager(config);

// 執行工具
const result = await dockerAIEditor.executeDockerAITool('docker_start_dev_server', {});
\`\`\`

## 🎯 MVP工具集 (5個核心工具)
1. docker_start_dev_server - 在容器內啟動開發伺服器
2. docker_restart_dev_server - 在容器內重啟開發伺服器
3. docker_read_log_tail - 讀取容器內日誌
4. docker_check_health - 容器健康檢查
5. docker_smart_monitor_and_recover - 智能監控修復

## 🔒 安全保證
- 所有操作通過 docker exec 在容器內執行
- 檔案操作限制在容器內 /app 目錄
- 日誌存儲在容器內 /app/logs 目錄
- 開發伺服器運行在容器內3000端口
- 完全不會影響宿主機專案
`; 