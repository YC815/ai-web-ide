import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// 專案管理相關的型別定義
interface ProjectInitRequest {
  projectId: string;
  projectName: string;
  description?: string;
}

interface FileOperationRequest {
  projectId: string;
  operation: 'read' | 'write' | 'create' | 'delete' | 'list';
  filePath: string;
  content?: string;
  recursive?: boolean;
}

interface CommandExecutionRequest {
  projectId: string;
  command: string;
  args?: string[];
  workingDirectory?: string;
}

// 在容器內執行命令的輔助函數
const execInContainer = (containerId: string, command: string, args: string[] = [], workingDir: string = '/app/workspace'): Promise<{stdout: string, stderr: string, exitCode: number}> => {
  return new Promise((resolve) => {
    const dockerArgs = ['exec', '-w', workingDir, containerId, command, ...args];
    const child = spawn('docker', dockerArgs, { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
    
    // 30秒超時
    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr: 'Command timeout', exitCode: -1 });
    }, 30000);
  });
};

// 初始化 Next.js 專案
const initializeNextJSProject = async (containerId: string, projectName: string): Promise<boolean> => {
  try {
    console.log(`正在初始化 Next.js 專案: ${projectName} 在容器 ${containerId}`);
    
    // 1. 安裝 Next.js CLI
    const installResult = await execInContainer(containerId, 'npm', ['install', '-g', 'create-next-app@latest']);
    console.log('npm install result:', installResult);
    
    if (installResult.exitCode !== 0) {
      console.error('安裝 create-next-app 失敗:', installResult.stderr);
      return false;
    }
    
    // 2. 創建 Next.js 專案
    const createResult = await execInContainer(containerId, 'npx', [
      'create-next-app@latest',
      projectName,
      '--typescript',
      '--tailwind',
      '--eslint',
      '--app',
      '--src-dir',
      '--import-alias', '@/*',
      '--yes'  // 自動回答所有問題
    ]);
    
    console.log('create-next-app result:', createResult);
    
    if (createResult.exitCode !== 0) {
      console.error('創建 Next.js 專案失敗:', createResult.stderr);
      return false;
    }
    
    // 3. 移動檔案到工作目錄根部
    const moveResult = await execInContainer(containerId, 'sh', [
      '-c', 
      `cd /app/workspace && mv ${projectName}/* . && mv ${projectName}/.* . 2>/dev/null || true && rmdir ${projectName}`
    ]);
    
    console.log('move files result:', moveResult);
    
    // 4. 安裝依賴
    const installDepsResult = await execInContainer(containerId, 'npm', ['install']);
    console.log('npm install deps result:', installDepsResult);
    
    if (installDepsResult.exitCode !== 0) {
      console.error('安裝依賴失敗:', installDepsResult.stderr);
      return false;
    }
    
    // 5. 創建基礎的專案結構文件
    await createProjectStructureFiles(containerId);
    
    console.log(`Next.js 專案 ${projectName} 初始化完成`);
    return true;
    
  } catch (error) {
    console.error('初始化 Next.js 專案失敗:', error);
    return false;
  }
};

// 創建專案結構文件
const createProjectStructureFiles = async (containerId: string) => {
  const files = [
    {
      path: '.ai-project-config.json',
      content: JSON.stringify({
        projectType: 'nextjs',
        version: '1.0.0',
        aiManaged: true,
        createdAt: new Date().toISOString(),
        structure: {
          'src/app': '主要應用程式目錄',
          'src/components': 'React 組件',
          'src/lib': '工具函數和配置',
          'public': '靜態資源',
          'package.json': '專案依賴配置'
        }
      }, null, 2)
    },
    {
      path: 'AI_INSTRUCTIONS.md',
      content: `# AI 專案管理指南

## 專案結構
- \`src/app/\` - Next.js 13+ App Router 主目錄
- \`src/components/\` - 可重用的 React 組件
- \`src/lib/\` - 工具函數、類型定義、配置文件
- \`public/\` - 靜態資源（圖片、字體等）

## AI 操作指南
1. 所有檔案操作請透過 File API 進行
2. 執行 npm 指令請使用 Command API
3. 修改檔案前請先讀取現有內容
4. 重要變更前請建立 git checkpoint

## 開發注意事項
- 使用 TypeScript 進行開發
- 遵循 ESLint 規範
- 使用 Tailwind CSS 進行樣式設計
- 組件應該是功能性和可重用的
`
    },
    {
      path: 'TODO.md',
      content: `# TODO 列表

## 待完成任務
- [ ] 設計主頁面佈局
- [ ] 創建基礎組件庫
- [ ] 設定路由結構
- [ ] 添加響應式設計

## 已完成任務
- [x] 初始化 Next.js 專案
- [x] 配置 TypeScript 和 Tailwind CSS
- [x] 建立基礎專案結構
`
    }
  ];
  
  for (const file of files) {
    await execInContainer(containerId, 'sh', [
      '-c',
      `echo '${file.content.replace(/'/g, "'\\''")}' > /app/workspace/${file.path}`
    ]);
  }
};

// 檔案操作處理
const handleFileOperation = async (request: FileOperationRequest) => {
  const { projectId, operation, filePath, content, recursive } = request;
  
  try {
    switch (operation) {
      case 'read':
        const readResult = await execInContainer(
          projectId,
          'cat',
          [filePath]
        );
        return {
          success: true,
          content: readResult.stdout,
          error: readResult.stderr
        };
        
      case 'write':
        if (!content) {
          throw new Error('Content is required for write operation');
        }
        const writeResult = await execInContainer(
          projectId,
          'sh',
          ['-c', `echo '${content.replace(/'/g, "'\\''")}' > ${filePath}`]
        );
        return {
          success: writeResult.exitCode === 0,
          error: writeResult.stderr
        };
        
      case 'create':
        if (!content) {
          throw new Error('Content is required for create operation');
        }
        // 確保目錄存在
        const dirPath = path.dirname(filePath);
        await execInContainer(projectId, 'mkdir', ['-p', dirPath]);
        
        const createResult = await execInContainer(
          projectId,
          'sh',
          ['-c', `echo '${content.replace(/'/g, "'\\''")}' > ${filePath}`]
        );
        return {
          success: createResult.exitCode === 0,
          error: createResult.stderr
        };
        
      case 'delete':
        const deleteArgs = recursive ? ['-rf', filePath] : [filePath];
        const deleteResult = await execInContainer(
          projectId,
          'rm',
          deleteArgs
        );
        return {
          success: deleteResult.exitCode === 0,
          error: deleteResult.stderr
        };
        
      case 'list':
        const listArgs = recursive ? ['-la', '-R', filePath] : ['-la', filePath];
        const listResult = await execInContainer(
          projectId,
          'ls',
          listArgs
        );
        return {
          success: true,
          content: listResult.stdout,
          error: listResult.stderr
        };
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 指令執行處理
const handleCommandExecution = async (request: CommandExecutionRequest) => {
  const { projectId, command, args = [], workingDirectory = '/app/workspace' } = request;
  
  try {
    const result = await execInContainer(projectId, command, args, workingDirectory);
    
    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: -1
    };
  }
};

// API 路由處理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'init':
        const initRequest = body as ProjectInitRequest;
        const initSuccess = await initializeNextJSProject(
          initRequest.projectId,
          initRequest.projectName
        );
        
        return NextResponse.json({
          success: initSuccess,
          message: initSuccess ? '專案初始化成功' : '專案初始化失敗'
        });
        
      case 'file':
        const fileRequest = body as FileOperationRequest;
        const fileResult = await handleFileOperation(fileRequest);
        
        return NextResponse.json({
          success: fileResult.success,
          data: fileResult.content,
          error: fileResult.error
        });
        
      case 'command':
        const commandRequest = body as CommandExecutionRequest;
        const commandResult = await handleCommandExecution(commandRequest);
        
        return NextResponse.json({
          success: commandResult.success,
          stdout: commandResult.stdout,
          stderr: commandResult.stderr,
          exitCode: commandResult.exitCode
        });
        
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Project API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const action = searchParams.get('action');
  
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId is required' },
      { status: 400 }
    );
  }
  
  try {
    switch (action) {
      case 'status':
        // 檢查專案狀態
        const statusResult = await execInContainer(projectId, 'ls', ['-la']);
        return NextResponse.json({
          success: true,
          isInitialized: statusResult.stdout.includes('package.json'),
          containerStatus: 'running'
        });
        
      case 'structure':
        // 獲取專案結構
        const structureResult = await execInContainer(projectId, 'find', ['.', '-type', 'f', '-not', '-path', './node_modules/*']);
        return NextResponse.json({
          success: true,
          files: structureResult.stdout.split('\n').filter(line => line.trim())
        });
        
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Project GET API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
} 