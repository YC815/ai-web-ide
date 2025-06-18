/**
 * 工具執行器
 * 提供統一的工具執行、錯誤處理和結果格式化功能
 */

import type { FunctionDefinition, ExecutionContext, ExecutionResult } from './types';

/**
 * 執行工具
 */
export async function executeTool(
  tool: FunctionDefinition,
  parameters: Record<string, any>,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  try {
    // 參數驗證
    if (tool.validator) {
      const validation = await tool.validator(parameters);
      if (!validation.isValid) {
        return {
          success: false,
          error: `參數驗證失敗: ${validation.reason}`,
          executionTime: Date.now() - startTime,
          toolId: tool.id
        };
      }
    }
    
    // 權限檢查
    if (context && tool.metadata.requiresAuth && !context.isAuthenticated) {
      return {
        success: false,
        error: '此工具需要身份驗證',
        executionTime: Date.now() - startTime,
        toolId: tool.id
      };
    }
    
    // 速率限制檢查
    if (tool.metadata.rateLimited && context) {
      const rateLimitResult = await checkRateLimit(tool, context);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: `速率限制：${rateLimitResult.reason}`,
          executionTime: Date.now() - startTime,
          toolId: tool.id
        };
      }
    }
    
    // 執行工具
    const result = await tool.handler(parameters, context);
    
    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime,
      toolId: tool.id
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
      toolId: tool.id
    };
  }
}

/**
 * 批量執行工具
 */
export async function executeTools(
  executions: Array<{
    tool: FunctionDefinition;
    parameters: Record<string, any>;
    context?: ExecutionContext;
  }>
): Promise<ExecutionResult[]> {
  const promises = executions.map(({ tool, parameters, context }) =>
    executeTool(tool, parameters, context)
  );
  
  return Promise.all(promises);
}

/**
 * 檢查速率限制
 */
async function checkRateLimit(
  tool: FunctionDefinition,
  context: ExecutionContext
): Promise<{ allowed: boolean; reason?: string }> {
  // 簡單的速率限制實現
  // 在實際應用中，這應該使用 Redis 或其他持久化存儲
  const rateLimitKey = `${tool.id}:${context.userId || 'anonymous'}`;
  const maxCalls = tool.metadata.maxCallsPerMinute || 60;
  
  // 這裡應該實現實際的速率限制邏輯
  // 目前只是示例實現
  return { allowed: true };
}

/**
 * 格式化執行結果
 */
export function formatExecutionResult(result: ExecutionResult): string {
  if (result.success) {
    return typeof result.data === 'object' 
      ? JSON.stringify(result.data, null, 2)
      : String(result.data);
  } else {
    return `❌ 執行失敗: ${result.error}`;
  }
}

/**
 * 工具執行統計
 */
const executionStats = new Map<string, {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
}>();

/**
 * 記錄執行統計
 */
export function recordExecutionStats(result: ExecutionResult): void {
  const stats = executionStats.get(result.toolId) || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    totalExecutionTime: 0
  };
  
  stats.totalExecutions++;
  stats.totalExecutionTime += result.executionTime;
  stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;
  
  if (result.success) {
    stats.successfulExecutions++;
  } else {
    stats.failedExecutions++;
  }
  
  executionStats.set(result.toolId, stats);
}

/**
 * 獲取執行統計
 */
export function getExecutionStats(toolId?: string) {
  if (toolId) {
    return executionStats.get(toolId);
  }
  
  return Object.fromEntries(executionStats);
}

/**
 * 清空執行統計
 */
export function clearExecutionStats(): void {
  executionStats.clear();
} 