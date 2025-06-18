/**
 * 統一 Function Call 系統 - 主索引文件
 */

// 基礎類型和分類
export { ToolCategory, FunctionAccessLevel } from './types';
export type { 
  FunctionDefinition, 
  ExecutionContext, 
  ExecutionResult,
  OpenAIFunctionSchema 
} from './types';

// 分類元數據
export { 
  CATEGORY_METADATA,
  getCategoryMetadata,
  getCategoriesByPriority,
  getCategoryIcon,
  getCategoryColor
} from './categories';

// 核心功能
export * from './registry';
export * from './tool-list';
export * from './executor';

// 統一工具管理
import { dockerFunctions as dockerTools } from './docker';
import { filesystemFunctions as filesystemTools } from './filesystem';
import { networkFunctions as networkTools } from './network';
import { utilityFunctions as utilityTools } from './utility';
import { aiTools } from './ai';
import { projectTools } from './project';
import { systemTools } from './system';

// 所有工具的統一列表
export const allTools = [
  ...dockerTools,
  ...filesystemTools,
  ...networkTools,
  ...utilityTools,
  ...aiTools,
  ...projectTools,
  ...systemTools
];

// 按分類組織的工具
export const toolsByCategory = {
  docker: dockerTools,
  filesystem: filesystemTools,
  network: networkTools,
  utility: utilityTools,
  ai: aiTools,
  project: projectTools,
  system: systemTools
};

// 按優先級排序的分類
import { getCategoriesByPriority } from './categories';
export const categoriesByPriority = getCategoriesByPriority();

// 高優先級工具過濾（優先級 >= 8）
export const highPriorityTools = allTools.filter(tool => {
  const categoryMetadata = require('./categories').CATEGORY_METADATA[tool.metadata.category];
  return categoryMetadata && categoryMetadata.priority >= 8;
});

// 工具搜尋功能
export function searchTools(query: string) {
  const lowercaseQuery = query.toLowerCase();
  return allTools.filter(tool => 
    tool.schema.name.toLowerCase().includes(lowercaseQuery) ||
    tool.schema.description.toLowerCase().includes(lowercaseQuery) ||
    tool.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}

// 工具統計資訊
export const toolStats = {
  totalTools: allTools.length,
  categories: Object.keys(toolsByCategory).length,
  highPriorityTools: highPriorityTools.length,
  toolsByCategory: Object.fromEntries(
    Object.entries(toolsByCategory).map(([category, tools]) => [category, tools.length])
  )
};

// 生成 OpenAI Schema
export function generateOpenAISchemas() {
  return allTools.map(tool => ({
    name: tool.schema.name,
    description: tool.schema.description,
    parameters: tool.schema.parameters
  }));
}

// 生成工具文檔
export function generateToolDocumentation() {
  return {
    overview: {
      totalTools: allTools.length,
      categories: Object.keys(toolsByCategory).length,
      lastUpdated: new Date().toISOString()
    },
    categories: Object.entries(toolsByCategory).map(([category, tools]) => ({
      name: category,
      toolCount: tools.length,
      tools: tools.map(tool => ({
        name: tool.schema.name,
        description: tool.schema.description,
        accessLevel: tool.metadata.accessLevel,
        tags: tool.metadata.tags
      }))
    })),
    tools: allTools.map(tool => ({
      id: tool.id,
      name: tool.schema.name,
      description: tool.schema.description,
      category: tool.metadata.category,
      accessLevel: tool.metadata.accessLevel,
      version: tool.metadata.version,
      author: tool.metadata.author,
      tags: tool.metadata.tags,
      parameters: tool.schema.parameters
    }))
  };
}

// 工具執行輔助函數
export async function executeToolById(toolId: string, parameters: any, context?: any) {
  const tool = allTools.find(t => t.id === toolId);
  if (!tool) {
    throw new Error(`工具不存在: ${toolId}`);
  }
  
  // 參數驗證
  if (tool.validator) {
    const validation = await tool.validator(parameters);
    if (!validation.isValid) {
      throw new Error(`參數驗證失敗: ${validation.reason}`);
    }
  }
  
  // 執行工具
  return await tool.handler(parameters, context);
}

// 批量工具執行
export async function executeToolsBatch(requests: Array<{toolId: string, parameters: any}>, context?: any) {
  const results = [];
  
  for (const request of requests) {
    try {
      const result = await executeToolById(request.toolId, request.parameters, context);
      results.push({ success: true, toolId: request.toolId, result });
    } catch (error) {
      results.push({ success: false, toolId: request.toolId, error: error.message });
    }
  }
  
  return results;
} 