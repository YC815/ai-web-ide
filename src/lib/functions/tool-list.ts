/**
 * 動態工具列表管理
 * 提供工具列表的動態加載和管理功能
 */

import type { FunctionDefinition, ToolCategory } from './types';

// 動態工具列表
let dynamicToolList: FunctionDefinition[] = [];

/**
 * 設置動態工具列表
 */
export function setToolList(tools: FunctionDefinition[]): void {
  dynamicToolList = [...tools];
}

/**
 * 獲取動態工具列表
 */
export function getToolList(): FunctionDefinition[] {
  return [...dynamicToolList];
}

/**
 * 添加工具到列表
 */
export function addTool(tool: FunctionDefinition): void {
  const existingIndex = dynamicToolList.findIndex(t => t.id === tool.id);
  if (existingIndex >= 0) {
    dynamicToolList[existingIndex] = tool; // 更新現有工具
  } else {
    dynamicToolList.push(tool); // 添加新工具
  }
}

/**
 * 從列表中移除工具
 */
export function removeTool(toolId: string): boolean {
  const initialLength = dynamicToolList.length;
  dynamicToolList = dynamicToolList.filter(tool => tool.id !== toolId);
  return dynamicToolList.length < initialLength;
}

/**
 * 根據分類篩選工具
 */
export function getToolsByCategory(category: ToolCategory): FunctionDefinition[] {
  return dynamicToolList.filter(tool => tool.metadata.category === category);
}

/**
 * 根據存取權限篩選工具
 */
export function getToolsByAccessLevel(accessLevel: string): FunctionDefinition[] {
  return dynamicToolList.filter(tool => tool.metadata.accessLevel === accessLevel);
}

/**
 * 搜尋工具
 */
export function searchToolsInList(query: string): FunctionDefinition[] {
  const lowerQuery = query.toLowerCase();
  return dynamicToolList.filter(tool => 
    tool.name.toLowerCase().includes(lowerQuery) ||
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * 獲取工具列表統計
 */
export function getToolListStats() {
  const categoryCount = new Map<ToolCategory, number>();
  const accessLevelCount = new Map<string, number>();
  
  dynamicToolList.forEach(tool => {
    // 統計分類
    const category = tool.metadata.category;
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    
    // 統計存取權限
    const accessLevel = tool.metadata.accessLevel;
    accessLevelCount.set(accessLevel, (accessLevelCount.get(accessLevel) || 0) + 1);
  });
  
  return {
    totalTools: dynamicToolList.length,
    categories: Object.fromEntries(categoryCount),
    accessLevels: Object.fromEntries(accessLevelCount)
  };
}

/**
 * 清空工具列表
 */
export function clearToolList(): void {
  dynamicToolList = [];
} 