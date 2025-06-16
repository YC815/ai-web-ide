// AI 工具調用的統一介面
// 這個模組提供給 AI Agent 使用的標準化工具接口

export interface AIToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProjectContext {
  projectId: string;
  projectName: string;
  containerStatus: 'running' | 'stopped' | 'error';
}

// 檔案系統操作工具
export class FileSystemTool {
  constructor(private projectContext: ProjectContext) {}

  /**
   * 讀取檔案內容
   */
  async readFile(filePath: string): Promise<AIToolResponse<string>> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file',
          projectId: this.projectContext.projectId,
          operation: 'read',
          filePath
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 寫入檔案內容
   */
  async writeFile(filePath: string, content: string): Promise<AIToolResponse> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file',
          projectId: this.projectContext.projectId,
          operation: 'write',
          filePath,
          content
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        error: result.error,
        message: result.success ? `檔案 ${filePath} 寫入成功` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `寫入檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 創建新檔案
   */
  async createFile(filePath: string, content: string = ''): Promise<AIToolResponse> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file',
          projectId: this.projectContext.projectId,
          operation: 'create',
          filePath,
          content
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        error: result.error,
        message: result.success ? `檔案 ${filePath} 創建成功` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `創建檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 刪除檔案或目錄
   */
  async deleteFile(filePath: string, recursive: boolean = false): Promise<AIToolResponse> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file',
          projectId: this.projectContext.projectId,
          operation: 'delete',
          filePath,
          recursive
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        error: result.error,
        message: result.success ? `${filePath} 刪除成功` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `刪除失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 列出目錄內容
   */
  async listDirectory(dirPath: string = '.', recursive: boolean = false): Promise<AIToolResponse<string>> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file',
          projectId: this.projectContext.projectId,
          operation: 'list',
          filePath: dirPath,
          recursive
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `列出目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// 指令執行工具
export class CommandExecutionTool {
  constructor(private projectContext: ProjectContext) {}

  /**
   * 執行 npm 命令
   */
  async npmCommand(args: string[], workingDirectory?: string): Promise<AIToolResponse<{stdout: string, stderr: string}>> {
    return this.executeCommand('npm', args, workingDirectory);
  }

  /**
   * 執行 Git 命令
   */
  async gitCommand(args: string[], workingDirectory?: string): Promise<AIToolResponse<{stdout: string, stderr: string}>> {
    return this.executeCommand('git', args, workingDirectory);
  }

  /**
   * 執行任意命令
   */
  async executeCommand(
    command: string, 
    args: string[] = [], 
    workingDirectory?: string
  ): Promise<AIToolResponse<{stdout: string, stderr: string}>> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'command',
          projectId: this.projectContext.projectId,
          command,
          args,
          workingDirectory
        })
      });

      const result = await response.json();
      
      return {
        success: result.success,
        data: {
          stdout: result.stdout || '',
          stderr: result.stderr || ''
        },
        error: result.success ? undefined : result.stderr || 'Command execution failed'
      };
    } catch (error) {
      return {
        success: false,
        error: `指令執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 執行多個命令序列
   */
  async executeCommandSequence(commands: {command: string, args?: string[]}[]): Promise<AIToolResponse<{stdout: string, stderr: string}[]>> {
    const results: {stdout: string, stderr: string}[] = [];
    
    for (const cmd of commands) {
      const result = await this.executeCommand(cmd.command, cmd.args || []);
      
      if (!result.success) {
        return {
          success: false,
          error: `命令序列在 "${cmd.command}" 步驟失敗: ${result.error}`,
          data: results
        };
      }
      
      if (result.data) {
        results.push(result.data);
      }
    }
    
    return {
      success: true,
      data: results,
      message: `成功執行 ${commands.length} 個命令`
    };
  }
}

// 專案管理工具
export class ProjectManagementTool {
  constructor(private projectContext: ProjectContext) {}

  /**
   * 初始化 Next.js 專案
   */
  async initializeProject(): Promise<AIToolResponse> {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          projectId: this.projectContext.projectId,
          projectName: this.projectContext.projectName
        })
      });

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        error: result.success ? undefined : result.message
      };
    } catch (error) {
      return {
        success: false,
        error: `專案初始化失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取專案狀態
   */
  async getProjectStatus(): Promise<AIToolResponse<{isInitialized: boolean, containerStatus: string}>> {
    try {
      const url = new URL('/api/project', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      url.searchParams.set('projectId', this.projectContext.projectId);
      url.searchParams.set('action', 'status');
      
      const response = await fetch(url.toString());
      const result = await response.json();
      
      return {
        success: result.success,
        data: {
          isInitialized: result.isInitialized,
          containerStatus: result.containerStatus
        },
        error: result.success ? undefined : result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取專案狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取專案檔案結構
   */
  async getProjectStructure(): Promise<AIToolResponse<string[]>> {
    try {
      const url = new URL('/api/project', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      url.searchParams.set('projectId', this.projectContext.projectId);
      url.searchParams.set('action', 'structure');
      
      const response = await fetch(url.toString());
      const result = await response.json();
      
      return {
        success: result.success,
        data: result.files || [],
        error: result.success ? undefined : result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取專案結構失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// AI 工具整合類
export class AIToolkit {
  public fileSystem: FileSystemTool;
  public command: CommandExecutionTool;
  public project: ProjectManagementTool;

  constructor(projectContext: ProjectContext) {
    this.fileSystem = new FileSystemTool(projectContext);
    this.command = new CommandExecutionTool(projectContext);
    this.project = new ProjectManagementTool(projectContext);
  }

  /**
   * 快速檢查專案是否已初始化，如果沒有則自動初始化
   */
  async ensureProjectInitialized(): Promise<AIToolResponse> {
    const statusResult = await this.project.getProjectStatus();
    
    if (!statusResult.success) {
      return statusResult;
    }

    if (!statusResult.data?.isInitialized) {
      console.log('專案尚未初始化，開始自動初始化...');
      return await this.project.initializeProject();
    }

    return {
      success: true,
      message: '專案已初始化'
    };
  }

  /**
   * 創建完整的 React 組件（包含檔案和樣式）
   */
  async createReactComponent(
    componentName: string, 
    componentCode: string, 
    directory: string = 'src/components'
  ): Promise<AIToolResponse> {
    try {
      // 確保目錄存在
      await this.command.executeCommand('mkdir', ['-p', directory]);
      
      // 創建組件檔案
      const componentPath = `${directory}/${componentName}.tsx`;
      const createResult = await this.fileSystem.createFile(componentPath, componentCode);
      
      if (!createResult.success) {
        return createResult;
      }

      return {
        success: true,
        message: `React 組件 ${componentName} 創建成功於 ${componentPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: `創建 React 組件失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 快速部署與預覽
   */
  async deployAndPreview(): Promise<AIToolResponse> {
    try {
      // 構建專案
      const buildResult = await this.command.npmCommand(['run', 'build']);
      
      if (!buildResult.success) {
        return {
          success: false,
          error: `專案構建失敗: ${buildResult.error}`
        };
      }

      // 啟動開發服務器（如果尚未運行）
      const devResult = await this.command.npmCommand(['run', 'dev']);
      
      return {
        success: true,
        message: '專案構建完成，開發服務器已啟動',
        data: {
          buildOutput: buildResult.data?.stdout,
          devOutput: devResult.data?.stdout
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `部署失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// 工廠函數，用於創建 AI 工具實例
export function createAIToolkit(projectContext: ProjectContext): AIToolkit {
  return new AIToolkit(projectContext);
}

// 用於 AI Agent 的工具使用指南
export const AI_TOOL_USAGE_GUIDE = `
# AI 工具使用指南

## 基本工作流程

1. **專案初始化**
   \`\`\`typescript
   const toolkit = createAIToolkit(projectContext);
   await toolkit.ensureProjectInitialized();
   \`\`\`

2. **檔案操作**
   \`\`\`typescript
   // 讀取檔案
   const content = await toolkit.fileSystem.readFile('src/app/page.tsx');
   
   // 修改檔案
   await toolkit.fileSystem.writeFile('src/app/page.tsx', newContent);
   
   // 創建新檔案
   await toolkit.fileSystem.createFile('src/components/Button.tsx', componentCode);
   \`\`\`

3. **執行命令**
   \`\`\`typescript
   // 安裝依賴
   await toolkit.command.npmCommand(['install', 'package-name']);
   
   // 運行測試
   await toolkit.command.npmCommand(['test']);
   
   // Git 操作
   await toolkit.command.gitCommand(['add', '.']);
   await toolkit.command.gitCommand(['commit', '-m', 'Update components']);
   \`\`\`

4. **專案管理**
   \`\`\`typescript
   // 獲取專案結構
   const structure = await toolkit.project.getProjectStructure();
   
   // 檢查專案狀態
   const status = await toolkit.project.getProjectStatus();
   \`\`\`

## 最佳實踐

- 每次檔案操作前先檢查檔案是否存在
- 重要變更前建立 Git commit
- 使用適當的錯誤處理
- 在修改現有檔案前先備份或讀取原內容
- 遵循 Next.js 和 React 的最佳實踐
`; 