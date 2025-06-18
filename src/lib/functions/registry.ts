/**
 * 工具註冊表
 * 提供工具註冊、查詢和管理功能
 */

import type { FunctionDefinition } from './types';

// 工具註冊表
const toolRegistry = new Map<string, FunctionDefinition>();

/**
 * 註冊工具
 */
export function registerTool(tool: FunctionDefinition): void {
  toolRegistry.set(tool.id, tool);
}

/**
 * 批量註冊工具
 */
export function registerTools(tools: FunctionDefinition[]): void {
  tools.forEach(tool => registerTool(tool));
}

/**
 * 獲取工具
 */
export function getTool(id: string): FunctionDefinition | undefined {
  return toolRegistry.get(id);
}

/**
 * 獲取所有已註冊的工具
 */
export function getAllRegisteredTools(): FunctionDefinition[] {
  return Array.from(toolRegistry.values());
}

/**
 * 檢查工具是否已註冊
 */
export function isToolRegistered(id: string): boolean {
  return toolRegistry.has(id);
}

/**
 * 取消註冊工具
 */
export function unregisterTool(id: string): boolean {
  return toolRegistry.delete(id);
}

/**
 * 清空註冊表
 */
export function clearRegistry(): void {
  toolRegistry.clear();
}

/**
 * 獲取註冊表統計
 */
export function getRegistryStats() {
  return {
    totalTools: toolRegistry.size,
    tools: Array.from(toolRegistry.keys())
  };
} 