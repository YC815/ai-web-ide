// Docker AI 編輯器管理器 - 統一管理所有 Docker AI 工具和功能
// 這個模組是 Docker AI 編輯器的核心控制器，負責協調 Docker 工具和容器操作

import { createDockerToolkit, DockerToolkit, DockerContext } from './tools';
import { 
  DockerAIToolName, 
  DockerAIToolParameters, 
  DockerAIToolResponse,
  getDockerFunctionDefinitionsForOpenAI,
  getDockerFunctionDefinitionsGeneric
} from './function-schemas';
import { ToolLogger } from '../core/logger';

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
  private logger: ToolLogger;

  constructor(config: DockerAIEditorConfig) {
    this.config = config;
    this.dockerToolkit = createDockerToolkit(config.dockerContext);
    this.logger = new ToolLogger('DockerAIEditor');
    
    // 記錄初始化資訊
    this.logger.info('Docker AI Editor Manager initialized', {
      containerId: config.dockerContext.containerId,
      containerName: config.dockerContext.containerName,
      workingDirectory: config.dockerContext.workingDirectory,
      enableUserConfirmation: config.enableUserConfirmation,
      enableActionLogging: config.enableActionLogging
    });
  }

  /**
   * 記錄操作行為
   * @param action 操作描述
   * @param metadata 操作的相關資料
   */
  private logAction(action: string, metadata: Record<string, unknown> = {}): void {
    if (this.config.enableActionLogging) {
      this.logger.info(action, metadata);
    }
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
    const startTime = Date.now();
    
    try {
      // 記錄工具調用
      this.logger.logToolCall(parameters, startTime);
      
      // 檢查 Docker 上下文是否有效，如果無效則使用模擬模式
      if (!this.isDockerContextValid()) {
        this.logger.warn('Docker context invalid, using simulation mode', this.config.dockerContext);
        return this.executeInSimulationMode(toolName, parameters);
      }

      // 根據工具類型執行相應邏輯
      switch (toolName) {
        case 'docker_start_dev_server':
          this.logAction(`執行工具: ${toolName}`, {});
          const startResult = await this.dockerToolkit.devServer.startDevServer();
          return {
            success: startResult.success,
            data: startResult.data,
            message: startResult.message,
            error: startResult.error
          };
        
        case 'docker_restart_dev_server':
          this.logAction(`執行工具: ${toolName}`, { reason: parameters.reason });
          const restartResult = await this.dockerToolkit.devServer.restartDevServer(parameters.reason);
          return {
            success: restartResult.success,
            data: restartResult.data,
            message: restartResult.message,
            error: restartResult.error
          };
        
        case 'docker_kill_dev_server':
          this.logAction(`執行工具: ${toolName}`, {});
          const killResult = await this.dockerToolkit.devServer.killDevServer();
          return {
            success: killResult.success,
            data: killResult.containerOutput,
            message: killResult.message,
            error: killResult.error
          };
        
        case 'docker_check_dev_server_status':
          this.logAction(`執行工具: ${toolName}`, {});
          const statusResult = await this.dockerToolkit.devServer.checkDevServerStatus();
          return {
            success: statusResult.success,
            data: statusResult.data,
            message: statusResult.message,
            error: statusResult.error
          };
        
        case 'docker_read_log_tail':
          return await this.handleReadLogTail(parameters as DockerAIToolParameters['docker_read_log_tail']) as DockerAIToolResponse<T>;
        
        case 'docker_search_error_logs':
          return await this.handleSearchErrorLogs(parameters as DockerAIToolParameters['docker_search_error_logs']) as DockerAIToolResponse<T>;
        
        case 'docker_get_log_files':
          return await this.handleGetLogFiles() as DockerAIToolResponse<T>;
        
        case 'docker_check_health':
          return await this.handleCheckHealth() as DockerAIToolResponse<T>;
        
        case 'docker_check_container_health':
          return await this.handleCheckContainerHealth() as DockerAIToolResponse<T>;
        
        case 'docker_read_file':
          return await this.handleReadFile(parameters as DockerAIToolParameters['docker_read_file']) as DockerAIToolResponse<T>;
        
        case 'docker_write_file':
          this.logAction(`執行工具: ${toolName}`, { filePath: parameters.filePath });
          const writeResult = await this.dockerToolkit.fileSystem.writeFile(
            parameters.filePath,
            parameters.content
          );
          return {
            success: writeResult.success,
            data: writeResult.data,
            message: writeResult.message,
            error: writeResult.error
          };
        
        case 'docker_list_directory':
          this.logAction(`執行工具: ${toolName}`, { dirPath: parameters.dirPath });
          const listResult = await this.dockerToolkit.fileSystem.listDirectory(
            parameters.dirPath,
            {
              recursive: parameters.recursive,
              showHidden: parameters.showHidden,
              useTree: parameters.useTree
            }
          );
          return {
            success: listResult.success,
            data: listResult.data,
            message: listResult.message,
            error: listResult.error
          };
        
        case 'docker_show_directory_tree':
          this.logAction(`執行工具: ${toolName}`, { dirPath: parameters.dirPath });
          const treeResult = await this.dockerToolkit.fileSystem.showDirectoryTree(
            parameters.dirPath,
            parameters.maxDepth
          );
          return {
            success: treeResult.success,
            data: treeResult.data,
            message: treeResult.message,
            error: treeResult.error
          };
        
        case 'docker_smart_monitor_and_recover':
          return await this.handleSmartMonitorAndRecover() as DockerAIToolResponse<T>;
        
        case 'docker_get_full_status_report':
          return await this.handleGetFullStatusReport() as DockerAIToolResponse<T>;
        
        case 'ask_user':
          return await this.handleAskUser(parameters as DockerAIToolParameters['ask_user']) as DockerAIToolResponse<T>;
        
        default:
          const unknownError = new Error(`未知的Docker工具: ${toolName}`);
          this.logger.error('Unknown Docker tool', unknownError, { toolName, parameters });
          return {
            success: false,
            error: `未知的Docker工具: ${toolName}`
          } as DockerAIToolResponse<T>;
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const toolError = error instanceof Error ? error : new Error('Unknown error');
      
      this.logger.logToolError(toolError, executionTime);

      return {
        success: false,
        error: `Docker工具執行失敗: ${toolError.message}`,
        message: `工具 ${toolName} 執行時發生錯誤，請檢查日誌獲取詳細資訊。`
      } as DockerAIToolResponse<T>;
    }
  }

  // ==================== Docker 工具處理方法 ====================

  private async handleStartDevServer(): Promise<DockerAIToolResponse<'docker_start_dev_server'>> {
    if (!this.isDockerContextValid()) {
      return this.createMockResponse('docker_start_dev_server', '無法啟動開發伺服器');
    }

    try {
      const result = await this.dockerToolkit.devServer.startDevServer();
      this.logger.logToolResult(result, Date.now());
      
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
    } catch (error) {
      this.logger.error('Failed to start dev server', error instanceof Error ? error : new Error('Unknown error'));
      return this.createMockResponse('docker_start_dev_server', '啟動開發伺服器時發生錯誤');
    }
  }

  private async handleRestartDevServer(params: DockerAIToolParameters['docker_restart_dev_server']): Promise<DockerAIToolResponse<'docker_restart_dev_server'>> {
    const result = await this.dockerToolkit.devServer.restartDevServer(params.reason);
    return {
      success: result.success,
      data: result.data ? {
        message: result.message || '開發伺服器重啟完成',
        containerOutput: result.containerOutput,
        restartCount: (result.data as {restartCount?: number})?.restartCount
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

  private async handleCheckHealth(): Promise<DockerAIToolResponse<'docker_check_health'>> {
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
    if (!this.isDockerContextValid()) {
      this.logger.warn('Docker context invalid, using simulation mode for container health check', { 
        dockerContext: this.config.dockerContext 
      });
      return this.createMockResponse('docker_check_container_health', '模擬模式：Docker 上下文無效，無法檢查容器健康狀態');
    }

    try {
      this.logger.debug('Attempting to check container health via Docker toolkit');
      
      const result = await this.dockerToolkit.healthCheck.checkContainerHealth();
      
      // 詳細記錄工具結果
      this.logger.debug('Docker container health check result', { 
        success: result.success,
        message: result.message,
        containerOutput: result.containerOutput,
        error: result.error
      });
      
      // 容器健康檢查失敗是正常情況，應該將信息返回給 AI 而不是拋出錯誤
      if (!result.success) {
        // 只記錄為 debug 級別，不是錯誤級別
        this.logger.debug('Docker container health check failed - this is normal for unhealthy containers', { 
          error: result.error,
          dockerContext: this.config.dockerContext
        });
      }
      
      return {
        success: result.success,
        data: result.success ? {
          message: result.message || '容器健康檢查完成',
          containerOutput: result.containerOutput
        } : undefined,
        error: result.error,
        message: result.message || (result.success ? '容器健康檢查完成' : '容器健康檢查失敗'),
        containerOutput: result.containerOutput
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to check container health - exception thrown', error instanceof Error ? error : new Error(errorMessage), { 
        dockerContext: this.config.dockerContext
      });
      
      return {
        success: false,
        data: undefined,
        error: `容器健康檢查時發生例外: ${errorMessage}`,
        message: '容器健康檢查發生錯誤',
        containerOutput: undefined
      };
    }
  }

  private async handleReadFile(params: DockerAIToolParameters['docker_read_file']): Promise<DockerAIToolResponse<'docker_read_file'>> {
    if (!this.isDockerContextValid()) {
      this.logger.warn('Docker context invalid, using simulation mode for read file', { 
        filePath: params.filePath,
        dockerContext: this.config.dockerContext 
      });
      return this.createMockResponse('docker_read_file', `模擬模式：無法讀取檔案 ${params.filePath}，Docker 上下文無效`);
    }

    try {
      this.logger.debug('Attempting to read file via Docker toolkit', { filePath: params.filePath });
      
      const result = await this.dockerToolkit.fileSystem.readFile(params.filePath);
      
      // 詳細記錄工具結果
      this.logger.debug('Docker file read result', { 
        success: result.success,
        hasData: !!result.data,
        error: result.error,
        message: result.message,
        containerOutput: result.containerOutput
      });
      
      this.logger.logToolResult(result, Date.now());
      
      // 檔案不存在或讀取失敗是正常情況，應該將信息返回給 AI 而不是拋出錯誤
      if (!result.success) {
        // 只記錄為 debug 級別，不是錯誤級別
        this.logger.debug('Docker file read failed - this is normal for non-existent files', { 
          filePath: params.filePath,
          error: result.error,
          dockerContext: this.config.dockerContext
        });
      }
      
      return {
        success: result.success,
        data: result.data || '',
        error: result.error,
        message: result.message || (result.success ? `成功讀取檔案: ${params.filePath}` : `檔案不存在或讀取失敗: ${params.filePath}`),
        containerOutput: result.containerOutput
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to read file - exception thrown', error instanceof Error ? error : new Error(errorMessage), { 
        filePath: params.filePath,
        dockerContext: this.config.dockerContext
      });
      
      return {
        success: false,
        data: '',
        error: `讀取檔案時發生例外: ${errorMessage}`,
        message: `讀取檔案 ${params.filePath} 時發生錯誤`,
        containerOutput: undefined
      };
    }
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
      data: result.data ? {
        containerHealth: result.data.containerHealth,
        devServerStatus: result.data.devServerStatus.data || { isRunning: false },
        serviceHealth: result.data.serviceHealth.data || { status: 'down' as const, responseTimeMs: 0, containerHealth: 'unhealthy' as const },
        recentLogs: result.data.recentLogs
      } : {
        containerHealth: null,
        devServerStatus: { isRunning: false },
        serviceHealth: { status: 'down' as const, responseTimeMs: 0, containerHealth: 'unhealthy' as const },
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

  // ==================== 私有輔助方法 ====================

  /**
   * 檢查 Docker 上下文是否有效
   */
  private isDockerContextValid(): boolean {
    const { containerId, containerName } = this.config.dockerContext;
    
    // 使用新的驗證函數
    try {
      const { validateDockerContext, getDockerContextById } = require('./docker-context-config');
      
      // 首先檢查基本格式
      if (!validateDockerContext(this.config.dockerContext)) {
        this.logger.warn('Docker context failed basic validation', { 
          containerId, 
          containerName,
          workingDirectory: this.config.dockerContext.workingDirectory
        });
        return false;
      }
      
      // 檢查是否在已知的容器列表中
      const knownContext = getDockerContextById(containerId);
      if (knownContext) {
        this.logger.debug('Docker context found in known containers', { 
          containerId, 
          containerName,
          knownWorkingDirectory: knownContext.workingDirectory
        });
        
        // 如果工作目錄不匹配，更新配置
        if (this.config.dockerContext.workingDirectory !== knownContext.workingDirectory) {
          this.logger.info('Updating Docker context working directory', {
            oldWorkingDirectory: this.config.dockerContext.workingDirectory,
            newWorkingDirectory: knownContext.workingDirectory
          });
          this.config.dockerContext.workingDirectory = knownContext.workingDirectory;
        }
        
        return true;
      }
      
      this.logger.warn('Docker context not found in known containers', { containerId, containerName });
      return false;
      
    } catch (error) {
      this.logger.error('Error validating Docker context', error instanceof Error ? error : new Error('Unknown error'), { 
        containerId, 
        containerName 
      });
      
      // 回退到原始驗證邏輯
      // 檢查是否為虛擬容器 ID（用於開發/測試）
      if (containerId.includes('-container') || containerId.startsWith('test-') || containerId.startsWith('dev-')) {
        this.logger.warn('Using virtual Docker container ID', { containerId, containerName });
        return false;
      }
      
      // 基本格式檢查
      if (!containerId || containerId.length < 12) {
        this.logger.warn('Invalid Docker container ID format', { containerId });
        return false;
      }
      
      return true;
    }
  }

  /**
   * 在模擬模式下執行工具
   */
  private executeInSimulationMode<T extends DockerAIToolName>(
    toolName: T, 
    parameters: DockerAIToolParameters[T]
  ): DockerAIToolResponse<T> {
    this.logger.info('Executing tool in simulation mode', { toolName, parameters });
    
    // 模擬執行時間
    const simulatedDelay = Math.random() * 100 + 50; // 50-150ms
    
    switch (toolName) {
      case 'docker_start_dev_server':
        return {
          success: true,
          message: '開發伺服器已在模擬模式下啟動',
          data: {
            message: '模擬模式：開發伺服器啟動成功',
            containerOutput: 'Simulated: npm run dev started successfully'
          },
          containerOutput: 'Simulated: Development server started on port 3000'
        } as DockerAIToolResponse<T>;

      case 'docker_restart_dev_server':
        return {
          success: true,
          message: '開發伺服器已在模擬模式下重啟',
          data: {
            message: '模擬模式：開發伺服器重啟成功',
            containerOutput: 'Simulated: npm run dev restarted',
            restartCount: 1
          },
          containerOutput: 'Simulated: Development server restarted'
        } as DockerAIToolResponse<T>;

      case 'docker_check_dev_server_status':
        return {
          success: true,
          message: '模擬模式：開發伺服器狀態檢查完成',
          data: {
            isRunning: true,
            pid: '12345',
            port: '3000'
          },
          containerOutput: 'Simulated: Server is running on port 3000'
        } as DockerAIToolResponse<T>;

      case 'docker_read_file':
        const fileParams = parameters as DockerAIToolParameters['docker_read_file'];
        return {
          success: true,
          message: `模擬模式：已讀取檔案 ${fileParams.filePath}`,
          data: this.getSimulatedFileContent(fileParams.filePath),
          containerOutput: `Simulated: File ${fileParams.filePath} read successfully`
        } as DockerAIToolResponse<T>;

      case 'docker_write_file':
        const writeParams = parameters as DockerAIToolParameters['docker_write_file'];
        return {
          success: true,
          message: `模擬模式：已寫入檔案 ${writeParams.filePath}`,
          data: {
            message: '檔案寫入成功',
            containerOutput: `Simulated: File ${writeParams.filePath} written successfully`
          },
          containerOutput: `Simulated: File written to ${writeParams.filePath}`
        } as DockerAIToolResponse<T>;

      case 'docker_check_health':
        return {
          success: true,
          message: '模擬模式：健康檢查完成',
          data: {
            status: 'up' as const,
            responseTimeMs: Math.floor(simulatedDelay),
            containerHealth: 'healthy' as const
          },
          containerOutput: 'Simulated: Health check passed'
        } as DockerAIToolResponse<T>;

      case 'docker_check_container_health':
        return {
          success: true,
          message: '模擬模式：容器健康檢查完成',
          data: {
            message: '容器運行正常',
            containerOutput: 'Simulated: Container is healthy'
          },
          containerOutput: 'Simulated: Container health check passed'
        } as DockerAIToolResponse<T>;

      case 'docker_read_log_tail':
        const logParams = parameters as DockerAIToolParameters['docker_read_log_tail'];
        return {
          success: true,
          message: '模擬模式：日誌讀取完成',
          data: this.getSimulatedLogContent(logParams.lines || 100),
          containerOutput: 'Simulated: Log tail read successfully'
        } as DockerAIToolResponse<T>;

      case 'docker_search_error_logs':
        return {
          success: true,
          message: '模擬模式：錯誤日誌搜尋完成',
          data: [
            '模擬錯誤日誌：[2025-06-16 10:00:00] INFO: Application started',
            '模擬錯誤日誌：[2025-06-16 10:01:00] WARN: Deprecated API usage detected',
            '模擬錯誤日誌：[2025-06-16 10:02:00] INFO: Request processed successfully'
          ],
          containerOutput: 'Simulated: Error logs searched'
        } as DockerAIToolResponse<T>;

      case 'docker_get_log_files':
        return {
          success: true,
          message: '模擬模式：日誌檔案列表獲取完成',
          data: [
            '/app/logs/app.log',
            '/app/logs/error.log',
            '/app/logs/access.log'
          ],
          containerOutput: 'Simulated: Log files listed'
        } as DockerAIToolResponse<T>;

      case 'docker_smart_monitor_and_recover':
        return {
          success: true,
          message: '模擬模式：智能監控與修復完成',
          data: [
            '✅ 系統狀態檢查：正常',
            '✅ 服務健康檢查：通過',
            '✅ 資源使用率：正常',
            '📊 模擬模式運行中，所有檢查均通過'
          ],
          containerOutput: 'Simulated: Smart monitoring completed'
        } as DockerAIToolResponse<T>;

      case 'docker_get_full_status_report':
        return {
          success: true,
          message: '模擬模式：完整狀態報告生成完成',
          data: {
            containerHealth: { success: true, message: '容器健康' },
            devServerStatus: { isRunning: true, pid: '12345', port: '3000' },
            serviceHealth: { status: 'up' as const, responseTimeMs: Math.floor(simulatedDelay), containerHealth: 'healthy' as const },
            recentLogs: [
              '[模擬] 2025-06-16 10:00:00 - 應用程式啟動',
              '[模擬] 2025-06-16 10:01:00 - 服務運行正常',
              '[模擬] 2025-06-16 10:02:00 - 請求處理完成'
            ]
          },
          containerOutput: 'Simulated: Full status report generated'
        } as DockerAIToolResponse<T>;

      case 'ask_user':
        const askParams = parameters as DockerAIToolParameters['ask_user'];
        return {
          success: true,
          message: '模擬模式：用戶確認請求已處理',
          data: `模擬回應：${askParams.prompt}`,
          containerOutput: 'Simulated: User confirmation processed'
        } as DockerAIToolResponse<T>;

      default:
        return {
          success: true,
          message: `模擬模式：工具 ${toolName} 執行完成`,
          data: null,
          containerOutput: `Simulated: Tool ${toolName} executed`
        } as DockerAIToolResponse<T>;
    }
  }

  /**
   * 創建模擬回應（當 Docker 不可用時）
   */
  private createMockResponse<T extends DockerAIToolName>(toolName: T, message: string): DockerAIToolResponse<T> {
    this.logger.info('Creating mock response for Docker tool', { toolName, message });
    
    return {
      success: false,
      error: 'Docker 容器不可用',
      message: `${message}（模擬模式）`,
      data: this.getMockData(toolName)
    } as DockerAIToolResponse<T>;
  }

  /**
   * 獲取模擬數據
   */
  private getMockData<T extends DockerAIToolName>(toolName: T): any {
    switch (toolName) {
      case 'docker_check_dev_server_status':
        return { isRunning: false, pid: undefined, port: undefined };
      case 'docker_check_health':
        return { status: 'down', responseTimeMs: 0, containerHealth: 'unhealthy' };
      case 'docker_read_file':
        return '';
      case 'docker_read_log_tail':
        return ['Docker 容器不可用，無法讀取日誌'];
      case 'docker_get_log_files':
        return [];
      default:
        return null;
    }
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
   * 處理用戶確認
   */
  async handleUserConfirmation(actionId: string, confirmed: boolean, data?: Record<string, unknown>): Promise<void> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      throw new Error(`找不到待處理的操作: ${actionId}`);
    }

    // 更新操作狀態
    action.status = confirmed ? 'confirmed' : 'rejected';
    
    // 執行回調函數（如果存在）
    const callback = this.userConfirmationCallbacks.get(actionId);
    if (callback) {
      callback(confirmed, data);
      this.userConfirmationCallbacks.delete(actionId);
    }

    // 如果確認，可以在這裡執行相應的操作
    if (confirmed) {
      // 這裡可以根據需要執行確認後的操作
      console.log(`✅ 用戶確認操作: ${action.toolName} (${actionId})`);
    } else {
      console.log(`❌ 用戶取消操作: ${action.toolName} (${actionId})`);
    }
  }

  /**
   * 獲取待處理的操作
   */
  getPendingActions(): PendingAction[] {
    return Array.from(this.pendingActions.values());
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