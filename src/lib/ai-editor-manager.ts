// AI 編輯器管理器 - 統一管理所有 AI 編輯器工具和功能
// 這個模組是 AI 編輯器的核心控制器，負責協調前端工具和後端系統工具

import { createAIEditorTools, AIEditorTools } from './ai-editor-tools';
import { ProjectContext } from './ai-context-manager';
import { SystemTools, createSystemTools } from './ai-system-tools';
import DiffProcessor from './diff-processor';
import { 
  AIToolName, 
  AIToolParameters, 
  AIToolResponse,
  getFunctionDefinitionsForOpenAI,
  getFunctionDefinitionsGeneric
} from './ai-function-schemas';

export interface AIEditorConfig {
  projectPath: string;
  projectContext: ProjectContext;
  enableAdvancedTools?: boolean;
  enableUserConfirmation?: boolean;
  enableActionLogging?: boolean;
}

export interface UserConfirmationRequest {
  id: string;
  type: 'diff_apply' | 'command_execute' | 'file_write' | 'user_input';
  title: string;
  message: string;
  data: any;
  options?: string[];
  timestamp: Date;
}

export interface PendingAction {
  id: string;
  toolName: AIToolName;
  parameters: any;
  confirmationRequest?: UserConfirmationRequest;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'error';
}

// 🎯 AI 編輯器管理器
export class AIEditorManager {
  private config: AIEditorConfig;
  private aiTools: AIEditorTools;
  private systemTools: SystemTools;
  private pendingActions: Map<string, PendingAction> = new Map();
  private userConfirmationCallbacks: Map<string, (confirmed: boolean, data?: any) => void> = new Map();

  constructor(config: AIEditorConfig) {
    this.config = config;
    this.aiTools = createAIEditorTools(config.projectContext, config.projectPath);
    this.systemTools = createSystemTools(config.projectPath);
  }

  /**
   * 執行 AI 工具調用
   * @param toolName 工具名稱
   * @param parameters 工具參數
   */
  async executeAITool<T extends AIToolName>(
    toolName: T, 
    parameters: AIToolParameters[T]
  ): Promise<AIToolResponse<T>> {
    try {
      // 記錄工具調用
      if (this.config.enableActionLogging) {
        this.systemTools.logAction(`ai_tool_call_${toolName}`, { parameters }, 'pending');
      }

      // 根據工具類型執行相應邏輯
      switch (toolName) {
        case 'read_file':
          return await this.handleReadFile(parameters as AIToolParameters['read_file']) as AIToolResponse<T>;
        
        case 'list_files':
          return await this.handleListFiles(parameters as AIToolParameters['list_files']) as AIToolResponse<T>;
        
        case 'ask_user':
          return await this.handleAskUser(parameters as AIToolParameters['ask_user']) as AIToolResponse<T>;
        
        case 'propose_diff':
          return await this.handleProposeDiff(parameters as AIToolParameters['propose_diff']) as AIToolResponse<T>;
        
        case 'run_command':
          return await this.handleRunCommand(parameters as AIToolParameters['run_command']) as AIToolResponse<T>;
        
        case 'summarize_file':
          return await this.handleSummarizeFile(parameters as AIToolParameters['summarize_file']) as AIToolResponse<T>;
        
        case 'search_code':
          return await this.handleSearchCode(parameters as AIToolParameters['search_code']) as AIToolResponse<T>;
        
        case 'get_project_context':
          return await this.handleGetProjectContext() as AIToolResponse<T>;
        
        case 'get_git_diff':
          return await this.handleGetGitDiff() as AIToolResponse<T>;
        
        case 'get_terminal_output':
          return await this.handleGetTerminalOutput() as AIToolResponse<T>;
        
        case 'test_file':
          return await this.handleTestFile(parameters as AIToolParameters['test_file']) as AIToolResponse<T>;
        
        default:
          return {
            success: false,
            error: `未知的工具: ${toolName}`
          } as AIToolResponse<T>;
      }
    } catch (error) {
      if (this.config.enableActionLogging) {
        this.systemTools.logAction(`ai_tool_call_${toolName}`, { 
          parameters, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }, 'error');
      }

      return {
        success: false,
        error: `工具執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as AIToolResponse<T>;
    }
  }

  /**
   * 獲取 OpenAI API 格式的 function 定義
   */
  getFunctionDefinitionsForOpenAI(): any[] {
    return getFunctionDefinitionsForOpenAI(this.config.enableAdvancedTools);
  }

  /**
   * 獲取通用格式的 function 定義
   */
  getFunctionDefinitions() {
    return getFunctionDefinitionsGeneric(this.config.enableAdvancedTools);
  }

  /**
   * 處理用戶確認回應
   * @param actionId 操作 ID
   * @param confirmed 是否確認
   * @param data 額外數據
   */
  async handleUserConfirmation(actionId: string, confirmed: boolean, data?: any): Promise<void> {
    const callback = this.userConfirmationCallbacks.get(actionId);
    if (callback) {
      callback(confirmed, data);
      this.userConfirmationCallbacks.delete(actionId);
    }

    const action = this.pendingActions.get(actionId);
    if (action) {
      action.status = confirmed ? 'confirmed' : 'rejected';
      if (!confirmed) {
        this.pendingActions.delete(actionId);
      }
    }
  }

  /**
   * 獲取待處理的操作
   */
  getPendingActions(): PendingAction[] {
    return Array.from(this.pendingActions.values());
  }

  /**
   * 獲取操作日誌
   */
  getActionLogs(limit: number = 50) {
    return this.systemTools.getActionLogs(limit);
  }

  // 私有方法 - 處理各種工具調用

  private async handleReadFile(params: AIToolParameters['read_file']): Promise<AIToolResponse<'read_file'>> {
    const result = await this.aiTools.readFile(params.path);
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.message
    };
  }

  private async handleListFiles(params: AIToolParameters['list_files']): Promise<AIToolResponse<'list_files'>> {
    const result = await this.aiTools.listFiles(params.dir, params.glob, params.showTree);
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.message
    };
  }

  private async handleAskUser(params: AIToolParameters['ask_user']): Promise<AIToolResponse<'ask_user'>> {
    if (!this.config.enableUserConfirmation) {
      return {
        success: false,
        error: '用戶確認功能未啟用'
      };
    }

    const actionId = `ask_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const confirmationRequest: UserConfirmationRequest = {
      id: actionId,
      type: 'user_input',
      title: '用戶輸入請求',
      message: params.prompt,
      data: { options: params.options },
      options: params.options,
      timestamp: new Date()
    };

    const action: PendingAction = {
      id: actionId,
      toolName: 'ask_user',
      parameters: params,
      confirmationRequest,
      timestamp: new Date(),
      status: 'pending'
    };

    this.pendingActions.set(actionId, action);
    
    // 設置確認回調，但不等待
    this.userConfirmationCallbacks.set(actionId, (confirmed: boolean, data?: any) => {
      action.status = confirmed ? 'completed' : 'rejected';
      console.log(`${confirmed ? '✅' : '❌'} 用戶輸入${confirmed ? '已確認' : '被取消'}: ${params.prompt}`, data);
      this.pendingActions.delete(actionId);
    });

    // 觸發前端用戶確認界面
    this.triggerUserConfirmation(confirmationRequest);
    
    // 立即返回，不等待確認
    return {
      success: true,
      data: {
        message: '等待用戶輸入',
        requiresConfirmation: true,
        actionId: actionId
      },
      message: `用戶輸入請求已發送: ${params.prompt}`
    };
  }

  private async handleProposeDiff(params: AIToolParameters['propose_diff']): Promise<AIToolResponse<'propose_diff'>> {
    // 生成 unified diff
    const originalLines = params.original.split('\n');
    const proposedContent = await this.generateProposedContent(params.original, params.instruction);
    const proposedLines = proposedContent.split('\n');
    
    const unifiedDiff = this.generateUnifiedDiff(originalLines, proposedLines, params.path);
    
    const diffProposal = {
      filePath: params.path,
      originalContent: params.original,
      proposedContent,
      unifiedDiff,
      instruction: params.instruction
    };

    if (this.config.enableUserConfirmation) {
      const actionId = `propose_diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const confirmationRequest: UserConfirmationRequest = {
        id: actionId,
        type: 'diff_apply',
        title: '代碼變更確認',
        message: `要套用對 ${params.path} 的修改嗎？\n\n${params.instruction}`,
        data: diffProposal,
        timestamp: new Date()
      };

      const action: PendingAction = {
        id: actionId,
        toolName: 'propose_diff',
        parameters: params,
        confirmationRequest,
        timestamp: new Date(),
        status: 'pending'
      };

      this.pendingActions.set(actionId, action);
      
      // 設置確認回調，但不等待
      this.userConfirmationCallbacks.set(actionId, async (confirmed: boolean) => {
        if (confirmed) {
          // 套用 diff 並寫入檔案
          const applyResult = await this.systemTools.applyDiff(params.original, unifiedDiff);
          if (applyResult.success && applyResult.data) {
            const writeResult = await this.systemTools.writeFile(params.path, applyResult.data);
            action.status = writeResult.success ? 'completed' : 'error';
            console.log(`✅ 代碼變更已套用: ${params.path}`, writeResult);
          } else {
            action.status = 'error';
            console.log(`❌ 代碼變更套用失敗: ${params.path}`, applyResult.error);
          }
        } else {
          action.status = 'rejected';
          console.log(`❌ 代碼變更被取消: ${params.path}`);
        }
        
        this.pendingActions.delete(actionId);
      });

      this.triggerUserConfirmation(confirmationRequest);
      
      // 立即返回，不等待確認
      return {
        success: true,
        data: {
          ...diffProposal,
          requiresConfirmation: true,
          actionId: actionId
        },
        message: `代碼修改建議已生成，等待用戶確認: ${params.path}`
      };
    } else {
      // 直接套用變更
      const applyResult = await this.systemTools.applyDiff(params.original, unifiedDiff);
      if (applyResult.success && applyResult.data) {
        await this.systemTools.writeFile(params.path, applyResult.data);
      }

      return {
        success: true,
        data: diffProposal
      };
    }
  }

  private async handleRunCommand(params: AIToolParameters['run_command']): Promise<AIToolResponse<'run_command'>> {
    if (this.config.enableUserConfirmation) {
      const actionId = `run_command_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const confirmationRequest: UserConfirmationRequest = {
        id: actionId,
        type: 'command_execute',
        title: '命令執行確認',
        message: `要執行以下命令嗎？\n\n${params.command}`,
        data: { command: params.command },
        timestamp: new Date()
      };

      const action: PendingAction = {
        id: actionId,
        toolName: 'run_command',
        parameters: params,
        confirmationRequest,
        timestamp: new Date(),
        status: 'pending'
      };

      this.pendingActions.set(actionId, action);
      
      // 設置確認回調，但不等待
      this.userConfirmationCallbacks.set(actionId, async (confirmed: boolean) => {
        if (confirmed) {
          const fullCommand = params.args ? `${params.command} ${params.args.join(' ')}` : params.command;
          const result = await this.systemTools.runCommandSafe(fullCommand, params.workingDirectory);
          action.status = result.success ? 'completed' : 'error';
          
          // 這裡可以通過事件系統通知前端執行結果
          console.log(`✅ 命令執行完成: ${fullCommand}`, result);
        } else {
          action.status = 'rejected';
          console.log(`❌ 命令執行被取消: ${params.command}`);
        }
        
        this.pendingActions.delete(actionId);
      });

      this.triggerUserConfirmation(confirmationRequest);
      
      // 立即返回，不等待確認
      return {
        success: true,
        data: { 
          message: '命令已提交，等待用戶確認',
          requiresConfirmation: true,
          actionId: actionId
        },
        message: `命令 "${params.command}" 等待用戶確認`
      };
    } else {
      const fullCommand = params.args ? `${params.command} ${params.args.join(' ')}` : params.command;
      const result = await this.systemTools.runCommandSafe(fullCommand, params.workingDirectory);
      return {
        success: result.success,
        data: result.data ? { stdout: result.data.stdout, stderr: result.data.stderr } : undefined,
        error: result.error,
        message: result.message
      };
    }
  }

  private async handleSummarizeFile(params: AIToolParameters['summarize_file']): Promise<AIToolResponse<'summarize_file'>> {
    const readResult = await this.systemTools.readFile(params.path);
    if (!readResult.success || !readResult.data) {
      return {
        success: false,
        error: readResult.error || '無法讀取檔案'
      };
    }

    // 簡單的檔案摘要邏輯（可以後續整合 AI 摘要服務）
    const content = readResult.data;
    const lines = content.split('\n');
    const summary = this.generateFileSummary(content, params.path);

    return {
      success: true,
      data: summary,
      message: `檔案摘要生成成功: ${params.path}`
    };
  }

  private async handleSearchCode(params: AIToolParameters['search_code']): Promise<AIToolResponse<'search_code'>> {
    const result = await this.systemTools.searchCode(params.keyword);
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.message
    };
  }

  private async handleGetProjectContext(): Promise<AIToolResponse<'get_project_context'>> {
    const result = await this.systemTools.getProjectContext();
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      message: result.message
    };
  }

  private async handleGetGitDiff(): Promise<AIToolResponse<'get_git_diff'>> {
    const result = await this.systemTools.runCommandSafe('git diff');
    return {
      success: result.success,
      data: result.data?.stdout || '',
      error: result.error,
      message: result.message
    };
  }

  private async handleGetTerminalOutput(): Promise<AIToolResponse<'get_terminal_output'>> {
    // 這裡需要實作終端輸出緩存機制
    const logs = this.systemTools.getActionLogs(10);
    const terminalOutputs = logs
      .filter(log => log.action === 'run_command' && log.result === 'success')
      .map(log => log.details.stdout || '')
      .filter(output => output.length > 0);

    return {
      success: true,
      data: terminalOutputs,
      message: `獲取到 ${terminalOutputs.length} 條終端輸出`
    };
  }

  private async handleTestFile(params: AIToolParameters['test_file']): Promise<AIToolResponse<'test_file'>> {
    const testCommand = this.getTestCommand(params.path);
    const result = await this.systemTools.runCommandSafe(testCommand);
    
    return {
      success: result.success,
      data: result.data ? {
        stdout: result.data.stdout,
        stderr: result.data.stderr,
        exitCode: result.data.exitCode
      } : undefined,
      error: result.error,
      message: result.message
    };
  }

  // 輔助方法

  private async generateProposedContent(original: string, instruction: string): Promise<string> {
    // 這裡應該整合 AI 服務來生成修改後的內容
    // 目前返回原始內容加上註解
    return `${original}\n\n// AI 修改指令: ${instruction}`;
  }

  private generateUnifiedDiff(originalLines: string[], proposedLines: string[], filePath: string): string {
    // 使用專業的 diff 處理器
    const original = originalLines.join('\n');
    const proposed = proposedLines.join('\n');
    
    return DiffProcessor.generateUnifiedDiff(original, proposed, filePath);
  }

  private generateFileSummary(content: string, filePath: string): string {
    const lines = content.split('\n');
    const extension = filePath.split('.').pop();
    
    let summary = `檔案: ${filePath}\n`;
    summary += `類型: ${extension}\n`;
    summary += `行數: ${lines.length}\n`;
    summary += `大小: ${content.length} 字元\n\n`;
    
    // 分析檔案內容
    if (extension === 'ts' || extension === 'tsx' || extension === 'js' || extension === 'jsx') {
      const functions = content.match(/function\s+\w+|const\s+\w+\s*=|export\s+function/g) || [];
      const imports = content.match(/import\s+.*from/g) || [];
      const exports = content.match(/export\s+/g) || [];
      
      summary += `函數數量: ${functions.length}\n`;
      summary += `導入數量: ${imports.length}\n`;
      summary += `導出數量: ${exports.length}\n`;
    }
    
    return summary;
  }

  private getTestCommand(filePath: string): string {
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return `npm test ${filePath}`;
    } else {
      return `npm test -- --testPathPattern=${filePath}`;
    }
  }

  private triggerUserConfirmation(request: UserConfirmationRequest): void {
    // 這裡需要與前端整合，觸發用戶確認界面
    // 可以通過 WebSocket、事件系統或其他方式通知前端
    console.log('觸發用戶確認:', request);
  }
}

// 工廠函數
export function createAIEditorManager(config: AIEditorConfig): AIEditorManager {
  return new AIEditorManager(config);
} 