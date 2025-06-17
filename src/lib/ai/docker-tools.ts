/**
 * Docker 工具管理器
 * 提供 Docker 容器內的檔案操作功能
 */

import { logger } from '../logger';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { ToolResult } from './agent-controller';
import { dockerSecurityValidator } from './docker-security-validator';

export interface DockerToolsConfig {
  containerId?: string;
  workingDirectory?: string;
  enableLogging?: boolean;
}

export class DockerTools {
  private dockerManager: DockerAIEditorManager;
  private config: Required<DockerToolsConfig>;

  constructor(
    dockerManager: DockerAIEditorManager,
    config: DockerToolsConfig = {}
  ) {
    this.dockerManager = dockerManager;
    this.config = {
      containerId: config.containerId ?? 'ai-web-ide-web-test',
      workingDirectory: config.workingDirectory ?? '/app',
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * 讀取 Docker 容器內的檔案
   * @param filePath 檔案路徑
   * @returns 檔案內容或錯誤訊息
   */
  async readFileFromDocker(filePath: string): Promise<ToolResult> {
    try {
      this.log(`📖 讀取檔案: ${filePath}`);

      // 安全驗證
      const dockerContext = this.dockerManager.getDockerContext();
      const securityCheck = dockerSecurityValidator.validateToolCall(
        'docker_read_file',
        { filePath },
        dockerContext
      );

      if (!securityCheck.isValid) {
        dockerSecurityValidator.logSecurityViolation(
          'docker_read_file',
          { filePath },
          dockerContext,
          securityCheck.reason || '未知安全違規'
        );
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityCheck.reason}`,
        };
      }

      // 確保路徑是相對於工作目錄的
      const fullPath = filePath.startsWith('/') ? filePath : `${this.config.workingDirectory}/${filePath}`;

      // 使用 DockerAIEditorManager 的 executeDockerAITool 方法
      const result = await this.dockerManager.executeDockerAITool('docker_read_file', { filePath: fullPath });

      if (result.success && result.data) {
        this.log(`✅ 成功讀取檔案: ${filePath}`);
        return {
          success: true,
          data: {
            filePath: fullPath,
            content: result.data,
            size: result.data.length,
          },
          message: `成功讀取檔案 ${filePath}`,
        };
      } else {
        this.log(`❌ 讀取檔案失敗: ${filePath}, 錯誤: ${result.error}`);
        return {
          success: false,
          error: `讀取檔案失敗: ${result.error || '未知錯誤'}`,
        };
      }

    } catch (error) {
      this.log(`❌ 讀取檔案異常: ${filePath}, 錯誤: ${error}`);
      return {
        success: false,
        error: `讀取檔案異常: ${error}`,
      };
    }
  }

  /**
   * 列出 Docker 容器內的目錄內容
   * @param dirPath 目錄路徑
   * @returns 目錄內容或錯誤訊息
   */
  async listDirFromDocker(dirPath: string = '.'): Promise<ToolResult> {
    try {
      this.log(`📁 列出目錄: ${dirPath}`);

      // 安全驗證
      const dockerContext = this.dockerManager.getDockerContext();
      const securityCheck = dockerSecurityValidator.validateToolCall(
        'docker_list_directory',
        { dirPath },
        dockerContext
      );

      if (!securityCheck.isValid) {
        dockerSecurityValidator.logSecurityViolation(
          'docker_list_directory',
          { dirPath },
          dockerContext,
          securityCheck.reason || '未知安全違規'
        );
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityCheck.reason}`,
        };
      }

      // 使用 DockerAIEditorManager 的 executeDockerAITool 方法
      const result = await this.dockerManager.executeDockerAITool('docker_list_directory', { dirPath });

      if (result.success && result.data) {
        this.log(`✅ 成功列出目錄: ${dirPath}, 找到 ${result.data.length} 個項目`);
        return {
          success: true,
          data: {
            dirPath: dirPath,
            items: result.data,
            totalItems: result.data.length,
          },
          message: `成功列出目錄 ${dirPath}`,
        };
      } else {
        this.log(`❌ 列出目錄失敗: ${dirPath}, 錯誤: ${result.error}`);
        return {
          success: false,
          error: `列出目錄失敗: ${result.error || '未知錯誤'}`,
        };
      }

    } catch (error) {
      this.log(`❌ 列出目錄異常: ${dirPath}, 錯誤: ${error}`);
      return {
        success: false,
        error: `列出目錄異常: ${error}`,
      };
    }
  }

  /**
   * 檢查檔案或目錄是否存在
   * @param path 檔案或目錄路徑
   * @returns 是否存在
   */
  async checkPathExists(path: string): Promise<ToolResult> {
    try {
      this.log(`🔍 檢查路徑: ${path}`);

      // 由於沒有直接的路徑檢查工具，我們嘗試讀取目錄或檔案來判斷是否存在
      const listResult = await this.dockerManager.executeDockerAITool('docker_list_directory', { dirPath: path });
      
      if (listResult.success) {
        // 如果能成功列出，說明是目錄且存在
        this.log(`✅ 路徑檢查完成: ${path}, 存在（目錄）`);
        return {
          success: true,
          data: {
            path: path,
            exists: true,
            isDirectory: true,
          },
          message: `路徑 ${path} 存在（目錄）`,
        };
      } else {
        // 嘗試作為檔案讀取
        const fileResult = await this.dockerManager.executeDockerAITool('docker_read_file', { filePath: path });
        if (fileResult.success) {
          this.log(`✅ 路徑檢查完成: ${path}, 存在（檔案）`);
          return {
            success: true,
            data: {
              path: path,
              exists: true,
              isFile: true,
            },
            message: `路徑 ${path} 存在（檔案）`,
          };
        } else {
          this.log(`✅ 路徑檢查完成: ${path}, 不存在`);
          return {
            success: true,
            data: {
              path: path,
              exists: false,
            },
            message: `路徑 ${path} 不存在`,
          };
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `檢查路徑異常: ${error}`,
      };
    }
  }

  /**
   * 搜尋檔案
   * @param pattern 搜尋模式
   * @param searchPath 搜尋路徑
   * @returns 搜尋結果
   */
  async findFiles(pattern: string, searchPath: string = '.'): Promise<ToolResult> {
    try {
      this.log(`🔎 搜尋檔案: ${pattern} 在 ${searchPath}`);

      // 使用 docker_list_directory 遞迴搜尋
      const result = await this.dockerManager.executeDockerAITool('docker_list_directory', { 
        dirPath: searchPath, 
        recursive: true 
      });

      if (result.success && result.data) {
        // 過濾符合模式的檔案
        const matchingFiles = result.data.filter((item: string) => {
          const fileName = item.split('/').pop() || '';
          return fileName.includes(pattern) || fileName.match(new RegExp(pattern.replace('*', '.*')));
        });

        this.log(`✅ 搜尋完成: 找到 ${matchingFiles.length} 個檔案`);
        
        return {
          success: true,
          data: {
            pattern: pattern,
            searchPath: searchPath,
            files: matchingFiles,
            count: matchingFiles.length,
          },
          message: `找到 ${matchingFiles.length} 個符合 "${pattern}" 的檔案`,
        };
      } else {
        return {
          success: false,
          error: `搜尋檔案失敗: ${result.error}`,
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `搜尋檔案異常: ${error}`,
      };
    }
  }

  /**
   * 獲取檔案資訊
   * @param filePath 檔案路徑
   * @returns 檔案資訊
   */
  async getFileInfo(filePath: string): Promise<ToolResult> {
    try {
      this.log(`ℹ️ 獲取檔案資訊: ${filePath}`);

      // 嘗試讀取檔案來獲取基本資訊
      const result = await this.dockerManager.executeDockerAITool('docker_read_file', { filePath });

      if (result.success && result.data) {
        return {
          success: true,
          data: {
            filePath: filePath,
            size: result.data.length,
            exists: true,
            isFile: true,
          },
          message: `成功獲取檔案資訊: ${filePath}`,
        };
      } else {
        return {
          success: false,
          error: `檔案不存在或無法獲取資訊: ${filePath}`,
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `獲取檔案資訊異常: ${error}`,
      };
    }
  }

  /**
   * 解析 ls 命令的輸出行
   */
  private parseLsLine(line: string): any {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) return null;

    const permissions = parts[0];
    const size = parts[4];
    const name = parts.slice(8).join(' ');

    // 跳過 . 和 .. 目錄
    if (name === '.' || name === '..') return null;

    return {
      name: name,
      permissions: permissions,
      size: size,
      isDirectory: permissions.startsWith('d'),
      isFile: permissions.startsWith('-'),
    };
  }

  /**
   * 日誌記錄
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      logger.info(`[DockerTools] ${message}`);
    }
  }

  /**
   * 獲取所有可用的工具方法名稱
   */
  static getAvailableTools(): string[] {
    return [
      'docker_read_file',
      'docker_list_directory',
      'docker_check_path_exists',
      'docker_find_files',
      'docker_get_file_info',
    ];
  }

  /**
   * 獲取工具的 Schema 定義（用於 OpenAI Function Calling）
   */
  static getToolSchemas() {
    return [
      {
        type: 'function',
        function: {
          name: 'docker_read_file',
          description: '讀取 Docker 容器內的檔案內容',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '要讀取的檔案路徑（相對於 /app 目錄）',
              },
            },
            required: ['filePath'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'docker_list_directory',
          description: '列出 Docker 容器內目錄的內容',
          parameters: {
            type: 'object',
            properties: {
              dirPath: {
                type: 'string',
                description: '要列出的目錄路徑（相對於 /app 目錄，預設為 "."）',
                default: '.',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'docker_check_path_exists',
          description: '檢查 Docker 容器內的檔案或目錄是否存在',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '要檢查的檔案或目錄路徑',
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'docker_find_files',
          description: '在 Docker 容器內搜尋符合模式的檔案',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: '搜尋模式（支援萬用字元，如 "*.tsx", "index.*"）',
              },
              searchPath: {
                type: 'string',
                description: '搜尋路徑（預設為當前目錄 "."）',
                default: '.',
              },
            },
            required: ['pattern'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'docker_get_file_info',
          description: '獲取 Docker 容器內檔案的詳細資訊',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '要獲取資訊的檔案路徑',
              },
            },
            required: ['filePath'],
          },
        },
      },
    ];
  }
} 