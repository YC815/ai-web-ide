/**
 * OpenAI Function Call 工具分類定義
 */

import { ToolCategory, FunctionAccessLevel } from './types';

// 重新導出類型
export { ToolCategory, FunctionAccessLevel };

export interface FunctionMetadata {
  category: ToolCategory;
  accessLevel: FunctionAccessLevel;
  version: string;
  author?: string;
  tags: string[];
  deprecated?: boolean;
  replacedBy?: string;
  requiresAuth?: boolean;
  rateLimited?: boolean;
  maxCallsPerMinute?: number;
}

export interface OpenAIFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
    }>;
    required?: string[];
  };
}

export interface FunctionDefinition {
  id: string;
  schema: OpenAIFunctionSchema;
  metadata: FunctionMetadata;
  handler: (parameters: Record<string, any>, context?: any) => Promise<any>;
  validator?: (parameters: Record<string, any>) => Promise<{ isValid: boolean; reason?: string }>;
}

export interface CategoryMetadata {
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number; // 1-10, 10 最高優先級
}

export const CATEGORY_METADATA: Record<ToolCategory, CategoryMetadata> = {
  [ToolCategory.DOCKER]: {
    name: 'Docker 容器',
    description: 'Docker 容器操作和管理工具',
    icon: '🐳',
    color: '#2496ED',
    priority: 9
  },
  [ToolCategory.FILESYSTEM]: {
    name: '檔案系統',
    description: '檔案和目錄操作工具',
    icon: '📁',
    color: '#4ECDC4',
    priority: 9
  },
  [ToolCategory.NETWORK]: {
    name: '網路工具',
    description: '網路連線和通訊工具',
    icon: '🌐',
    color: '#96CEB4',
    priority: 7
  },
  [ToolCategory.AI]: {
    name: 'AI 工具',
    description: 'AI 代理和智能輔助工具',
    icon: '🤖',
    color: '#DDA0DD',
    priority: 10
  },
  [ToolCategory.PROJECT]: {
    name: '專案管理',
    description: '專案和工作區管理工具',
    icon: '🏗️',
    color: '#FFB6C1',
    priority: 8
  },
  [ToolCategory.SYSTEM]: {
    name: '系統工具',
    description: '系統資訊和操作工具',
    icon: '⚙️',
    color: '#CD853F',
    priority: 6
  },
  [ToolCategory.UTILITY]: {
    name: '實用工具',
    description: '通用實用工具和輔助功能',
    icon: '🔧',
    color: '#FFA07A',
    priority: 5
  }
};

// 工具分類輔助函數
export function getCategoryMetadata(category: ToolCategory): CategoryMetadata {
  return CATEGORY_METADATA[category];
}

export function getCategoriesByPriority(): ToolCategory[] {
  return Object.keys(CATEGORY_METADATA)
    .map(key => key as ToolCategory)
    .sort((a, b) => CATEGORY_METADATA[b].priority - CATEGORY_METADATA[a].priority);
}

export function getCategoryIcon(category: ToolCategory): string {
  return CATEGORY_METADATA[category]?.icon || '🔧';
}

export function getCategoryColor(category: ToolCategory): string {
  return CATEGORY_METADATA[category]?.color || '#808080';
} 