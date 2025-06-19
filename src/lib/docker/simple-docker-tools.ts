/**
 * 簡化的 Docker 工具管理器
 * 專注於穩定性和易用性，避免過於複雜的安全檢查
 * 僅用於當前 Docker 容器內部的安全操作
 */

import { logger } from '../logger';
import { spawn } from 'child_process';

export interface SimpleDockerContext {
  containerId: string;
  workingDirectory: string;
}

export interface SimpleToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export class SimpleDockerTools {
  private dockerContext: SimpleDockerContext;

  constructor(dockerContext: SimpleDockerContext) {
    this.dockerContext = dockerContext;
  }

  /**
   * 列出目錄內容 - 簡化版本
   */
  async listDirectory(dirPath: string = '.'): Promise<SimpleToolResult> {
    try {
      // 簡單的路徑清理，避免複雜的安全檢查
      const safePath = this.cleanPath(dirPath);
      
      logger.info(`[SimpleDockerTools] 列出目錄: ${safePath}`);

      // 使用簡單的 ls 命令
      const result = await this.executeCommand(['ls', '-la', safePath]);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '列出目錄失敗'
        };
      }

      const files = (result.data || '').split('\n').filter(line => line.trim());
      
      return {
        success: true,
        data: files,
        message: `成功列出目錄 ${safePath} 的內容`
      };
    } catch (error) {
      logger.error(`[SimpleDockerTools] 列出目錄失敗: ${error}`);
      return {
        success: false,
        error: `列出目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 讀取檔案內容 - 簡化版本
   */
  async readFile(filePath: string): Promise<SimpleToolResult> {
    try {
      const safePath = this.cleanPath(filePath);
      
      logger.info(`[SimpleDockerTools] 讀取檔案: ${safePath}`);

      const result = await this.executeCommand(['cat', safePath]);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? `成功讀取檔案 ${safePath}` : `讀取檔案失敗: ${result.error}`
      };
    } catch (error) {
      return {
        success: false,
        error: `讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 尋找檔案 - 簡化版本
   */
  async findFiles(pattern: string, searchPath: string = '.'): Promise<SimpleToolResult> {
    try {
      const safePath = this.cleanPath(searchPath);
      
      logger.info(`[SimpleDockerTools] 尋找檔案: 模式=${pattern}, 路徑=${safePath}`);

      // 使用 find 命令尋找檔案
      const result = await this.executeCommand(['find', safePath, '-name', pattern]);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '尋找檔案失敗'
        };
      }

      const files = (result.data || '').split('\n').filter(line => line.trim());
      
      return {
        success: true,
        data: files,
        message: `找到 ${files.length} 個符合條件的檔案`
      };
    } catch (error) {
      return {
        success: false,
        error: `尋找檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 寫入檔案 - 簡化版本
   */
  async writeFile(filePath: string, content: string): Promise<SimpleToolResult> {
    try {
      const safePath = this.cleanPath(filePath);
      
      logger.info(`[SimpleDockerTools] 寫入檔案: ${safePath}`);

      // 使用 echo 命令寫入檔案
      const result = await this.executeCommand(['sh', '-c', `echo '${content.replace(/'/g, "\\'")}' > '${safePath}'`]);
      
      return {
        success: result.success,
        error: result.error,
        message: result.success ? `成功寫入檔案 ${safePath}` : `寫入檔案失敗: ${result.error}`
      };
    } catch (error) {
      return {
        success: false,
        error: `寫入檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 檢查專案結構
   */
  async checkProjectStructure(): Promise<SimpleToolResult> {
    try {
      logger.info(`[SimpleDockerTools] 檢查專案結構`);

      // 檢查常見的專案檔案
      const commonFiles = ['package.json', 'src', 'pages', 'app', 'index.js', 'index.tsx'];
      const foundStructure: string[] = [];

      for (const file of commonFiles) {
        const result = await this.executeCommand(['test', '-e', file]);
        if (result.success) {
          foundStructure.push(file);
        }
      }

      return {
        success: true,
        data: foundStructure,
        message: `發現專案結構: ${foundStructure.join(', ')}`
      };
    } catch (error) {
      return {
        success: false,
        error: `檢查專案結構失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 執行簡單命令（安全限制）
   */
  private async executeCommand(command: string[]): Promise<SimpleToolResult> {
    return new Promise((resolve) => {
      try {
        // 基本安全檢查 - 只阻止最危險的操作
        const commandStr = command.join(' ');
        if (commandStr.includes('rm -rf') || commandStr.includes('sudo') || commandStr.includes('/etc/')) {
          resolve({
            success: false,
            error: '不允許的命令操作'
          });
          return;
        }

        // 構建 Docker exec 命令
        const dockerCommand = [
          'docker', 'exec',
          '--workdir', this.dockerContext.workingDirectory,
          this.dockerContext.containerId,
          ...command
        ];

        logger.info(`[SimpleDockerTools] 執行命令: ${command.join(' ')}`);

        let stdout = '';
        let stderr = '';

        const process = spawn(dockerCommand[0], dockerCommand.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000, // 10秒超時
        });

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              data: stdout,
              message: '命令執行成功'
            });
          } else {
            resolve({
              success: false,
              error: stderr || `命令失敗，退出碼: ${code}`,
              data: stdout
            });
          }
        });

        process.on('error', (error) => {
          resolve({
            success: false,
            error: `命令執行錯誤: ${error.message}`
          });
        });

      } catch (error) {
        resolve({
          success: false,
          error: `執行命令失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
  }

  /**
   * 簡單的路徑清理
   */
  private cleanPath(path: string): string {
    if (!path || path === '.' || path === './') {
      return '.';
    }

    // 移除危險的路徑操作
    let cleanPath = path
      .replace(/\.\./g, '')  // 移除 ..
      .replace(/~/g, '')     // 移除 ~
      .replace(/\/+/g, '/'); // 合併多個斜線

    // 如果是空字符串，返回當前目錄
    if (!cleanPath) {
      return '.';
    }

    return cleanPath;
  }
}

/**
 * 建立簡化的 Docker 工具實例
 */
export function createSimpleDockerTools(containerId: string, workingDirectory: string = '/app/workspace/new_web'): SimpleDockerTools {
  return new SimpleDockerTools({
    containerId,
    workingDirectory
  });
} 