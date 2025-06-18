/**
 * AI 工具註冊表實現
 * 統一管理所有 AI 工具的註冊、查詢和執行
 */

import { createToolLogger, ToolLogger } from '../../core/logger';
import {
  ToolDefinition,
  ToolRegistry,
  ToolCategory,
  ToolAccessLevel,
  ToolResult,
  ToolValidationResult,
  ToolExecutionContext,
  ToolMetrics
} from './tool-types';

export class UnifiedToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private metrics: Map<string, ToolMetrics> = new Map();
  private enabledTools: Set<string> = new Set();
  private logger: ToolLogger;

  constructor() {
    this.logger = createToolLogger('ToolRegistry');
    this.logger.info('工具註冊表初始化');
  }

  /**
   * 註冊工具
   */
  register(tool: ToolDefinition): void {
    try {
      // 驗證工具定義
      this.validateToolDefinition(tool);

      // 檢查是否已存在
      if (this.tools.has(tool.id)) {
        this.logger.warn(`工具已存在，將覆蓋: ${tool.id}`);
      }

      // 註冊工具
      this.tools.set(tool.id, tool);
      this.enabledTools.add(tool.id);

      // 初始化指標
      this.metrics.set(tool.id, {
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0
      });

      this.logger.info(`工具註冊成功: ${tool.id}`, {
        name: tool.name,
        category: tool.category,
        accessLevel: tool.accessLevel
      });

    } catch (error) {
      this.logger.error(`工具註冊失敗: ${tool.id}`, error as Error);
      throw error;
    }
  }

  /**
   * 取消註冊工具
   */
  unregister(toolId: string): void {
    if (!this.tools.has(toolId)) {
      this.logger.warn(`嘗試取消註冊不存在的工具: ${toolId}`);
      return;
    }

    this.tools.delete(toolId);
    this.enabledTools.delete(toolId);
    this.metrics.delete(toolId);

    this.logger.info(`工具取消註冊: ${toolId}`);
  }

  /**
   * 獲取工具定義
   */
  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 列出工具
   */
  list(category?: ToolCategory): ToolDefinition[] {
    const allTools = Array.from(this.tools.values());
    
    if (category) {
      return allTools.filter(tool => tool.category === category);
    }
    
    return allTools;
  }

  /**
   * 搜尋工具
   */
  search(query: string): ToolDefinition[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.tools.values()).filter(tool => {
      return (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * 驗證工具調用
   */
  async validate(
    toolId: string, 
    parameters: Record<string, any>, 
    context: ToolExecutionContext
  ): Promise<ToolValidationResult> {
    try {
      const tool = this.tools.get(toolId);
      
      if (!tool) {
        return {
          isValid: false,
          reason: `工具不存在: ${toolId}`
        };
      }

      if (!this.enabledTools.has(toolId)) {
        return {
          isValid: false,
          reason: `工具已停用: ${toolId}`
        };
      }

      // 檢查存取權限
      const accessCheck = this.checkAccess(tool, context);
      if (!accessCheck.isValid) {
        return accessCheck;
      }

      // 驗證參數
      const paramCheck = this.validateParameters(tool, parameters);
      if (!paramCheck.isValid) {
        return paramCheck;
      }

      // 執行自訂驗證器
      if (tool.validator) {
        const customValidation = await tool.validator(parameters, context);
        if (!customValidation.isValid) {
          return customValidation;
        }
      }

      return { isValid: true };

    } catch (error) {
      this.logger.error(`工具驗證異常: ${toolId}`, error as Error);
      return {
        isValid: false,
        reason: `驗證異常: ${error}`
      };
    }
  }

  /**
   * 執行工具
   */
  async execute(
    toolId: string, 
    parameters: Record<string, any>, 
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // 驗證工具調用
      const validation = await this.validate(toolId, parameters, context);
      if (!validation.isValid) {
        this.updateMetrics(toolId, false, Date.now() - startTime);
        return {
          success: false,
          error: validation.reason,
          metadata: {
            toolName: toolId,
            executionTime: Date.now() - startTime,
            timestamp: startTime
          }
        };
      }

      const tool = this.tools.get(toolId)!;
      
      this.logger.info(`執行工具: ${toolId}`, { parameters });

      // 執行工具處理器
      const result = await tool.handler(parameters, context);
      
      const executionTime = Date.now() - startTime;
      
      // 更新指標
      this.updateMetrics(toolId, result.success, executionTime);

      // 添加元數據
      result.metadata = {
        ...result.metadata,
        toolName: toolId,
        executionTime,
        timestamp: startTime
      };

      this.logger.info(`工具執行完成: ${toolId}`, {
        success: result.success,
        executionTime: `${executionTime}ms`
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(toolId, false, executionTime);
      
      this.logger.error(`工具執行異常: ${toolId}`, error as Error);
      
      return {
        success: false,
        error: `工具執行異常: ${error}`,
        metadata: {
          toolName: toolId,
          executionTime,
          timestamp: startTime
        }
      };
    }
  }

  /**
   * 獲取工具指標
   */
  getMetrics(toolId: string): ToolMetrics | undefined {
    return this.metrics.get(toolId);
  }

  /**
   * 獲取所有工具指標
   */
  getAllMetrics(): Record<string, ToolMetrics> {
    const result: Record<string, ToolMetrics> = {};
    
    for (const [toolId, metrics] of this.metrics.entries()) {
      result[toolId] = { ...metrics };
    }
    
    return result;
  }

  /**
   * 重置指標
   */
  resetMetrics(toolId?: string): void {
    if (toolId) {
      if (this.metrics.has(toolId)) {
        this.metrics.set(toolId, {
          callCount: 0,
          successCount: 0,
          errorCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0
        });
        this.logger.info(`重置工具指標: ${toolId}`);
      }
    } else {
      for (const toolId of this.metrics.keys()) {
        this.metrics.set(toolId, {
          callCount: 0,
          successCount: 0,
          errorCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0
        });
      }
      this.logger.info('重置所有工具指標');
    }
  }

  /**
   * 啟用工具
   */
  enableTool(toolId: string): void {
    if (this.tools.has(toolId)) {
      this.enabledTools.add(toolId);
      this.logger.info(`啟用工具: ${toolId}`);
    } else {
      this.logger.warn(`嘗試啟用不存在的工具: ${toolId}`);
    }
  }

  /**
   * 停用工具
   */
  disableTool(toolId: string): void {
    this.enabledTools.delete(toolId);
    this.logger.info(`停用工具: ${toolId}`);
  }

  /**
   * 檢查工具是否啟用
   */
  isEnabled(toolId: string): boolean {
    return this.enabledTools.has(toolId);
  }

  /**
   * 驗證工具定義
   */
  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.id || typeof tool.id !== 'string') {
      throw new Error('工具 ID 必須是非空字串');
    }

    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('工具名稱必須是非空字串');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('工具描述必須是非空字串');
    }

    if (!Object.values(ToolCategory).includes(tool.category)) {
      throw new Error('無效的工具類別');
    }

    if (!Object.values(ToolAccessLevel).includes(tool.accessLevel)) {
      throw new Error('無效的存取等級');
    }

    if (typeof tool.handler !== 'function') {
      throw new Error('工具處理器必須是函數');
    }

    if (!tool.schema || !tool.schema.name || !tool.schema.description) {
      throw new Error('工具 Schema 不完整');
    }
  }

  /**
   * 檢查存取權限
   */
  private checkAccess(tool: ToolDefinition, context: ToolExecutionContext): ToolValidationResult {
    switch (tool.accessLevel) {
      case ToolAccessLevel.PUBLIC:
        return { isValid: true };
      
      case ToolAccessLevel.RESTRICTED:
        if (!context.permissions || context.permissions.length === 0) {
          return {
            isValid: false,
            reason: '需要特定權限才能使用此工具'
          };
        }
        return { isValid: true };
      
      case ToolAccessLevel.ADMIN:
        if (!context.permissions?.includes('admin')) {
          return {
            isValid: false,
            reason: '需要管理員權限才能使用此工具'
          };
        }
        return { isValid: true };
      
      default:
        return {
          isValid: false,
          reason: '未知的存取等級'
        };
    }
  }

  /**
   * 驗證參數
   */
  private validateParameters(tool: ToolDefinition, parameters: Record<string, any>): ToolValidationResult {
    const schema = tool.schema.parameters;
    const required = schema.required || [];

    // 檢查必要參數
    for (const param of required) {
      if (!(param in parameters)) {
        return {
          isValid: false,
          reason: `缺少必要參數: ${param}`
        };
      }
    }

    // 檢查參數類型
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = schema.properties[paramName];
      if (!paramSchema) {
        continue; // 允許額外參數
      }

      const typeCheck = this.validateParameterType(paramValue, paramSchema.type);
      if (!typeCheck.isValid) {
        return {
          isValid: false,
          reason: `參數 ${paramName} 類型錯誤: ${typeCheck.reason}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 驗證參數類型
   */
  private validateParameterType(value: any, expectedType: string): ToolValidationResult {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return { isValid: false, reason: `期望字串，得到 ${typeof value}` };
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          return { isValid: false, reason: `期望數字，得到 ${typeof value}` };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { isValid: false, reason: `期望布林值，得到 ${typeof value}` };
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return { isValid: false, reason: `期望陣列，得到 ${typeof value}` };
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { isValid: false, reason: `期望物件，得到 ${typeof value}` };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * 更新工具指標
   */
  private updateMetrics(toolId: string, success: boolean, executionTime: number): void {
    const metrics = this.metrics.get(toolId);
    if (!metrics) return;

    metrics.callCount++;
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.callCount;
    metrics.lastUsed = new Date();

    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    this.metrics.set(toolId, metrics);
  }
} 