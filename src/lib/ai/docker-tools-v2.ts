/**
 * Docker 工具 V2 - 嚴格版本
 * 所有操作嚴格限制在 Docker 容器內的 /app/workspace/[project-name] 目錄
 * 絕對不允許訪問宿主機檔案系統
 */

import { logger } from '../logger';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { ToolResult } from './agent-controller';

export interface StrictDockerToolsConfig {
  containerId: string;
  projectName: string;
  enableLogging?: boolean;
}

export class StrictDockerTools {
  private dockerManager: DockerAIEditorManager;
  private config: Required<StrictDockerToolsConfig>;
  private readonly STRICT_WORKING_DIR: string;

  constructor(
    dockerManager: DockerAIEditorManager,
    config: StrictDockerToolsConfig
  ) {
    this.dockerManager = dockerManager;
    this.config = {
      containerId: config.containerId,
      projectName: config.projectName,
      enableLogging: config.enableLogging ?? true,
    };
    
    // 嚴格設定工作目錄：/app/workspace/[project-name]
    this.STRICT_WORKING_DIR = `/app/workspace/${this.config.projectName}`;
    
    this.log(`🔒 StrictDockerTools 初始化 - 工作目錄鎖定在: ${this.STRICT_WORKING_DIR}`);
  }

  /**
   * 嚴格驗證並執行檔案讀取
   * 只能讀取 /app/workspace/[project-name] 內的檔案
   */
  async readFile(filePath: string): Promise<ToolResult> {
    try {
      this.log(`📖 [STRICT] 讀取檔案: ${filePath}`);

      // 步驟1: 安全驗證
      const securityResult = this.validatePath(filePath);
      if (!securityResult.isValid) {
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityResult.reason}`,
        };
      }

      // 步驟2: 構建絕對路徑（強制在專案目錄內）
      const absolutePath = this.buildAbsolutePath(filePath);
      
      // 步驟3: 轉換為相對路徑給底層工具（因為工作目錄已設定）
      const relativePath = this.convertToRelativePath(absolutePath);
      
      // 步驟4: 執行讀取
      const result = await this.dockerManager.executeDockerAITool('docker_read_file', { 
        filePath: relativePath 
      });

      if (result.success) {
        this.log(`✅ [STRICT] 成功讀取: ${absolutePath}`);
        return {
          success: true,
          data: {
            filePath: filePath, // 返回相對路徑
            absolutePath: absolutePath,
            content: result.data,
            size: result.data?.length || 0,
            projectName: this.config.projectName,
          },
          message: `成功讀取檔案: ${filePath}`,
        };
      } else {
        this.log(`❌ [STRICT] 讀取失敗: ${absolutePath} - ${result.error}`);
        return {
          success: false,
          error: `讀取檔案失敗: ${result.error}`,
        };
      }

    } catch (error) {
      this.log(`❌ [STRICT] 讀取異常: ${filePath} - ${error}`);
      return {
        success: false,
        error: `讀取檔案異常: ${error}`,
      };
    }
  }

  /**
   * 嚴格驗證並執行目錄列表
   * 只能列出 /app/workspace/[project-name] 內的目錄
   */
  async listDirectory(dirPath: string = '.'): Promise<ToolResult> {
    try {
      this.log(`📁 [STRICT] 列出目錄: ${dirPath}`);

      // 步驟1: 安全驗證
      const securityResult = this.validatePath(dirPath);
      if (!securityResult.isValid) {
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityResult.reason}`,
        };
      }

      // 步驟2: 構建絕對路徑
      const absolutePath = this.buildAbsolutePath(dirPath);
      
      // 步驟3: 轉換為相對路徑給底層工具
      const relativePath = this.convertToRelativePath(absolutePath);
      
      // 步驟4: 執行列表
      const result = await this.dockerManager.executeDockerAITool('docker_list_directory', { 
        dirPath: relativePath 
      });

      if (result.success) {
        this.log(`✅ [STRICT] 成功列出: ${absolutePath} - ${result.data?.length || 0} 項目`);
        return {
          success: true,
          data: {
            dirPath: dirPath, // 返回相對路徑
            absolutePath: absolutePath,
            items: result.data || [],
            totalItems: result.data?.length || 0,
            projectName: this.config.projectName,
          },
          message: `成功列出目錄: ${dirPath}`,
        };
      } else {
        this.log(`❌ [STRICT] 列出失敗: ${absolutePath} - ${result.error}`);
        return {
          success: false,
          error: `列出目錄失敗: ${result.error}`,
        };
      }

    } catch (error) {
      this.log(`❌ [STRICT] 列出異常: ${dirPath} - ${error}`);
      return {
        success: false,
        error: `列出目錄異常: ${error}`,
      };
    }
  }

  /**
   * 嚴格驗證並執行檔案寫入
   * 只能寫入 /app/workspace/[project-name] 內的檔案
   */
  async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      this.log(`✏️ [STRICT] 寫入檔案: ${filePath}`);

      // 步驟1: 安全驗證
      const securityResult = this.validatePath(filePath);
      if (!securityResult.isValid) {
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityResult.reason}`,
        };
      }

      // 步驟2: 構建絕對路徑
      const absolutePath = this.buildAbsolutePath(filePath);
      
      // 步驟3: 轉換為相對路徑給底層工具
      const relativePath = this.convertToRelativePath(absolutePath);
      
      // 步驟4: 執行寫入
      const result = await this.dockerManager.executeDockerAITool('docker_write_file', { 
        filePath: relativePath,
        content: content
      });

      if (result.success) {
        this.log(`✅ [STRICT] 成功寫入: ${absolutePath}`);
        return {
          success: true,
          data: {
            filePath: filePath,
            absolutePath: absolutePath,
            size: content.length,
            projectName: this.config.projectName,
          },
          message: `成功寫入檔案: ${filePath}`,
        };
      } else {
        this.log(`❌ [STRICT] 寫入失敗: ${absolutePath} - ${result.error}`);
        return {
          success: false,
          error: `寫入檔案失敗: ${result.error}`,
        };
      }

    } catch (error) {
      this.log(`❌ [STRICT] 寫入異常: ${filePath} - ${error}`);
      return {
        success: false,
        error: `寫入檔案異常: ${error}`,
      };
    }
  }

  /**
   * 搜尋檔案（嚴格限制在專案目錄內）
   */
  async findFiles(pattern: string, searchPath: string = '.'): Promise<ToolResult> {
    try {
      this.log(`🔍 [STRICT] 搜尋檔案: ${pattern} 在 ${searchPath}`);

      // 步驟1: 安全驗證
      const securityResult = this.validatePath(searchPath);
      if (!securityResult.isValid) {
        return {
          success: false,
          error: `🚨 安全檢查失敗: ${securityResult.reason}`,
        };
      }

      // 步驟2: 先列出目錄內容
      const listResult = await this.listDirectory(searchPath);
      if (!listResult.success) {
        return listResult;
      }

      // 步驟3: 過濾符合模式的檔案
      const items = listResult.data?.items || [];
      const matchingFiles = items.filter((item: string) => {
        const fileName = item.split('/').pop() || '';
        return fileName.includes(pattern) || fileName.match(new RegExp(pattern.replace('*', '.*')));
      });

      this.log(`✅ [STRICT] 搜尋完成: 找到 ${matchingFiles.length} 個檔案`);
      
      return {
        success: true,
        data: {
          pattern: pattern,
          searchPath: searchPath,
          matchingFiles: matchingFiles,
          totalFound: matchingFiles.length,
          projectName: this.config.projectName,
        },
        message: `找到 ${matchingFiles.length} 個符合 "${pattern}" 的檔案`,
      };

    } catch (error) {
      this.log(`❌ [STRICT] 搜尋異常: ${pattern} - ${error}`);
      return {
        success: false,
        error: `搜尋檔案異常: ${error}`,
      };
    }
  }

  /**
   * 獲取專案資訊
   */
  async getProjectInfo(): Promise<ToolResult> {
    try {
      this.log(`📊 [STRICT] 獲取專案資訊`);

      // 讀取 package.json
      const packageResult = await this.readFile('package.json');
      let packageInfo = null;
      
      if (packageResult.success) {
        try {
          packageInfo = JSON.parse(packageResult.data?.content || '{}');
        } catch {
          this.log(`⚠️ 無法解析 package.json`);
        }
      }

      // 列出根目錄
      const rootResult = await this.listDirectory('.');
      
      return {
        success: true,
        data: {
          projectName: this.config.projectName,
          workingDirectory: this.STRICT_WORKING_DIR,
          containerId: this.config.containerId,
          packageInfo: packageInfo,
          rootFiles: rootResult.success ? rootResult.data?.items : [],
          hasPackageJson: packageResult.success,
          framework: packageInfo?.dependencies?.next ? 'Next.js' : 
                    packageInfo?.dependencies?.react ? 'React' : 'Unknown',
        },
        message: `專案資訊: ${this.config.projectName}`,
      };

    } catch (error) {
      this.log(`❌ [STRICT] 獲取專案資訊異常: ${error}`);
      return {
        success: false,
        error: `獲取專案資訊異常: ${error}`,
      };
    }
  }

  /**
   * 嚴格路徑驗證
   */
  private validatePath(path: string): {
    isValid: boolean;
    reason?: string;
  } {
    // 檢查路徑遍歷攻擊
    if (path.includes('..') || path.includes('~')) {
      return {
        isValid: false,
        reason: `路徑包含危險字符: ${path}`,
      };
    }

    // 檢查絕對路徑（如果是絕對路徑，必須在專案目錄內）
    if (path.startsWith('/')) {
      if (!path.startsWith(this.STRICT_WORKING_DIR)) {
        return {
          isValid: false,
          reason: `絕對路徑超出專案範圍: ${path}`,
        };
      }
    }

    // 檢查敏感檔案
    const sensitivePatterns = [
      '/etc/',
      '/root/',
      '/home/',
      '/var/',
      '/proc/',
      '/sys/',
      '.env',
      'docker-compose',
      'Dockerfile',
    ];

    for (const pattern of sensitivePatterns) {
      if (path.includes(pattern)) {
        return {
          isValid: false,
          reason: `嘗試訪問敏感檔案: ${path}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 構建絕對路徑（強制在專案目錄內）
   */
  private buildAbsolutePath(relativePath: string): string {
    // 如果已經是專案內的絕對路徑，直接返回
    if (relativePath.startsWith(this.STRICT_WORKING_DIR)) {
      return relativePath;
    }

    // 如果是其他絕對路徑，拒絕
    if (relativePath.startsWith('/')) {
      throw new Error(`絕對路徑不在專案範圍內: ${relativePath}`);
    }

    // 構建專案內的絕對路徑
    const absolutePath = `${this.STRICT_WORKING_DIR}/${relativePath}`.replace(/\/+/g, '/');
    
    // 確保結果路徑仍在專案目錄內
    if (!absolutePath.startsWith(this.STRICT_WORKING_DIR)) {
      throw new Error(`路徑解析後超出專案範圍: ${absolutePath}`);
    }

    return absolutePath;
  }

  /**
   * 轉換絕對路徑為相對路徑（給底層Docker工具使用）
   */
  private convertToRelativePath(absolutePath: string): string {
    // 如果路徑就是工作目錄，返回 '.'
    if (absolutePath === this.STRICT_WORKING_DIR) {
      return '.';
    }
    
    // 如果路徑在工作目錄內，返回相對路徑
    if (absolutePath.startsWith(this.STRICT_WORKING_DIR + '/')) {
      return absolutePath.substring(this.STRICT_WORKING_DIR.length + 1);
    }
    
    // 如果不在工作目錄內，這是一個錯誤
    throw new Error(`路徑不在工作目錄內: ${absolutePath}`);
  }

  /**
   * 記錄日誌
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      logger.info(`[StrictDockerTools] ${message}`);
    }
  }

  /**
   * 獲取可用工具列表
   */
  static getAvailableTools(): string[] {
    return [
      'strict_docker_read_file',
      'strict_docker_list_directory',
      'strict_docker_write_file',
      'strict_docker_find_files',
      'strict_docker_get_project_info',
    ];
  }

  /**
   * 獲取工具 Schema
   */
  static getToolSchemas() {
    return [
      {
        type: 'function',
        function: {
          name: 'strict_docker_read_file',
          description: '讀取專案內的檔案（嚴格限制在 /app/workspace/[project-name] 內）',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '檔案路徑（相對於專案根目錄）',
              },
            },
            required: ['filePath'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_list_directory',
          description: '列出專案內的目錄內容（嚴格限制在 /app/workspace/[project-name] 內）',
          parameters: {
            type: 'object',
            properties: {
              dirPath: {
                type: 'string',
                description: '目錄路徑（相對於專案根目錄，預設為當前目錄）',
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
          name: 'strict_docker_write_file',
          description: '寫入專案內的檔案（嚴格限制在 /app/workspace/[project-name] 內）',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '檔案路徑（相對於專案根目錄）',
              },
              content: {
                type: 'string',
                description: '檔案內容',
              },
            },
            required: ['filePath', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_find_files',
          description: '搜尋專案內的檔案（嚴格限制在 /app/workspace/[project-name] 內）',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: '搜尋模式',
              },
              searchPath: {
                type: 'string',
                description: '搜尋路徑（相對於專案根目錄，預設為當前目錄）',
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
          name: 'strict_docker_get_project_info',
          description: '獲取專案資訊（嚴格限制在 /app/workspace/[project-name] 內）',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
    ];
  }
} 