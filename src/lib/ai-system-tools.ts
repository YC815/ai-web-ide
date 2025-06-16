// AI 系統內部執行工具 - 處理 AI 請求後實際執行的邏輯
// 這個模組負責實際的檔案操作、diff 套用、命令執行等系統級操作

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import DiffProcessor from './diff-processor';

const execAsync = promisify(exec);

export interface SystemToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DiffResult {
  originalContent: string;
  modifiedContent: string;
  unifiedDiff: string;
  filePath: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  timestamp: Date;
}

export interface AIActionLog {
  id: string;
  timestamp: Date;
  action: string;
  projectId: string;
  details: any;
  result: 'success' | 'error' | 'pending';
  error?: string;
}

// 🔧 系統內部執行工具
export class SystemTools {
  private projectPath: string;
  private actionLogs: AIActionLog[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * 將 unified diff 套用到原始碼並返回新內容
   * @param original 原始內容
   * @param diff unified diff 字串
   */
  async applyDiff(original: string, diff: string): Promise<SystemToolResponse<string>> {
    try {
      // 使用專業的 diff 處理器
      const result = DiffProcessor.applyUnifiedDiff(original, diff);
      
      // 計算 diff 統計
      const stats = DiffProcessor.calculateDiffStats(diff);
      
      this.logAction('apply_diff', {
        originalLength: original.length,
        diffLength: diff.length,
        resultLength: result.length,
        stats
      }, 'success');

      return {
        success: true,
        data: result,
        message: `Diff 套用成功 (+${stats.additions} -${stats.deletions})`
      };
    } catch (error) {
      this.logAction('apply_diff', { error: error instanceof Error ? error.message : 'Unknown error' }, 'error');
      return {
        success: false,
        error: `Diff 套用失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 將結果寫入檔案系統
   * @param filePath 檔案路徑
   * @param content 檔案內容
   */
  async writeFile(filePath: string, content: string): Promise<SystemToolResponse> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      
      // 確保目錄存在
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // 寫入檔案
      await fs.writeFile(fullPath, content, 'utf8');
      
      this.logAction('write_file', {
        filePath,
        contentLength: content.length
      }, 'success');

      return {
        success: true,
        message: `檔案 ${filePath} 寫入成功`
      };
    } catch (error) {
      this.logAction('write_file', { 
        filePath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'error');
      
      return {
        success: false,
        error: `寫入檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 讀取檔案內容
   * @param filePath 檔案路徑
   */
  async readFile(filePath: string): Promise<SystemToolResponse<string>> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      
      this.logAction('read_file', {
        filePath,
        contentLength: content.length
      }, 'success');

      return {
        success: true,
        data: content,
        message: `檔案 ${filePath} 讀取成功`
      };
    } catch (error) {
      this.logAction('read_file', { 
        filePath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'error');
      
      return {
        success: false,
        error: `讀取檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 有白名單 / 人類確認的終端機執行器
   * @param cmd 要執行的命令
   * @param workingDirectory 工作目錄
   */
  async runCommandSafe(cmd: string, workingDirectory?: string): Promise<SystemToolResponse<CommandResult>> {
    try {
      // 檢查命令安全性
      if (!this.isCommandSafe(cmd)) {
        return {
          success: false,
          error: `命令不在安全白名單中: ${cmd}`
        };
      }

      const cwd = workingDirectory ? path.join(this.projectPath, workingDirectory) : this.projectPath;
      
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(cmd, { 
        cwd,
        timeout: 30000, // 30 秒超時
        maxBuffer: 1024 * 1024 // 1MB 緩衝區
      });
      
      const result: CommandResult = {
        stdout,
        stderr,
        exitCode: 0,
        command: cmd,
        timestamp: new Date()
      };

      this.logAction('run_command', {
        command: cmd,
        workingDirectory: cwd,
        executionTime: Date.now() - startTime,
        stdout: stdout.substring(0, 500), // 只記錄前 500 字元
        stderr: stderr.substring(0, 500)
      }, 'success');

      return {
        success: true,
        data: result,
        message: `命令執行成功: ${cmd}`
      };
    } catch (error: any) {
      const result: CommandResult = {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        command: cmd,
        timestamp: new Date()
      };

      this.logAction('run_command', { 
        command: cmd,
        error: error.message,
        exitCode: error.code
      }, 'error');
      
      return {
        success: false,
        data: result,
        error: `命令執行失敗: ${error.message}`
      };
    }
  }

  /**
   * 列出目錄內容
   * @param dirPath 目錄路徑
   * @param recursive 是否遞歸列出子目錄
   * @param glob 檔案過濾模式
   * @param showTree 是否顯示樹狀結構
   */
  async listDirectory(
    dirPath: string = '.', 
    recursive: boolean = false, 
    glob?: string,
    showTree: boolean = false
  ): Promise<SystemToolResponse<string[]>> {
    try {
      const fullPath = path.resolve(this.projectPath, dirPath);
      
      if (showTree) {
        // 使用樹狀結構顯示
        const treeStructure = await this.generateTreeStructure(fullPath);
        return {
          success: true,
          data: [treeStructure],
          message: `樹狀結構: ${dirPath}`
        };
      }
      
      if (!recursive) {
        // 非遞歸模式
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        let files = items.map(item => {
          const name = item.name;
          return item.isDirectory() ? `${name}/` : name;
        });
        
        if (glob) {
          const globPattern = new RegExp(
            glob.replace(/\*/g, '.*').replace(/\?/g, '.')
          );
          files = files.filter(file => globPattern.test(file));
        }
        
        return {
          success: true,
          data: files,
          message: `列出目錄: ${dirPath}`
        };
      } else {
        // 遞歸模式
        const files: string[] = [];
        await this.walkDirectory(fullPath, files, glob);
        return {
          success: true,
          data: files,
          message: `遞歸列出目錄: ${dirPath}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `列出目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 生成樹狀結構
   */
  private async generateTreeStructure(
    dirPath: string, 
    prefix: string = '', 
    isLast: boolean = true,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return '';
    }

    const excludeDirs = [
      'node_modules', 
      '.git', 
      '.next', 
      'dist', 
      'build', 
      '.cache',
      'coverage',
      '.nyc_output',
      '.vscode',
      '.idea',
      'tmp',
      'temp'
    ];
    
    const excludeFiles = [
      '.DS_Store',
      'Thumbs.db',
      '*.log',
      '*.tmp',
      '*.temp'
    ];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      // 過濾掉不需要的目錄和檔案
      const filteredItems = items.filter(item => {
        if (item.isDirectory()) {
          return !excludeDirs.includes(item.name);
        } else {
          return !excludeFiles.some(pattern => {
            if (pattern.includes('*')) {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'));
              return regex.test(item.name);
            }
            return item.name === pattern;
          });
        }
      });

      // 排序：目錄在前，檔案在後，都按字母順序
      filteredItems.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      let result = '';
      
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const isLastItem = i === filteredItems.length - 1;
        const connector = isLastItem ? '└── ' : '├── ';
        const itemName = item.isDirectory() ? `${item.name}/` : item.name;
        
        result += `${prefix}${connector}${itemName}\n`;
        
        if (item.isDirectory()) {
          const nextPrefix = prefix + (isLastItem ? '    ' : '│   ');
          const subTree = await this.generateTreeStructure(
            path.join(dirPath, item.name),
            nextPrefix,
            isLastItem,
            maxDepth,
            currentDepth + 1
          );
          result += subTree;
        }
      }
      
      return result;
    } catch (error) {
      return `${prefix}[錯誤: 無法讀取目錄]\n`;
    }
  }

  /**
   * 搜尋代碼
   * @param keyword 搜尋關鍵字
   * @param filePattern 檔案模式
   */
  async searchCode(keyword: string, filePattern: string = '**/*.{ts,tsx,js,jsx,json,md}'): Promise<SystemToolResponse<Array<{file: string, line: number, content: string}>>> {
    try {
      const results: Array<{file: string, line: number, content: string}> = [];
      const files = await this.getDirectoryFiles(this.projectPath, true, filePattern);
      
      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(keyword.toLowerCase())) {
              results.push({
                file,
                line: index + 1,
                content: line.trim()
              });
            }
          });
        } catch (error) {
          // 忽略無法讀取的檔案
          continue;
        }
      }

      this.logAction('search_code', {
        keyword,
        filePattern,
        resultCount: results.length
      }, 'success');

      return {
        success: true,
        data: results,
        message: `搜尋完成: 找到 ${results.length} 個結果`
      };
    } catch (error) {
      this.logAction('search_code', { 
        keyword, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'error');
      
      return {
        success: false,
        error: `代碼搜尋失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取專案上下文
   */
  async getProjectContext(): Promise<SystemToolResponse<{structure: any, routes: string[], components: string[], libs: string[]}>> {
    try {
      const structure = await this.analyzeProjectStructure();
      
      this.logAction('get_project_context', {
        structureKeys: Object.keys(structure)
      }, 'success');

      return {
        success: true,
        data: structure,
        message: '專案上下文獲取成功'
      };
    } catch (error) {
      this.logAction('get_project_context', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'error');
      
      return {
        success: false,
        error: `獲取專案上下文失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 紀錄 AI 所有編輯 / 執行操作
   * @param action 操作類型
   * @param details 操作詳情
   * @param result 操作結果
   */
  logAction(action: string, details: any, result: 'success' | 'error' | 'pending'): void {
    const log: AIActionLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      projectId: path.basename(this.projectPath),
      details,
      result,
      error: result === 'error' ? details.error : undefined
    };

    this.actionLogs.push(log);
    
    // 保持最近 1000 條記錄
    if (this.actionLogs.length > 1000) {
      this.actionLogs = this.actionLogs.slice(-1000);
    }
  }

  /**
   * 獲取操作日誌
   * @param limit 限制數量
   */
  getActionLogs(limit: number = 50): AIActionLog[] {
    return this.actionLogs.slice(-limit);
  }

  // 私有方法

  /**
   * 檢查命令是否安全
   */
  private isCommandSafe(cmd: string): boolean {
    const safeCommands = [
      // 包管理器
      'npm', 'yarn', 'pnpm',
      // Git 操作
      'git',
      // 檔案系統操作
      'ls', 'pwd', 'cat', 'head', 'tail', 'less', 'more',
      'grep', 'find', 'tree', 'mkdir', 'touch', 'cp', 'mv',
      'wc', 'sort', 'uniq', 'cut', 'awk', 'sed',
      // 網路工具
      'wget', 'curl', 'ping',
      // 系統資訊
      'which', 'whereis', 'ps', 'top', 'df', 'du', 'free',
      'uname', 'whoami', 'id', 'date', 'uptime',
      // 文字處理
      'echo', 'printf', 'basename', 'dirname',
      // 壓縮解壓
      'tar', 'gzip', 'gunzip', 'zip', 'unzip',
      // Node.js 相關
      'node', 'npx', 'tsc', 'eslint', 'prettier',
      // 測試工具
      'jest', 'mocha', 'cypress'
    ];
    
    const dangerousCommands = [
      'rm -rf', 'sudo', 'chmod', 'chown', 'dd', 'mkfs', 'fdisk',
      'kill', 'killall', 'reboot', 'shutdown', 'halt', 'init',
      'mount', 'umount', 'format', 'del', 'deltree',
      'passwd', 'su', 'crontab', 'at', 'batch'
    ];
    
    // 檢查是否包含危險命令
    if (dangerousCommands.some(dangerous => cmd.toLowerCase().includes(dangerous))) {
      return false;
    }
    
    // 檢查是否以安全命令開頭
    const firstWord = cmd.trim().split(' ')[0];
    return safeCommands.includes(firstWord);
  }

  /**
   * 遞歸獲取目錄檔案
   */
  private async getDirectoryFiles(dirPath: string, recursive: boolean, glob?: string): Promise<string[]> {
    const files: string[] = [];
    const matchGlob = this.matchGlob.bind(this);
    
    async function scanDirectory(currentPath: string, relativePath: string = '') {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // 跳過 node_modules, .git 等目錄
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
            if (recursive) {
              await scanDirectory(fullPath, relativeFilePath);
            }
          }
        } else {
          // 檔案過濾
          if (!glob || matchGlob(entry.name, glob)) {
            files.push(relativeFilePath);
          }
        }
      }
    }
    
    await scanDirectory(dirPath);
    return files;
  }

  /**
   * 簡單的 glob 匹配
   */
  private matchGlob(filename: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    }
    return filename.includes(pattern);
  }

  /**
   * 分析專案結構
   */
  private async analyzeProjectStructure(): Promise<{structure: any, routes: string[], components: string[], libs: string[]}> {
    const routes: string[] = [];
    const components: string[] = [];
    const libs: string[] = [];
    
    const files = await this.getDirectoryFiles(this.projectPath, true);
    
    for (const file of files) {
      if (file.includes('/pages/') || file.includes('/app/') && file.endsWith('page.tsx')) {
        routes.push(file);
      } else if (file.includes('/components/') || file.endsWith('.component.tsx')) {
        components.push(file);
      } else if (file.includes('/lib/') || file.includes('/utils/')) {
        libs.push(file);
      }
    }
    
    return {
      structure: { routes, components, libs, totalFiles: files.length },
      routes,
      components,
      libs
    };
  }

  /**
   * 遞歸遍歷目錄
   */
  private async walkDirectory(dirPath: string, files: string[], glob?: string): Promise<void> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(this.projectPath, fullPath);
        
        if (item.isDirectory()) {
          // 跳過不需要的目錄
          const excludeDirs = ['node_modules', '.git', '.next', 'dist', 'build'];
          if (!excludeDirs.includes(item.name)) {
            await this.walkDirectory(fullPath, files, glob);
          }
        } else {
          if (glob) {
            const globPattern = new RegExp(
              glob.replace(/\*/g, '.*').replace(/\?/g, '.')
            );
            if (globPattern.test(item.name)) {
              files.push(relativePath);
            }
          } else {
            files.push(relativePath);
          }
        }
      }
    } catch (error) {
      // 忽略無法讀取的目錄
    }
  }
}

// 工廠函數
export function createSystemTools(projectPath: string): SystemTools {
  return new SystemTools(projectPath);
} 