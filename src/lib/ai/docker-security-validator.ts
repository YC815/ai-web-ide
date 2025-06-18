/**
 * Docker 安全驗證器
 * 確保所有AI工具操作都嚴格限制在Docker容器內，防止意外操作宿主機檔案
 * 
 * @deprecated 此模組已棄用，請使用新的 securityValidator 工具
 * 位置：src/lib/functions/system/index.ts
 * 遷移指南：docs/unified-function-call-system.md
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
  private projectWorkspacePattern: RegExp;
  private strictMode: boolean = true;

  private constructor() {
    // 嚴格的專案工作區模式：只允許 /app/workspace/[project-name]/ 路徑
    this.projectWorkspacePattern = /^\/app\/workspace\/[a-zA-Z0-9_-]+(?:\/.*)?$/;
  }

  static getInstance(): DockerSecurityValidator {
    if (!DockerSecurityValidator.instance) {
      DockerSecurityValidator.instance = new DockerSecurityValidator();
    }
    return DockerSecurityValidator.instance;
  }

  /**
   * 驗證Docker上下文是否安全（針對專案工作區）
   */
  validateDockerContext(dockerContext: DockerContext, projectName?: string): SecurityValidationResult {
    // 在嚴格模式下，驗證工作目錄必須符合專案工作區模式
    if (this.strictMode) {
      const expectedPath = projectName ? `/app/workspace/${projectName}` : '/app/workspace';
      
      if (!this.isProjectWorkspacePath(dockerContext.workingDirectory, projectName)) {
        return {
          isValid: false,
          reason: `工作目錄必須在專案工作區內: ${dockerContext.workingDirectory}`,
          suggestedPath: expectedPath,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 驗證檔案路徑是否安全（嚴格限制在專案工作區內）
   */
  validateFilePath(filePath: string, dockerContext: DockerContext, projectName?: string): SecurityValidationResult {
    // 正規化路徑
    const normalizedPath = this.normalizePath(filePath, dockerContext.workingDirectory);
    
    // 在嚴格模式下，必須在專案工作區內
    const isInWorkspace = this.isProjectWorkspacePath(normalizedPath, projectName);
    
    if (this.strictMode && !isInWorkspace) {
      const suggestedPath = projectName 
        ? this.relocateToProjectWorkspace(filePath, projectName)
        : this.sanitizeFilePath(filePath);
        
      return {
        isValid: false,
        reason: `檔案路徑必須在專案工作區內: ${normalizedPath}`,
        suggestedPath,
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

    // 檢查是否嘗試訪問敏感檔案（即使在工作區內也不允許）
    const sensitivePatterns = [
      '/etc/',
      '/root/',
      '/home/',
      '/var/log/',
      '/proc/',
      '/sys/',
      '/.env',
      '/node_modules/',
    ];

    for (const pattern of sensitivePatterns) {
      if (normalizedPath.includes(pattern)) {
        return {
          isValid: false,
          reason: `嘗試訪問受限檔案: ${normalizedPath}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 驗證目錄路徑是否安全（嚴格限制在專案工作區內）
   */
  validateDirectoryPath(dirPath: string, dockerContext: DockerContext, projectName?: string): SecurityValidationResult {
    // 對於目錄路徑使用相同的檔案路徑驗證邏輯
    return this.validateFilePath(dirPath, dockerContext, projectName);
  }

  /**
   * 檢查是否為有效的專案工作區路徑
   */
  private isProjectWorkspacePath(path: string, projectName?: string): boolean {
    const normalizedPath = path.replace(/\/+/g, '/').replace(/\/$/, '');
    
    if (projectName) {
      // 如果指定了專案名稱，必須在 /app/workspace/[projectName]/ 內
      const projectPath = `/app/workspace/${projectName}`;
      return normalizedPath === projectPath || normalizedPath.startsWith(`${projectPath}/`);
    } else {
      // 如果沒有指定專案名稱，檢查是否在 /app/workspace/ 下的任何專案
      return normalizedPath.startsWith('/app/workspace/') && this.projectWorkspacePattern.test(normalizedPath);
    }
  }

  /**
   * 正規化路徑（相對路徑轉換為絕對路徑）
   */
  private normalizePath(filePath: string, workingDirectory: string): string {
    let normalizedPath: string;
    
    if (filePath.startsWith('/')) {
      // 絕對路徑，直接處理
      normalizedPath = filePath;
    } else {
      // 相對路徑處理
      if (filePath === '.' || filePath === './') {
        return workingDirectory.replace(/\/$/, '');
      }
      
      // 移除開頭的 ./
      const cleanPath = filePath.replace(/^\.\//, '');
      
      // 相對路徑，基於工作目錄解析
      const base = workingDirectory.replace(/\/$/, '');
      normalizedPath = `${base}/${cleanPath}`;
    }
    
    // 清理路徑：合併多個斜線，移除結尾的 /. 模式
    normalizedPath = normalizedPath
      .replace(/\/+/g, '/') // 合併多個斜線
      .replace(/\/\.$/, '') // 移除結尾的 /.
      .replace(/\/$/, ''); // 移除結尾的斜線
    
    return normalizedPath || '/';
  }

  /**
   * 將檔案路徑重新定位到專案工作區
   */
  private relocateToProjectWorkspace(filePath: string, projectName: string): string {
    const fileName = filePath.split('/').pop() || 'file';
    return `/app/workspace/${projectName}/${fileName}`;
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
   * 設定專案名稱（動態更新專案工作區）
   */
  setProjectName(projectName: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
      throw new Error(`不合法的專案名稱: ${projectName}`);
    }
    logger.info(`[SecurityValidator] 設定專案工作區: /app/workspace/${projectName}`);
  }

  /**
   * 啟用/禁用嚴格模式
   */
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
    logger.info(`[SecurityValidator] 嚴格模式: ${enabled ? '啟用' : '禁用'}`);
  }

  /**
   * 獲取安全報告
   */
  getSecurityReport(projectName?: string): {
    strictMode: boolean;
    projectWorkspacePattern: string;
    currentProjectPath?: string;
    securityLevel: 'HIGHEST' | 'HIGH' | 'MEDIUM';
  } {
    return {
      strictMode: this.strictMode,
      projectWorkspacePattern: this.projectWorkspacePattern.source,
      currentProjectPath: projectName ? `/app/workspace/${projectName}` : undefined,
      securityLevel: this.strictMode ? 'HIGHEST' : 'HIGH',
    };
  }

  /**
   * 驗證工具調用是否安全（針對專案工作區）
   */
  validateToolCall(
    toolName: string,
    parameters: any,
    dockerContext: DockerContext,
    projectName?: string
  ): SecurityValidationResult {
    // 首先驗證Docker上下文
    const contextValidation = this.validateDockerContext(dockerContext, projectName);
    if (!contextValidation.isValid) {
      return contextValidation;
    }

    // 根據工具類型進行特定驗證
    switch (toolName) {
      case 'readFile':
      case 'writeFile':
      case 'createFile':
      case 'deleteFile':
        if (parameters.filePath || parameters.path) {
          const filePath = parameters.filePath || parameters.path;
          return this.validateFilePath(filePath, dockerContext, projectName);
        }
        break;
        
      case 'listDirectory':
      case 'createDirectory':
      case 'removeDirectory':
        if (parameters.dirPath || parameters.path) {
          const dirPath = parameters.dirPath || parameters.path;
          return this.validateDirectoryPath(dirPath, dockerContext, projectName);
        }
        break;
        
      case 'executeCommand':
        // 限制危險的命令執行
        const command = parameters.command || '';
        if (this.isDangerousCommand(command)) {
          return {
            isValid: false,
            reason: `危險的命令被阻止: ${command}`,
          };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * 檢查是否為危險命令
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // 刪除根目錄
      /chmod\s+777/, // 危險的權限設定
      /sudo/, // 提權命令
      /curl.*\|.*sh/, // 管道執行下載腳本
      /wget.*\|.*sh/, // 管道執行下載腳本
      />\s*\/etc\//, // 寫入系統配置
      /cat\s+\/etc\/passwd/, // 讀取敏感檔案
      /netcat|nc.*-l/, // 網路監聽
      /python.*-c.*exec/, // 動態執行Python代碼
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
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

/**
 * 顯示遷移警告
 * @deprecated 請使用新的 securityValidator 工具替代
 */
export function showMigrationWarning(): void {
  console.warn(`
⚠️ DockerSecurityValidator 已棄用
請使用新的 securityValidator 工具替代
位置：src/lib/functions/system/index.ts
遷移指南：docs/unified-function-call-system.md
  `);
}

// 導出單例實例
export const dockerSecurityValidator = DockerSecurityValidator.getInstance(); 