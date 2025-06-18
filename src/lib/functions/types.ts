/**
 * 統一 Function Call 系統類型定義
 */

// 基礎類型
export interface FunctionParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: FunctionParameter;
  properties?: Record<string, FunctionParameter>;
}

// 工具分類枚舉
export enum ToolCategory {
  DOCKER = 'docker',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  UTILITY = 'utility',
  AI = 'ai',
  PROJECT = 'project',
  SYSTEM = 'system'
}

// 存取權限枚舉
export enum FunctionAccessLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  ADMIN = 'ADMIN'
}

// OpenAI Schema
export interface OpenAISchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// 函數定義介面
export interface FunctionDefinition {
  id: string;
  name?: string;
  description?: string;
  schema: OpenAISchema;
  metadata: {
    category: ToolCategory;
    accessLevel: FunctionAccessLevel;
    version: string;
    author: string;
    tags: string[];
    requiresAuth?: boolean;
    rateLimited?: boolean;
    maxCallsPerMinute?: number;
  };
  handler: (parameters: Record<string, any>, context?: ExecutionContext) => Promise<any>;
  validator?: (parameters: Record<string, any>) => Promise<{ isValid: boolean; reason?: string }>;
}

// 函數範例
export interface FunctionExample {
  title: string;
  description: string;
  parameters: Record<string, any>;
  expectedResult: any;
}

// 函數執行結果
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  executionTime?: number;
  metadata?: {
    functionName: string;
    category: string;
    timestamp: string;
    context?: any;
  };
}

// 函數分類
export interface FunctionCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
}

// 函數統計
export interface FunctionStats {
  totalFunctions: number;
  categoryCounts: Record<string, number>;
  priorityDistribution: Record<number, number>;
  permissionDistribution: Record<string, number>;
  averageExecutionTime?: number;
  totalExecutions?: number;
  successRate?: number;
}

// OpenAI Function Schema
export interface OpenAIFunctionSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// 工具註冊表介面
export interface ToolRegistry {
  register(definition: FunctionDefinition): void;
  unregister(name: string): boolean;
  get(name: string): FunctionDefinition | undefined;
  list(): FunctionDefinition[];
  execute(name: string, parameters: Record<string, any>, context?: any): Promise<FunctionResult>;
  getByCategory(category: string): FunctionDefinition[];
  search(query: string): FunctionDefinition[];
  getStats(): FunctionStats;
}

// 執行上下文
export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: string;
  permissions?: string[];
  isAuthenticated?: boolean;
  rateLimit?: {
    remaining: number;
    resetTime: number;
  };
  metadata?: Record<string, any>;
}

// 執行結果
export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  toolId: string;
  timestamp?: string;
  context?: ExecutionContext;
}

// 遷移相關類型
export interface MigrationMapping {
  oldName: string;
  newName: string;
  status: 'completed' | 'pending' | 'deprecated';
  notes?: string;
}

export interface MigrationStatus {
  oldTool: string;
  newTool: string;
  status: 'completed' | 'pending' | 'deprecated';
  compatibility: 'full' | 'partial' | 'none';
  migrationNotes: string;
  lastUpdated: string;
}

// 驗證結果
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

// 工具執行選項
export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  context?: ExecutionContext;
  validateInput?: boolean;
  logExecution?: boolean;
}

// 批量執行結果
export interface BatchExecutionResult {
  results: (FunctionResult & { functionName: string })[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalExecutionTime: number;
  };
} 