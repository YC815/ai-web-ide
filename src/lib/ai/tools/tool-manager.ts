/**
 * AI 工具管理器實現
 * 提供工具的統一管理、監控和控制功能
 */

import { createToolLogger, ToolLogger } from '../../core/logger';
import { UnifiedToolRegistry } from './tool-registry';
import { 
  ToolManager, 
  ToolMetrics, 
  ToolRegistry,
  ToolDefinition,
  ToolCategory,
  ToolAccessLevel
} from './tool-types';

export class UnifiedToolManager implements ToolManager {
  private registry: UnifiedToolRegistry;
  private logger: ToolLogger;
  private disabledTools: Set<string> = new Set();

  constructor() {
    this.registry = new UnifiedToolRegistry();
    this.logger = createToolLogger('ToolManager');
    this.logger.info('工具管理器初始化');
  }

  /**
   * 獲取工具註冊表
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * 獲取工具指標
   */
  getMetrics(toolId: string): ToolMetrics {
    const metrics = this.registry.getMetrics(toolId);
    if (!metrics) {
      throw new Error(`工具不存在: ${toolId}`);
    }
    return metrics;
  }

  /**
   * 獲取所有工具指標
   */
  getAllMetrics(): Record<string, ToolMetrics> {
    return this.registry.getAllMetrics();
  }

  /**
   * 重置指標
   */
  resetMetrics(toolId?: string): void {
    this.registry.resetMetrics(toolId);
    this.logger.info(toolId ? `重置工具指標: ${toolId}` : '重置所有工具指標');
  }

  /**
   * 啟用工具
   */
  enableTool(toolId: string): void {
    this.registry.enableTool(toolId);
    this.disabledTools.delete(toolId);
    this.logger.info(`啟用工具: ${toolId}`);
  }

  /**
   * 停用工具
   */
  disableTool(toolId: string): void {
    this.registry.disableTool(toolId);
    this.disabledTools.add(toolId);
    this.logger.info(`停用工具: ${toolId}`);
  }

  /**
   * 檢查工具是否啟用
   */
  isEnabled(toolId: string): boolean {
    return this.registry.isEnabled(toolId) && !this.disabledTools.has(toolId);
  }

  /**
   * 批量註冊工具
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      try {
        this.registry.register(tool);
      } catch (error) {
        this.logger.error(`批量註冊工具失敗: ${tool.id}`, error as Error);
      }
    }
    this.logger.info(`批量註冊 ${tools.length} 個工具`);
  }

  /**
   * 獲取工具統計摘要
   */
  getToolsSummary(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    categorySummary: Record<ToolCategory, number>;
    accessLevelSummary: Record<ToolAccessLevel, number>;
    totalCalls: number;
    successRate: number;
  } {
    const allTools = this.registry.list();
    const allMetrics = this.registry.getAllMetrics();

    const categorySummary: Record<ToolCategory, number> = {
      [ToolCategory.DOCKER]: 0,
      [ToolCategory.FILE_SYSTEM]: 0,
      [ToolCategory.NETWORK]: 0,
      [ToolCategory.DATABASE]: 0,
      [ToolCategory.AI]: 0,
      [ToolCategory.UTILITY]: 0
    };

    const accessLevelSummary: Record<ToolAccessLevel, number> = {
      [ToolAccessLevel.PUBLIC]: 0,
      [ToolAccessLevel.RESTRICTED]: 0,
      [ToolAccessLevel.ADMIN]: 0
    };

    let totalCalls = 0;
    let totalSuccessCount = 0;

    for (const tool of allTools) {
      categorySummary[tool.category]++;
      accessLevelSummary[tool.accessLevel]++;
    }

    for (const metrics of Object.values(allMetrics)) {
      totalCalls += metrics.callCount;
      totalSuccessCount += metrics.successCount;
    }

    const successRate = totalCalls > 0 ? (totalSuccessCount / totalCalls) * 100 : 0;

    return {
      totalTools: allTools.length,
      enabledTools: allTools.filter(tool => this.isEnabled(tool.id)).length,
      disabledTools: allTools.filter(tool => !this.isEnabled(tool.id)).length,
      categorySummary,
      accessLevelSummary,
      totalCalls,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * 獲取最常用的工具
   */
  getMostUsedTools(limit: number = 10): Array<{
    toolId: string;
    toolName: string;
    callCount: number;
    successRate: number;
  }> {
    const allTools = this.registry.list();
    const allMetrics = this.registry.getAllMetrics();

    const toolUsage = allTools.map(tool => {
      const metrics = allMetrics[tool.id];
      const successRate = metrics.callCount > 0 
        ? (metrics.successCount / metrics.callCount) * 100 
        : 0;

      return {
        toolId: tool.id,
        toolName: tool.name,
        callCount: metrics.callCount,
        successRate: Math.round(successRate * 100) / 100
      };
    });

    return toolUsage
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, limit);
  }

  /**
   * 獲取性能最佳的工具
   */
  getBestPerformingTools(limit: number = 10): Array<{
    toolId: string;
    toolName: string;
    successRate: number;
    averageExecutionTime: number;
    callCount: number;
  }> {
    const allTools = this.registry.list();
    const allMetrics = this.registry.getAllMetrics();

    const toolPerformance = allTools
      .filter(tool => allMetrics[tool.id].callCount > 0) // 只包含有使用記錄的工具
      .map(tool => {
        const metrics = allMetrics[tool.id];
        const successRate = (metrics.successCount / metrics.callCount) * 100;

        return {
          toolId: tool.id,
          toolName: tool.name,
          successRate: Math.round(successRate * 100) / 100,
          averageExecutionTime: Math.round(metrics.averageExecutionTime * 100) / 100,
          callCount: metrics.callCount
        };
      });

    return toolPerformance
      .sort((a, b) => {
        // 先按成功率排序，再按執行時間排序
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageExecutionTime - b.averageExecutionTime;
      })
      .slice(0, limit);
  }

  /**
   * 清理未使用的工具
   */
  cleanupUnusedTools(daysSinceLastUse: number = 30): string[] {
    const allTools = this.registry.list();
    const allMetrics = this.registry.getAllMetrics();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastUse);

    const unusedTools: string[] = [];

    for (const tool of allTools) {
      const metrics = allMetrics[tool.id];
      
      // 如果工具從未使用過，或者最後使用時間超過閾值
      if (!metrics.lastUsed || metrics.lastUsed < cutoffDate) {
        unusedTools.push(tool.id);
        this.registry.unregister(tool.id);
      }
    }

    if (unusedTools.length > 0) {
      this.logger.info(`清理 ${unusedTools.length} 個未使用的工具`, { unusedTools });
    }

    return unusedTools;
  }

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    details: {
      totalTools: number;
      enabledTools: number;
      errorRate: number;
      averageResponseTime: number;
      issues: string[];
    };
  }> {
    const summary = this.getToolsSummary();
    const allMetrics = this.registry.getAllMetrics();
    
    const issues: string[] = [];
    let totalExecutionTime = 0;
    let totalErrorCount = 0;

    // 計算總體錯誤率和平均響應時間
    for (const metrics of Object.values(allMetrics)) {
      totalExecutionTime += metrics.totalExecutionTime;
      totalErrorCount += metrics.errorCount;
    }

    const errorRate = summary.totalCalls > 0 
      ? (totalErrorCount / summary.totalCalls) * 100 
      : 0;

    const averageResponseTime = summary.totalCalls > 0 
      ? totalExecutionTime / summary.totalCalls 
      : 0;

    // 檢查問題
    if (summary.enabledTools === 0) {
      issues.push('沒有啟用的工具');
    }

    if (errorRate > 10) {
      issues.push(`錯誤率過高: ${errorRate.toFixed(2)}%`);
    }

    if (averageResponseTime > 5000) {
      issues.push(`平均響應時間過長: ${averageResponseTime.toFixed(2)}ms`);
    }

    // 檢查個別工具問題
    for (const [toolId, metrics] of Object.entries(allMetrics)) {
      if (metrics.callCount > 10) {
        const toolErrorRate = (metrics.errorCount / metrics.callCount) * 100;
        if (toolErrorRate > 20) {
          issues.push(`工具 ${toolId} 錯誤率過高: ${toolErrorRate.toFixed(2)}%`);
        }
      }
    }

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (issues.length > 0) {
      status = errorRate > 20 || averageResponseTime > 10000 ? 'error' : 'warning';
    }

    return {
      status,
      details: {
        totalTools: summary.totalTools,
        enabledTools: summary.enabledTools,
        errorRate: Math.round(errorRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        issues
      }
    };
  }

  /**
   * 導出工具配置
   */
  exportConfiguration(): {
    tools: Array<{
      id: string;
      name: string;
      category: ToolCategory;
      accessLevel: ToolAccessLevel;
      enabled: boolean;
    }>;
    metrics: Record<string, ToolMetrics>;
    timestamp: string;
  } {
    const allTools = this.registry.list();
    const allMetrics = this.registry.getAllMetrics();

    return {
      tools: allTools.map(tool => ({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        accessLevel: tool.accessLevel,
        enabled: this.isEnabled(tool.id)
      })),
      metrics: allMetrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 導入工具配置
   */
  importConfiguration(config: {
    tools: Array<{
      id: string;
      enabled: boolean;
    }>;
  }): void {
    for (const toolConfig of config.tools) {
      if (toolConfig.enabled) {
        this.enableTool(toolConfig.id);
      } else {
        this.disableTool(toolConfig.id);
      }
    }

    this.logger.info(`導入工具配置: ${config.tools.length} 個工具`);
  }
} 