/**
 * 嚴格 Docker 工具
 * 替代已刪除的 docker-tools-v2.ts，提供安全的 Docker 容器操作
 * 限制在指定的專案目錄內操作，確保安全性
 */

import { logger } from '../core/logger';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { ToolResult } from './agent-controller';

export interface StrictDockerToolsConfig {
  containerId: string;
  projectName: string;
  enableLogging?: boolean;
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * 標準化專案名稱：將短橫線轉換為底線
 * 這是因為容器內的實際目錄使用底線格式
 */
function normalizeProjectName(projectName: string): string {
  return projectName.replace(/-/g, '_');
}

export class StrictDockerTools {
  private dockerManager: DockerAIEditorManager;
  private config: StrictDockerToolsConfig;
  private workingDirectory: string;

  constructor(dockerManager: DockerAIEditorManager, config: StrictDockerToolsConfig) {
    this.dockerManager = dockerManager;
    this.config = config;
    
    // 標準化專案名稱，確保與容器內實際目錄格式一致
    const normalizedProjectName = normalizeProjectName(config.projectName);
    this.workingDirectory = `/app/workspace/${normalizedProjectName}`;
    
    if (config.enableLogging) {
      logger.info(`[StrictDockerTools] 初始化嚴格 Docker 工具，工作目錄: ${this.workingDirectory}`);
      logger.info(`[StrictDockerTools] 專案名稱標準化: ${config.projectName} -> ${normalizedProjectName}`);
    }
  }

  /**
   * 讀取檔案
   */
  async readFile(filePath: string): Promise<ToolResult> {
    try {
      const safePath = this.validateAndNormalizePath(filePath);
      
      if (this.config.enableLogging) {
        logger.info(`[StrictDockerTools] 讀取檔案: ${safePath}`);
      }

      // 使用 DockerAIEditorManager 的 executeDockerAITool 方法
      const result = await this.dockerManager.executeDockerAITool('docker_read_file', {
        filePath: safePath
      });
      
      return {
        success: result.success,
        data: result.data,
        message: result.message || `成功讀取檔案: ${safePath}`,
        error: result.error
      };
    } catch (error) {
      logger.error(`[StrictDockerTools] 讀取檔案失敗: ${error}`);
      return {
        success: false,
        error: `讀取檔案失敗: ${error}`
      };
    }
  }

  /**
   * 寫入檔案
   */
  async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      const safePath = this.validateAndNormalizePath(filePath);
      
      if (this.config.enableLogging) {
        logger.info(`[StrictDockerTools] 寫入檔案: ${safePath}, 內容長度: ${content.length}`);
      }

      // 使用 DockerAIEditorManager 的 executeDockerAITool 方法
      const result = await this.dockerManager.executeDockerAITool('docker_write_file', {
        filePath: safePath,
        content: content
      });
      
      return {
        success: result.success,
        data: result.data,
        message: result.message || `檔案寫入成功`,
        error: result.error
      };
    } catch (error) {
      logger.error(`[StrictDockerTools] 寫入檔案失敗: ${error}`);
      return {
        success: false,
        error: `寫入檔案失敗: ${error}`
      };
    }
  }

  /**
   * 列出目錄內容
   */
  async listDirectory(dirPath: string = '.'): Promise<ToolResult> {
    try {
      const safePath = this.validateAndNormalizePath(dirPath);
      
      if (this.config.enableLogging) {
        logger.info(`[StrictDockerTools] 列出目錄: ${safePath}`);
      }

      // 使用 DockerAIEditorManager 的 executeDockerAITool 方法
      const result = await this.dockerManager.executeDockerAITool('docker_list_directory', {
        dirPath: safePath
      });
      
      return {
        success: result.success,
        data: result.data,
        message: result.message || `成功列出目錄 ${safePath} 的內容`,
        error: result.error
      };
    } catch (error) {
      logger.error(`[StrictDockerTools] 列出目錄失敗: ${error}`);
      return {
        success: false,
        error: `列出目錄失敗: ${error}`
      };
    }
  }

  /**
   * 尋找檔案
   */
  async findFiles(pattern: string, searchPath: string = '.'): Promise<ToolResult> {
    try {
      const safePath = this.validateAndNormalizePath(searchPath);
      
      if (this.config.enableLogging) {
        logger.info(`[StrictDockerTools] 尋找檔案: 模式=${pattern}, 路徑=${safePath}`);
      }

      // 先列出目錄內容，然後進行模式匹配
      const listResult = await this.dockerManager.executeDockerAITool('docker_list_directory', {
        dirPath: safePath,
        recursive: true
      });
      
      if (!listResult.success) {
        return {
          success: false,
          error: `列出目錄失敗: ${listResult.error}`
        };
      }

      // 對結果進行模式匹配
      const allFiles = listResult.data as string[];
      const matchedFiles = allFiles.filter(file => {
        return file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')));
      });
      
      return {
        success: true,
        data: matchedFiles,
        message: `找到 ${matchedFiles.length} 個符合條件的檔案`
      };
    } catch (error) {
      logger.error(`[StrictDockerTools] 尋找檔案失敗: ${error}`);
      return {
        success: false,
        error: `尋找檔案失敗: ${error}`
      };
    }
  }

  /**
   * 獲取專案資訊
   */
  async getProjectInfo(): Promise<ToolResult> {
    try {
      if (this.config.enableLogging) {
        logger.info(`[StrictDockerTools] 獲取專案資訊`);
      }

      // 嘗試讀取 package.json
      let projectInfo: any = {
        name: this.config.projectName,
        workingDirectory: this.workingDirectory,
        containerId: this.config.containerId
      };

      try {
        const packageResult = await this.dockerManager.executeDockerAITool('docker_read_file', {
          filePath: 'package.json'
        });
        
        if (packageResult.success && packageResult.data) {
          const packageData = JSON.parse(packageResult.data as string);
          projectInfo = {
            ...projectInfo,
            ...packageData
          };
        }
      } catch {
        // package.json 不存在或解析失敗，使用預設資訊
      }

      return {
        success: true,
        data: projectInfo,
        message: '成功獲取專案資訊'
      };
    } catch (error) {
      logger.error(`[StrictDockerTools] 獲取專案資訊失敗: ${error}`);
      return {
        success: false,
        error: `獲取專案資訊失敗: ${error}`
      };
    }
  }

  /**
   * 驗證並標準化路徑
   */
  private validateAndNormalizePath(path: string): string {
    // 移除危險的路徑元素
    if (path.includes('..') || path.includes('~') || path.startsWith('/etc/') || path.startsWith('/root/')) {
      throw new Error(`不安全的路徑: ${path}`);
    }

    // 標準化路徑 - 對於 Docker 工具，路徑應該是相對於容器工作目錄的
    let normalizedPath = path.replace(/^\/+/, ''); // 移除開頭的斜線
    
    // 如果是當前目錄，直接返回 '.'
    if (normalizedPath === '' || normalizedPath === '.') {
      return '.';
    }
    
    // 返回相對路徑，讓 Docker 工具在容器內處理
    return normalizedPath;
  }

  /**
   * 獲取工具 Schema
   */
  static getToolSchemas(): ToolSchema[] {
    return [
      {
        type: 'function',
        function: {
          name: 'strict_docker_read_file',
          description: '讀取 Docker 容器內的檔案內容（嚴格模式）',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '要讀取的檔案路徑（相對於專案根目錄）'
              }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_write_file',
          description: '寫入內容到 Docker 容器內的檔案（嚴格模式）',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: '要寫入的檔案路徑（相對於專案根目錄）'
              },
              content: {
                type: 'string',
                description: '要寫入的檔案內容'
              }
            },
            required: ['filePath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_list_directory',
          description: '列出 Docker 容器內目錄的內容（嚴格模式）',
          parameters: {
            type: 'object',
            properties: {
              dirPath: {
                type: ['string', 'null'],
                description: '要列出的目錄路徑（相對於專案根目錄）',
                default: '.'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_find_files',
          description: '在 Docker 容器內搜尋符合條件的檔案（嚴格模式）',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: '搜尋模式（支援萬用字元）'
              },
              searchPath: {
                type: ['string', 'null'],
                description: '搜尋路徑（相對於專案根目錄）',
                default: '.'
              }
            },
            required: ['pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'strict_docker_get_project_info',
          description: '獲取 Docker 容器內的專案資訊（嚴格模式）',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ];
  }
} 