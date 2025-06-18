/**
 * 增強的工具註冊器
 * 整合 Docker 工具和 Agent 控制器
 */

import { logger } from '../logger';
// import { DockerTools } from './docker-tools'; // 已刪除，使用新的 docker 工具替代
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { ToolResult } from './agent-controller';

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

export class EnhancedToolRegistry {
  private dockerTools: DockerTools;
  private toolSchemas: ToolSchema[] = [];
  private customExecutors: Map<string, (params: any) => Promise<ToolResult>> = new Map();
  private enableLogging: boolean;

  constructor(
    dockerManager: DockerAIEditorManager,
    enableLogging: boolean = true
  ) {
    this.dockerTools = new DockerTools(dockerManager);
    this.enableLogging = enableLogging;
    this.initializeTools();
  }

  /**
   * 初始化工具
   */
  private initializeTools(): void {
    // 註冊 Docker 工具的 Schema
    this.toolSchemas = DockerTools.getToolSchemas();
    this.log(`✅ 已註冊 ${this.toolSchemas.length} 個工具`);
  }

  /**
   * 執行工具
   * @param toolName 工具名稱
   * @param parameters 工具參數
   * @returns 工具執行結果
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    this.log(`🔧 執行工具: ${toolName}, 參數: ${JSON.stringify(parameters)}`);

    try {
      // 首先檢查是否有自定義執行器
      if (this.customExecutors.has(toolName)) {
        const executor = this.customExecutors.get(toolName)!;
        return await executor(parameters);
      }

      // 然後檢查內建的 Docker 工具
      switch (toolName) {
        case 'docker_read_file':
          return await this.dockerTools.readFileFromDocker(parameters.filePath);

        case 'docker_list_directory':
          return await this.dockerTools.listDirFromDocker(parameters.dirPath || '.');

        case 'docker_check_path_exists':
          return await this.dockerTools.checkPathExists(parameters.path);

        case 'docker_find_files':
          return await this.dockerTools.findFiles(
            parameters.pattern,
            parameters.searchPath || '.'
          );

        case 'docker_get_file_info':
          return await this.dockerTools.getFileInfo(parameters.filePath);

        default:
          this.log(`❌ 未知的工具: ${toolName}`);
          return {
            success: false,
            error: `未知的工具: ${toolName}`,
          };
      }
    } catch (error) {
      this.log(`❌ 工具執行異常: ${toolName}, 錯誤: ${error}`);
      return {
        success: false,
        error: `工具執行異常: ${error}`,
      };
    }
  }

  /**
   * 獲取所有工具的 Schema
   */
  getAllToolSchemas(): ToolSchema[] {
    return this.toolSchemas;
  }

  /**
   * 獲取所有工具名稱
   */
  getAllToolNames(): string[] {
    return this.toolSchemas.map(schema => schema.function.name);
  }

  /**
   * 檢查工具是否存在
   */
  hasToolSchema(toolName: string): boolean {
    return this.toolSchemas.some(schema => schema.function.name === toolName);
  }

  /**
   * 獲取特定工具的 Schema
   */
  getToolSchema(toolName: string): ToolSchema | undefined {
    return this.toolSchemas.find(schema => schema.function.name === toolName);
  }

  /**
   * 添加自定義工具
   */
  addCustomTool(
    toolName: string,
    description: string,
    parameters: any,
    executor: (params: any) => Promise<ToolResult>
  ): void {
    // 檢查工具是否已存在
    if (this.hasToolSchema(toolName)) {
      this.log(`⚠️ 工具 ${toolName} 已存在，將被覆蓋`);
      this.removeToolSchema(toolName);
    }

    // 添加新的工具 Schema
    const newSchema: ToolSchema = {
      type: 'function',
      function: {
        name: toolName,
        description: description,
        parameters: parameters,
      },
    };

    this.toolSchemas.push(newSchema);
    
    // 存儲自定義執行器
    this.customExecutors.set(toolName, executor);

    this.log(`✅ 已添加自定義工具: ${toolName}`);
  }

  /**
   * 移除工具 Schema
   */
  private removeToolSchema(toolName: string): void {
    this.toolSchemas = this.toolSchemas.filter(
      schema => schema.function.name !== toolName
    );
  }

  /**
   * 獲取工具統計資訊
   */
  getToolStats(): {
    totalTools: number;
    dockerTools: number;
    customTools: number;
    toolNames: string[];
  } {
    const dockerToolNames = DockerTools.getAvailableTools();
    const allToolNames = this.getAllToolNames();
    
    return {
      totalTools: allToolNames.length,
      dockerTools: dockerToolNames.length,
      customTools: allToolNames.length - dockerToolNames.length,
      toolNames: allToolNames,
    };
  }

  /**
   * 驗證工具參數
   */
  validateToolParameters(toolName: string, parameters: any): {
    isValid: boolean;
    errors: string[];
  } {
    const schema = this.getToolSchema(toolName);
    if (!schema) {
      return {
        isValid: false,
        errors: [`工具 ${toolName} 不存在`],
      };
    }

    const errors: string[] = [];
    const required = schema.function.parameters.required || [];
    const properties = schema.function.parameters.properties || {};

    // 檢查必需參數
    for (const requiredParam of required) {
      if (!(requiredParam in parameters)) {
        errors.push(`缺少必需參數: ${requiredParam}`);
      }
    }

    // 檢查參數類型（簡單驗證）
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      if (properties[paramName]) {
        const expectedType = properties[paramName].type;
        const actualType = typeof paramValue;
        
        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`參數 ${paramName} 應為字串類型，實際為 ${actualType}`);
        } else if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`參數 ${paramName} 應為數字類型，實際為 ${actualType}`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`參數 ${paramName} 應為布林類型，實際為 ${actualType}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * 日誌記錄
   */
  private log(message: string): void {
    if (this.enableLogging) {
      logger.info(`[EnhancedToolRegistry] ${message}`);
    }
  }

  /**
   * 測試所有工具的連接性
   */
  async testAllTools(): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: Array<{
      toolName: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    this.log(`🧪 開始測試所有工具的連接性...`);
    
    const results: Array<{
      toolName: string;
      success: boolean;
      error?: string;
    }> = [];

    // 測試 docker_list_directory（最基本的功能）
    try {
      const result = await this.executeTool('docker_list_directory', { dirPath: '.' });
      results.push({
        toolName: 'docker_list_directory',
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        toolName: 'docker_list_directory',
        success: false,
        error: `測試異常: ${error}`,
      });
    }

    // 測試 docker_check_path_exists
    try {
      const result = await this.executeTool('docker_check_path_exists', { path: '/app' });
      results.push({
        toolName: 'docker_check_path_exists',
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        toolName: 'docker_check_path_exists',
        success: false,
        error: `測試異常: ${error}`,
      });
    }

    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;

    this.log(`🧪 工具測試完成: ${passedTests}/${results.length} 通過`);

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      results,
    };
  }
} 