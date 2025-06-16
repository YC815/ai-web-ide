// AI 工具系統類型定義
// 基於專案報告中的工具架構設計

// 基礎工具回應介面
export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  toolName: string;
}

// Diff 格式定義
export interface CodeDiff {
  id: string;
  filePath: string;
  operation: 'create' | 'update' | 'delete';
  content: string;
  oldContent?: string;
  lineNumbers?: {
    start: number;
    end: number;
  };
}

// DiffApplierTool - 接收 AI 輸出的 diff 並套用至代碼庫
export interface DiffApplierTool {
  applyDiff(diff: CodeDiff): Promise<ToolResponse>;
  applyMultipleDiffs(diffs: CodeDiff[]): Promise<ToolResponse[]>;
  validateDiff(diff: CodeDiff): Promise<boolean>;
}

// ScriptExecutorTool - 在容器中執行 Shell 腳本
export interface ScriptExecutorTool {
  executeScript(command: string, options?: ExecutionOptions): Promise<ToolResponse<ExecutionResult>>;
  executeInContainer(containerName: string, command: string): Promise<ToolResponse<ExecutionResult>>;
}

export interface ExecutionOptions {
  workingDirectory?: string;
  timeout?: number;
  env?: Record<string, string>;
  shell?: string;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// GitCheckpointTool - 自動提交、建立及回滾 Git Checkpoint
export interface GitCheckpointTool {
  createCheckpoint(message: string, description?: string): Promise<ToolResponse<GitCheckpoint>>;
  listCheckpoints(): Promise<ToolResponse<GitCheckpoint[]>>;
  rollbackToCheckpoint(checkpointId: string): Promise<ToolResponse>;
  getCheckpointDiff(checkpointId: string): Promise<ToolResponse<string>>;
  autoCheckpoint(changeThreshold?: number): Promise<ToolResponse<GitCheckpoint>>;
}

export interface GitCheckpoint {
  id: string;
  hash: string;
  message: string;
  description?: string;
  timestamp: Date;
  author: string;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

// ErrorAnalyzerTool - 收集執行時日誌與錯誤
export interface ErrorAnalyzerTool {
  collectErrors(): Promise<ToolResponse<ErrorSummary>>;
  analyzeError(error: string): Promise<ToolResponse<ErrorAnalysis>>;
  generateFixSuggestion(error: ErrorAnalysis): Promise<ToolResponse<FixSuggestion>>;
  clearErrors(): Promise<ToolResponse>;
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recentErrors: ErrorRecord[];
  criticalErrors: ErrorRecord[];
}

export interface ErrorRecord {
  id: string;
  type: 'typescript' | 'eslint' | 'runtime' | 'build' | 'other';
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: Date;
}

export interface ErrorAnalysis {
  error: ErrorRecord;
  possibleCauses: string[];
  affectedFiles: string[];
  relatedErrors: ErrorRecord[];
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface FixSuggestion {
  description: string;
  steps: string[];
  codeChanges?: CodeDiff[];
  confidence: number; // 0-1
  estimatedTime: number; // 分鐘
}

// TokenCostTrackerTool - 計算並回報每條消息的 Token 消耗
export interface TokenCostTrackerTool {
  trackMessage(message: string, response: string): Promise<ToolResponse<TokenUsage>>;
  getSessionUsage(): Promise<ToolResponse<SessionUsage>>;
  resetSession(): Promise<ToolResponse>;
  getCostEstimate(tokens: number): Promise<ToolResponse<CostEstimate>>;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cost: number;
}

export interface SessionUsage {
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  averageTokensPerMessage: number;
  startTime: Date;
  duration: number; // 秒
}

export interface CostEstimate {
  tokens: number;
  estimatedCost: number;
  currency: string;
}

// CallToolInterface - 統一的事件與數據交換總線
export interface CallToolInterface {
  invoke<T = any>(toolName: string, method: string, params?: any): Promise<ToolResponse<T>>;
  subscribe(event: string, callback: (data: any) => void): void;
  unsubscribe(event: string, callback: (data: any) => void): void;
  emit(event: string, data: any): void;
}

// 事件類型定義
export interface ToolEvent {
  type: string;
  data: any;
  timestamp: Date;
  source: string;
}

// 統一錯誤類型
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly operation: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ToolError';
  }
} 