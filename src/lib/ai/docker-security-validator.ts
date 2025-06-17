/**
 * Docker 安全驗證器
 * 確保所有AI工具操作都嚴格限制在Docker容器內，防止意外操作宿主機檔案
 */

import { logger } from '../logger';
import { DockerContext } from '../docker/tools';

export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  suggestedPath?: string;
}

export class DockerSecurityValidator {
  private static instance: DockerSecurityValidator;
  private allowedContainerIds: Set<string> = new Set();
  private allowedWorkingDirectories: Set<string> = new Set();

  private constructor() {
    // 預設允許的容器ID（從已知的容器配置中獲取）
    this.allowedContainerIds.add('41acd88ac05a');
    this.allowedContainerIds.add('4bf66b074def');
    this.allowedContainerIds.add('26a41a4ea7ec');
    this.allowedContainerIds.add('7df86921d2ab');
    this.allowedContainerIds.add('22f4b689ef71');

    // 預設允許的工作目錄
    this.allowedWorkingDirectories.add('/app/workspace/web_test');
    this.allowedWorkingDirectories.add('/app/workspace/docker_test');
    this.allowedWorkingDirectories.add('/app/workspace');
    this.allowedWorkingDirectories.add('/app');
  }

  static getInstance(): DockerSecurityValidator {
    if (!DockerSecurityValidator.instance) {
      DockerSecurityValidator.instance = new DockerSecurityValidator();
    }
    return DockerSecurityValidator.instance;
  }

  /**
   * 驗證Docker上下文是否安全
   */
  validateDockerContext(dockerContext: DockerContext): SecurityValidationResult {
    // 檢查容器ID是否在允許列表中
    if (!this.allowedContainerIds.has(dockerContext.containerId)) {
      return {
        isValid: false,
        reason: `未授權的容器ID: ${dockerContext.containerId}`,
      };
    }

    // 檢查工作目錄是否安全
    if (!this.isWorkingDirectorySafe(dockerContext.workingDirectory)) {
      return {
        isValid: false,
        reason: `不安全的工作目錄: ${dockerContext.workingDirectory}`,
        suggestedPath: '/app/workspace/web_test',
      };
    }

    return { isValid: true };
  }

  /**
   * 驗證檔案路徑是否安全
   */
  validateFilePath(filePath: string, dockerContext: DockerContext): SecurityValidationResult {
    // 檢查是否為絕對路徑且指向容器外
    if (filePath.startsWith('/') && !filePath.startsWith('/app')) {
      return {
        isValid: false,
        reason: `檔案路徑指向容器外: ${filePath}`,
        suggestedPath: this.sanitizeFilePath(filePath),
      };
    }

    // 檢查是否包含路徑遍歷攻擊
    if (filePath.includes('..') || filePath.includes('~/')) {
      return {
        isValid: false,
        reason: `檔案路徑包含危險字符: ${filePath}`,
        suggestedPath: this.sanitizeFilePath(filePath),
      };
    }

    // 檢查是否嘗試訪問敏感檔案
    const sensitiveFiles = [
      '/etc/passwd',
      '/etc/shadow',
      '/root/',
      '/home/',
      '/var/log/',
      '/proc/',
      '/sys/',
    ];

    for (const sensitive of sensitiveFiles) {
      if (filePath.startsWith(sensitive)) {
        return {
          isValid: false,
          reason: `嘗試訪問敏感檔案: ${filePath}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 驗證目錄路徑是否安全
   */
  validateDirectoryPath(dirPath: string, dockerContext: DockerContext): SecurityValidationResult {
    // 對於目錄路徑使用相同的檔案路徑驗證邏輯
    return this.validateFilePath(dirPath, dockerContext);
  }

  /**
   * 檢查工作目錄是否安全
   */
  private isWorkingDirectorySafe(workingDirectory: string): boolean {
    // 必須在 /app 目錄內
    if (!workingDirectory.startsWith('/app')) {
      return false;
    }

    // 不能包含路徑遍歷
    if (workingDirectory.includes('..')) {
      return false;
    }

    return true;
  }

  /**
   * 清理檔案路徑
   */
  private sanitizeFilePath(filePath: string): string {
    // 移除危險字符
    let sanitized = filePath
      .replace(/\.\./g, '')  // 移除 ..
      .replace(/~/g, '')     // 移除 ~
      .replace(/\/+/g, '/'); // 合併多個斜線

    // 確保相對路徑
    if (sanitized.startsWith('/') && !sanitized.startsWith('/app')) {
      sanitized = sanitized.substring(1);
    }

    return sanitized;
  }

  /**
   * 添加允許的容器ID
   */
  addAllowedContainer(containerId: string): void {
    this.allowedContainerIds.add(containerId);
    logger.info(`[SecurityValidator] 已添加允許的容器: ${containerId}`);
  }

  /**
   * 移除允許的容器ID
   */
  removeAllowedContainer(containerId: string): void {
    this.allowedContainerIds.delete(containerId);
    logger.info(`[SecurityValidator] 已移除允許的容器: ${containerId}`);
  }

  /**
   * 獲取安全報告
   */
  getSecurityReport(): {
    allowedContainers: string[];
    allowedWorkingDirectories: string[];
    securityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    return {
      allowedContainers: Array.from(this.allowedContainerIds),
      allowedWorkingDirectories: Array.from(this.allowedWorkingDirectories),
      securityLevel: this.allowedContainerIds.size <= 5 ? 'HIGH' : 'MEDIUM',
    };
  }

  /**
   * 驗證工具調用是否安全
   */
  validateToolCall(
    toolName: string,
    parameters: any,
    dockerContext: DockerContext
  ): SecurityValidationResult {
    // 首先驗證Docker上下文
    const contextValidation = this.validateDockerContext(dockerContext);
    if (!contextValidation.isValid) {
      return contextValidation;
    }

    // 根據工具類型進行特定驗證
    switch (toolName) {
      case 'docker_read_file':
      case 'docker_write_file':
        if (parameters.filePath) {
          return this.validateFilePath(parameters.filePath, dockerContext);
        }
        break;

      case 'docker_list_directory':
      case 'docker_list_files':
        if (parameters.dirPath || parameters.path) {
          const pathToCheck = parameters.dirPath || parameters.path || '.';
          return this.validateDirectoryPath(pathToCheck, dockerContext);
        }
        break;

      case 'docker_find_files':
        if (parameters.searchPath) {
          return this.validateDirectoryPath(parameters.searchPath, dockerContext);
        }
        break;

      default:
        // 對於其他Docker工具，只要Docker上下文有效就允許
        if (toolName.startsWith('docker_')) {
          return { isValid: true };
        } else {
          return {
            isValid: false,
            reason: `非Docker工具不被允許: ${toolName}`,
          };
        }
    }

    return { isValid: true };
  }

  /**
   * 記錄安全違規
   */
  logSecurityViolation(
    toolName: string,
    parameters: any,
    dockerContext: DockerContext,
    reason: string
  ): void {
    logger.error(`[SecurityValidator] 🚨 安全違規檢測`, {
      toolName,
      parameters,
      dockerContext,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}

// 導出單例實例
export const dockerSecurityValidator = DockerSecurityValidator.getInstance(); 