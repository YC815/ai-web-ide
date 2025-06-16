// AI 編輯器工具 - 給 AI 使用的安全工具介面
// 這些工具會被 AI 直接調用，需要確保安全性和易用性

import { createSystemTools, SystemTools } from './ai-system-tools';
import { ProjectContext } from './ai-context-manager';

export interface AIEditorToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AIEditorToolParameters {
  read_file: { path: string };
  list_files: { dir?: string; glob?: string; showTree?: boolean };
  ask_user: { prompt: string; options?: string[] };
  propose_diff: { filePath: string; originalContent: string; modifiedContent: string; description: string };
  run_command: { command: string; args?: string[]; workingDirectory?: string };
  search_code: { keyword: string; filePattern?: string };
  summarize_file: { path: string };
  get_project_context: Record<string, never>;
  get_git_diff: Record<string, never>;
  get_terminal_output: Record<string, never>;
  test_file: { filePath: string };
}

export type AIToolName = keyof AIEditorToolParameters;
export type AIToolResponse = AIEditorToolResponse<unknown>;

/**
 * AI 編輯器工具類別
 * 提供給 AI 使用的安全、受限制的檔案和專案操作介面
 */
export class AIEditorTools {
  private projectContext: ProjectContext;
  private systemTools: SystemTools;

  constructor(projectContext: ProjectContext, projectPath: string) {
    this.projectContext = projectContext;
    this.systemTools = createSystemTools(projectPath);
  }

  /**
   * 讀取指定檔案的原始內容
   * @param path 檔案路徑（限制在專案根目錄以下）
   */
  async readFile(path: string): Promise<AIEditorToolResponse<string>> {
    try {
      // 安全檢查：確保路徑在專案範圍內
      if (this.isUnsafePath(path)) {
        return {
          success: false,
          error: '檔案路徑不安全，只能存取專案目錄內的檔案'
        };
      }

      const result = await this.systemTools.readFile(path);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? `成功讀取檔案: ${path}` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 列出檔案清單（可過濾副檔名）
   * @param dir 目錄路徑，預設為根目錄
   * @param glob 檔案過濾模式，如 "*.ts", "*.tsx"
   * @param showTree 是否顯示樹狀結構
   */
  async listFiles(dir: string = '.', glob?: string, showTree: boolean = false): Promise<AIEditorToolResponse<string[]>> {
    try {
      if (this.isUnsafePath(dir)) {
        return {
          success: false,
          error: '目錄路徑不安全，只能存取專案目錄內的檔案'
        };
      }

      const result = await this.systemTools.listDirectory(dir, false, glob, showTree);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? (showTree ? `專案樹狀結構: ${dir}` : `成功列出目錄: ${dir}`) : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `列出檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 讓 AI 與使用者互動
   * @param prompt 提示訊息
   * @param options 選項列表（可選）
   */
  async askUser(prompt: string, options?: string[]): Promise<AIEditorToolResponse<string>> {
    // 這個功能需要前端配合實作
    return {
      success: true,
      data: '用戶確認功能需要前端實作',
      message: `用戶提示: ${prompt}${options ? ` 選項: ${options.join(', ')}` : ''}`
    };
  }

  /**
   * AI 擬定 unified diff，用於生成代碼變更建議
   * @param filePath 檔案路徑
   * @param originalContent 原始內容
   * @param modifiedContent 修改後內容
   * @param description 修改描述
   */
  async proposeDiff(
    filePath: string, 
    originalContent: string, 
    modifiedContent: string, 
    description: string
  ): Promise<AIEditorToolResponse<string>> {
    try {
      if (this.isUnsafePath(filePath)) {
        return {
          success: false,
          error: '檔案路徑不安全'
        };
      }

      const result = await this.systemTools.applyDiff(originalContent, modifiedContent);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: `代碼修改建議: ${description}`
      };
    } catch (error) {
      return {
        success: false,
        error: `生成 diff 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 執行終端指令（限制白名單）
   * @param command 指令
   * @param args 參數
   * @param workingDirectory 工作目錄
   */
  async runCommand(
    command: string, 
    args: string[] = [], 
    workingDirectory?: string
  ): Promise<AIEditorToolResponse<{stdout: string, stderr: string, exitCode: number}>> {
    try {
      const fullCommand = `${command} ${args.join(' ')}`;
      const result = await this.systemTools.runCommandSafe(fullCommand, workingDirectory);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? `命令執行成功: ${command}` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `命令執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在整個專案中搜尋關鍵字
   * @param keyword 搜尋關鍵字
   * @param filePattern 檔案模式
   */
  async searchCode(
    keyword: string, 
    filePattern: string = '**/*.{ts,tsx,js,jsx,json,md}'
  ): Promise<AIEditorToolResponse<Array<{file: string, line: number, content: string}>>> {
    try {
      const result = await this.systemTools.searchCode(keyword, filePattern);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? `搜尋完成: 找到 ${result.data?.length || 0} 個結果` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `代碼搜尋失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 為某檔案產生功能摘要 / 註解
   * @param path 檔案路徑
   */
  async summarizeFile(path: string): Promise<AIEditorToolResponse<string>> {
    try {
      if (this.isUnsafePath(path)) {
        return {
          success: false,
          error: '檔案路徑不安全'
        };
      }

      // 讀取檔案內容
      const readResult = await this.systemTools.readFile(path);
      if (!readResult.success) {
        return {
          success: false,
          error: readResult.error
        };
      }

      // 簡單的檔案摘要邏輯
      const content = readResult.data || '';
      const lines = content.split('\n');
      const summary = `檔案: ${path}\n行數: ${lines.length}\n大小: ${content.length} 字元`;

      return {
        success: true,
        data: summary,
        message: `檔案摘要生成完成: ${path}`
      };
    } catch (error) {
      return {
        success: false,
        error: `檔案摘要失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取專案上下文
   */
  async getProjectContext(): Promise<AIEditorToolResponse<unknown>> {
    try {
      const result = await this.systemTools.getProjectContext();
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        message: result.success ? '專案上下文獲取成功' : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取專案上下文失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取 Git 變更
   */
  async getGitDiff(): Promise<AIEditorToolResponse<string>> {
    try {
      const result = await this.systemTools.runCommandSafe('git diff');
      return {
        success: result.success,
        data: result.data?.stdout || '',
        error: result.error,
        message: result.success ? 'Git diff 獲取成功' : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取 Git diff 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取終端輸出
   */
  async getTerminalOutput(): Promise<AIEditorToolResponse<string>> {
    // 這個功能需要實際的終端會話管理
    return {
      success: true,
      data: '終端輸出功能需要進一步實作',
      message: '終端輸出獲取功能'
    };
  }

  /**
   * 執行測試檔案
   * @param filePath 測試檔案路徑
   */
  async testFile(filePath: string): Promise<AIEditorToolResponse<string>> {
    try {
      if (this.isUnsafePath(filePath)) {
        return {
          success: false,
          error: '檔案路徑不安全'
        };
      }

      const result = await this.systemTools.runCommandSafe(`npm test ${filePath}`);
      return {
        success: result.success,
        data: result.data?.stdout || '',
        error: result.error || result.data?.stderr,
        message: result.success ? `測試執行完成: ${filePath}` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `測試執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 檢查路徑是否安全（防止目錄遍歷攻擊）
   */
  private isUnsafePath(filePath: string): boolean {
    // 檢查是否包含危險的路徑模式
    const dangerousPatterns = [
      '../',
      '..\\',
      '/etc/',
      '/var/',
      '/usr/',
      '/bin/',
      '/sbin/',
      'C:\\',
      'D:\\',
      '~/',
      '$HOME'
    ];

    return dangerousPatterns.some(pattern => filePath.includes(pattern));
  }
}

// 工廠函數
export function createAIEditorTools(projectContext: ProjectContext, projectPath: string): AIEditorTools {
  return new AIEditorTools(projectContext, projectPath);
} 