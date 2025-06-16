import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';

// 執行 shell 命令的輔助函數
const execCommand = (command: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });
  });
};

// 獲取 AI Web IDE 專案容器列表
const getAIWebIDEContainers = async () => {
  try {
    // 使用 Docker 命令列工具獲取容器列表
    // 只獲取名稱以 "ai-web-ide-" 開頭的容器
    const output = await execCommand('docker', [
      'ps', '-a',
      '--filter', 'name=ai-web-ide-',
      '--format', 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Image}}'
    ]);
    
    const lines = output.trim().split('\n');
    if (lines.length <= 1) return []; // 只有標題行
    
    const containers = lines.slice(1).map(line => {
      const [id, name, status, createdAt, image] = line.split('\t');
      
      // 從容器名稱解析專案資訊
      const projectNameMatch = name.match(/^ai-web-ide-(.+)-(\d+)$/);
      const projectName = projectNameMatch ? projectNameMatch[1] : name.replace('ai-web-ide-', '');
      
      // 判斷容器狀態
      let containerStatus: 'running' | 'stopped' | 'error' = 'stopped';
      if (status.includes('Up')) {
        containerStatus = 'running';
      } else if (status.includes('Exited') && !status.includes('Exited (0)')) {
        containerStatus = 'error';
      }
      
      return {
        id: id,
        name: projectName,
        description: `使用 ${image} 構建的專案`, // 可從容器 labels 中獲取更詳細描述
        lastUpdated: createdAt,
        status: containerStatus,
        containerId: name,
        createdAt: createdAt,
        image: image
      };
    });
    
    return containers;
  } catch (error) {
    console.error('獲取容器列表失敗:', error);
    return [];
  }
};

// 創建新的專案容器
const createProjectContainer = async (projectName: string, description: string) => {
  try {
    // 生成容器名稱
    const timestamp = Date.now();
    const containerName = `ai-web-ide-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
    
    // 創建容器工作目錄
    const workspaceDir = `/tmp/ai-web-ide/${containerName}`;
    
    // 創建並啟動容器
    const containerId = await execCommand('docker', [
      'run', '-d',
      '--name', containerName,
      '--label', 'ai.web.ide.project=true',
      '--label', `ai.web.ide.project.name=${projectName}`,
      '--label', `ai.web.ide.project.description=${description}`,
      '-p', '0:3000', // 動態端口映射
      '-v', `${workspaceDir}:/app/workspace`,
      'node:18-alpine', // 基礎 Node.js 鏡像
      'sh', '-c', 'while true; do sleep 3600; done' // 保持容器運行
    ]);
    
    // 在容器中初始化 Next.js 專案
    await execCommand('docker', [
      'exec', containerName,
      'sh', '-c', 'cd /app/workspace && npx create-next-app@latest . --typescript --tailwind --app --no-git --no-install'
    ]);
    
    return {
      id: containerId.trim(),
      name: projectName,
      description: description,
      lastUpdated: new Date().toISOString(),
      status: 'running' as const,
      containerId: containerName,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('創建容器失敗:', error);
    throw error;
  }
};

// 控制容器（啟動/停止）
const controlContainer = async (containerId: string, action: 'start' | 'stop') => {
  try {
    await execCommand('docker', [action, containerId]);
    return true;
  } catch (error) {
    console.error(`容器 ${action} 操作失敗:`, error);
    throw error;
  }
};

// 刪除容器
const deleteContainer = async (containerId: string) => {
  try {
    // 先停止容器
    await execCommand('docker', ['stop', containerId]).catch(() => {});
    // 刪除容器
    await execCommand('docker', ['rm', containerId]);
    return true;
  } catch (error) {
    console.error('刪除容器失敗:', error);
    throw error;
  }
};

// GET - 獲取容器列表
export async function GET() {
  try {
    const containers = await getAIWebIDEContainers();
    return NextResponse.json({
      success: true,
      data: containers
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '獲取容器列表失敗',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST - 創建新容器或執行容器操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectName, description, containerId } = body;
    
    switch (action) {
      case 'create':
        if (!projectName) {
          return NextResponse.json({
            success: false,
            error: '專案名稱不能為空'
          }, { status: 400 });
        }
        
        const newContainer = await createProjectContainer(projectName, description || '');
        return NextResponse.json({
          success: true,
          data: newContainer
        });
      
      case 'start':
      case 'stop':
        if (!containerId) {
          return NextResponse.json({
            success: false,
            error: '容器 ID 不能為空'
          }, { status: 400 });
        }
        
        await controlContainer(containerId, action);
        return NextResponse.json({
          success: true,
          message: `容器 ${action === 'start' ? '啟動' : '停止'} 成功`
        });
      
      case 'delete':
        if (!containerId) {
          return NextResponse.json({
            success: false,
            error: '容器 ID 不能為空'
          }, { status: 400 });
        }
        
        await deleteContainer(containerId);
        return NextResponse.json({
          success: true,
          message: '容器刪除成功'
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: '不支持的操作'
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '操作失敗',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 