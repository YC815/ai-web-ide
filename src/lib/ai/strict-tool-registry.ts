/**
 * 嚴格工具註冊器
 * 只註冊嚴格限制在 Docker 容器內 /app/workspace/[project-name] 的工具
 * 完全替換原有的工具註冊器，確保無法訪問宿主機檔案
 */

import { logger } from '../core/logger';
import { StrictDockerTools } from './strict-docker-tools';
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

export class StrictToolRegistry {
  private strictDockerTools: StrictDockerTools;
  private toolSchemas: ToolSchema[] = [];
  private enableLogging: boolean;
  private projectName: string;
  private containerId: string;

  constructor(
    dockerManager: DockerAIEditorManager,
    projectName: string,
    containerId: string,
    enableLogging: boolean = true
  ) {
    this.projectName = projectName;
    this.containerId = containerId;
    this.enableLogging = enableLogging;
    
    // 建立嚴格的Docker工具
    this.strictDockerTools = new StrictDockerTools(dockerManager, {
      containerId,
      projectName,
      enableLogging,
    });
    
    this.initializeStrictTools();
  }

  /**
   * 初始化嚴格工具
   */
  private initializeStrictTools(): void {
    // 只註冊嚴格的Docker工具 Schema
    this.toolSchemas = StrictDockerTools.getToolSchemas();
    this.log(`🔒 已註冊 ${this.toolSchemas.length} 個嚴格工具，工作目錄鎖定在: /app/workspace/${this.projectName}`);
  }

  /**
   * 執行工具（嚴格版本）
   * @param toolName 工具名稱
   * @param parameters 工具參數
   * @returns 工具執行結果
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    this.log(`🔧 [STRICT] 執行工具: ${toolName}, 參數: ${JSON.stringify(parameters)}`);

    try {
      // 只允許嚴格的Docker工具
      switch (toolName) {
        case 'strict_docker_read_file':
          return await this.strictDockerTools.readFile(parameters.filePath);

        case 'strict_docker_list_directory':
          return await this.strictDockerTools.listDirectory(parameters.dirPath || '.');

        case 'strict_docker_write_file':
          return await this.strictDockerTools.writeFile(parameters.filePath, parameters.content);

        case 'strict_docker_find_files':
          return await this.strictDockerTools.findFiles(
            parameters.pattern,
            parameters.searchPath || '.'
          );

        case 'strict_docker_get_project_info':
          return await this.strictDockerTools.getProjectInfo();

        default:
          this.log(`❌ [STRICT] 拒絕執行未授權工具: ${toolName}`);
          return {
            success: false,
            error: `🚨 安全拒絕: 工具 "${toolName}" 不在允許列表中。只允許 strict_docker_* 工具。`,
          };
      }
    } catch (error) {
      this.log(`❌ [STRICT] 工具執行異常: ${toolName}, 錯誤: ${error}`);
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
   * 拒絕添加自定義工具（安全考量）
   */
  addCustomTool(): void {
    this.log(`🚨 [STRICT] 拒絕添加自定義工具 - 嚴格模式下不允許`);
    throw new Error('嚴格模式下不允許添加自定義工具');
  }

  /**
   * 獲取工具統計資訊
   */
  getToolStats(): {
    totalTools: number;
    strictDockerTools: number;
    projectName: string;
    containerId: string;
    toolNames: string[];
    securityLevel: 'MAXIMUM';
  } {
    const allToolNames = this.getAllToolNames();
    
    return {
      totalTools: allToolNames.length,
      strictDockerTools: allToolNames.length,
      projectName: this.projectName,
      containerId: this.containerId,
      toolNames: allToolNames,
      securityLevel: 'MAXIMUM',
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
        errors: [`工具不存在: ${toolName}`],
      };
    }

    const errors: string[] = [];
    const requiredParams = schema.function.parameters.required || [];
    
    // 檢查必要參數
    for (const param of requiredParams) {
      if (!(param in parameters)) {
        errors.push(`缺少必要參數: ${param}`);
      }
    }

    // 額外的安全檢查
    if (toolName.includes('read_file') || toolName.includes('write_file')) {
      if (parameters.filePath && (
        parameters.filePath.includes('..') || 
        parameters.filePath.includes('~') ||
        parameters.filePath.startsWith('/etc/') ||
        parameters.filePath.startsWith('/root/')
      )) {
        errors.push(`不安全的檔案路徑: ${parameters.filePath}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 記錄日誌
   */
  private log(message: string): void {
    if (this.enableLogging) {
      logger.info(`[StrictToolRegistry] ${message}`);
    }
  }

  /**
   * 測試所有工具
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
    this.log('🧪 開始測試所有嚴格工具...');

    const results: Array<{
      toolName: string;
      success: boolean;
      error?: string;
    }> = [];

    // 測試 strict_docker_list_directory（最基本的功能）
    try {
      const result = await this.executeTool('strict_docker_list_directory', { dirPath: '.' });
      results.push({
        toolName: 'strict_docker_list_directory',
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        toolName: 'strict_docker_list_directory',
        success: false,
        error: String(error),
      });
    }

    // 測試 strict_docker_get_project_info
    try {
      const result = await this.executeTool('strict_docker_get_project_info', {});
      results.push({
        toolName: 'strict_docker_get_project_info',
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        toolName: 'strict_docker_get_project_info',
        success: false,
        error: String(error),
      });
    }

    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;

    this.log(`✅ 嚴格工具測試完成: ${passedTests}/${results.length} 通過`);

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      results,
    };
  }

  /**
   * 獲取安全報告
   */
  getSecurityReport(): {
    securityLevel: 'MAXIMUM';
    projectName: string;
    containerId: string;
    workingDirectory: string;
    allowedOperations: string[];
    deniedOperations: string[];
    toolCount: number;
  } {
    return {
      securityLevel: 'MAXIMUM',
      projectName: this.projectName,
      containerId: this.containerId,
      workingDirectory: `/app/workspace/${this.projectName}`,
      allowedOperations: [
        'read_file (project only)',
        'list_directory (project only)',
        'write_file (project only)',
        'find_files (project only)',
        'get_project_info (project only)',
      ],
      deniedOperations: [
        'access host machine files',
        'path traversal (../)',
        'access system files (/etc/, /root/)',
        'custom tools',
        'non-docker tools',
      ],
      toolCount: this.toolSchemas.length,
    };
  }
} 