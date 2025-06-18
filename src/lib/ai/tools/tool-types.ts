/**
 * AI 工具統一類型定義
 * 定義所有工具共用的介面和類型
 */

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  metadata?: {
    executionTime?: number;
    toolName?: string;
    timestamp?: number;
  };
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  timestamp: number;
}

export interface ToolExecutionContext {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  containerId?: string;
  workingDirectory?: string;
  permissions?: string[];
}

export interface ToolValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

export interface ToolMetrics {
  callCount: number;
  successCount: number;
  errorCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastUsed?: Date;
}

export enum ToolCategory {
  DOCKER = 'docker',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  DATABASE = 'database',
  AI = 'ai',
  UTILITY = 'utility'
}

export enum ToolAccessLevel {
  PUBLIC = 'public',      // 所有用戶可用
  RESTRICTED = 'restricted', // 需要特定權限
  ADMIN = 'admin'         // 僅管理員可用
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  accessLevel: ToolAccessLevel;
  schema: ToolSchema;
  handler: ToolHandler;
  validator?: ToolValidator;
  metadata?: {
    version: string;
    author: string;
    tags: string[];
    deprecated?: boolean;
    replacedBy?: string;
  };
}

export type ToolHandler = (
  parameters: Record<string, any>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

export type ToolValidator = (
  parameters: Record<string, any>,
  context: ToolExecutionContext
) => Promise<ToolValidationResult>;

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(toolId: string): void;
  get(toolId: string): ToolDefinition | undefined;
  list(category?: ToolCategory): ToolDefinition[];
  search(query: string): ToolDefinition[];
  validate(toolId: string, parameters: Record<string, any>, context: ToolExecutionContext): Promise<ToolValidationResult>;
  execute(toolId: string, parameters: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolManager {
  getRegistry(): ToolRegistry;
  getMetrics(toolId: string): ToolMetrics;
  getAllMetrics(): Record<string, ToolMetrics>;
  resetMetrics(toolId?: string): void;
  enableTool(toolId: string): void;
  disableTool(toolId: string): void;
  isEnabled(toolId: string): boolean;
} 