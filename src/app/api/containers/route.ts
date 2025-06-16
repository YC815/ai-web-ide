import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// 執行 shell 命令的輔助函數
const execCommand = (command: string, args: string[], timeoutMs: number = 5000): Promise<string> => {
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
    
    // 設置可配置的超時
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Docker command timeout (${timeoutMs}ms)`));
    }, timeoutMs);
    
    // 清理超時定時器
    child.on('close', () => {
      clearTimeout(timeout);
    });
  });
};

// 長時間執行命令的輔助函數（用於 Next.js 初始化）
const execLongCommand = (command: string, args: string[]): Promise<string> => {
  return execCommand(command, args, 300000); // 5 分鐘超時
};

// 獲取 AI Web IDE 專案容器列表
const getAIWebIDEContainers = async () => {
  // 先獲取所有容器
  const allContainersOutput = await execCommand('docker', [
    'ps', '-a',
    '--format', 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Image}}'
  ]);
  
  console.log('All Docker containers output:', allContainersOutput);
  
  const allLines = allContainersOutput.trim().split('\n');
  console.log('All container lines:', allLines);
  
  if (allLines.length <= 1) {
    // 沒有任何容器
    return { containers: [], debugOutput: allContainersOutput };
  }
  
  // 過濾出有 ai-web-ide 前綴的容器
  const aiWebIdeLines = allLines.filter((line, index) => {
    if (index === 0) return true; // 保留標題行
    return line.includes('ai-web-ide');
  });
  
  console.log('Filtered AI Web IDE lines:', aiWebIdeLines);
  
  if (aiWebIdeLines.length <= 1) {
    // 沒有 AI Web IDE 容器
    return { containers: [], debugOutput: allContainersOutput };
  }
  
  const containers = aiWebIdeLines.slice(1).map(line => {
    console.log('Processing line:', line);
    const fields = line.split(/\s+/); // 使用空白字符分割，因為可能不是 tab
    console.log('Split fields:', fields);
    
    // 根據調試輸出，欄位順序是: CONTAINER ID, NAMES, STATUS, CREATED AT, IMAGE
    const [id, name, ...rest] = fields;
    
    // 檢查是否有必要的字段
    if (!id || !name) {
      console.log('Missing required fields, skipping:', { id, name });
      return null;
    }
    
    // 重組狀態和創建時間（可能包含空格）
    const statusStartIndex = rest.findIndex(field => field.includes('Up') || field.includes('Exited') || field.includes('Created'));
    const status = statusStartIndex >= 0 ? rest.slice(statusStartIndex).join(' ') : 'Unknown';
    const image = rest[rest.length - 1] || 'Unknown'; // 最後一個欄位通常是 image
    
    console.log('Extracted fields:', { id, name, status, image });
    
    // 從容器名稱解析專案資訊
    const projectNameMatch = name.match(/^ai-web-ide-(.+)-(\d+)$/);
    const projectName = projectNameMatch ? projectNameMatch[1] : name.replace(/^ai-web-ide-/, '');
    
    // 判斷容器狀態
    let containerStatus: 'running' | 'stopped' | 'error' = 'stopped';
    if (status.includes('Up')) {
      containerStatus = 'running';
    } else if (status.includes('Exited') && !status.includes('Exited (0)')) {
      containerStatus = 'error';
    }
    
    const container = {
      id: name, // 使用容器名稱作為 ID，這樣前端可以一致地引用
      name: projectName,
      description: `使用 ${image} 構建的專案`,
      lastUpdated: new Date().toISOString(), // 簡化時間處理
      status: containerStatus,
      containerId: name,
      createdAt: new Date().toISOString(),
      image: image
    };
    
    console.log('Parsed container:', container);
    return container;
  }).filter(container => container !== null); // 過濾掉無效的容器
  
  return { containers, debugOutput: allContainersOutput };
};

// 創建新的專案容器
const createProjectContainer = async (projectName: string, description: string) => {
  // 生成容器名稱
  const timestamp = Date.now();
  const containerName = `ai-web-ide-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
  
  console.log('Creating container with name:', containerName);
  
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
  
  console.log('Container created with ID:', containerId.trim());
  
  // 自動初始化 Next.js 專案
  try {
    console.log('開始初始化 Next.js 專案...');
    
    // 在容器內執行 npx create-next-app
    const initOutput = await execLongCommand('docker', [
      'exec', containerName,
      'sh', '-c', 
      `cd /app/workspace && npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes`
    ]);
    
    console.log('Next.js 專案初始化完成:', initOutput);
    
    // 設置工作目錄權限
    await execCommand('docker', [
      'exec', containerName,
      'sh', '-c',
      `cd /app/workspace/${projectName} && chown -R node:node . && chmod -R 755 .`
    ]);
    
    console.log('專案權限設置完成');
    
    // 安裝額外的開發依賴
    await execLongCommand('docker', [
      'exec', containerName,
      'sh', '-c',
      `cd /app/workspace/${projectName} && npm install --save-dev @types/node`
    ]);
    
    console.log('額外依賴安裝完成');
    
  } catch (initError) {
    console.error('Next.js 專案初始化失敗:', initError);
    // 即使初始化失敗，容器仍然可用，只是沒有 Next.js 專案
    console.log('容器創建成功，但 Next.js 初始化失敗，用戶可以手動初始化');
  }
  
  const newContainer = {
    id: containerName, // 使用容器名稱作為 ID，保持一致性
    name: projectName,
    description: description,
    lastUpdated: new Date().toISOString(),
    status: 'running' as const,
    containerId: containerName,
    createdAt: new Date().toISOString()
  };
  
  console.log('Created container:', newContainer);
  return newContainer;
};

// 控制容器（啟動/停止）
const controlContainer = async (containerId: string, action: 'start' | 'stop') => {
  await execCommand('docker', [action, containerId]);
  return true;
};

// 刪除容器（帶重試機制）
const deleteContainer = async (containerId: string, maxRetries: number = 3) => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`刪除容器嘗試 ${attempt}/${maxRetries}: ${containerId}`);
      
      // 第一次嘗試：優雅停止然後刪除
      if (attempt === 1) {
        try {
          console.log('嘗試優雅停止容器...');
          await execCommand('docker', ['stop', containerId]);
          console.log('容器已停止，嘗試刪除...');
        } catch (stopError) {
          console.log('停止容器失敗或容器已停止:', stopError);
          // 繼續嘗試刪除，容器可能已經停止
        }
        
        await execCommand('docker', ['rm', containerId]);
        console.log('容器刪除成功');
        return true;
      }
      
      // 第二次嘗試：強制停止然後刪除
      if (attempt === 2) {
        try {
          console.log('嘗試強制停止容器...');
          await execCommand('docker', ['kill', containerId]);
          console.log('容器已強制停止，嘗試刪除...');
        } catch (killError) {
          console.log('強制停止容器失敗或容器已停止:', killError);
        }
        
        await execCommand('docker', ['rm', containerId]);
        console.log('容器刪除成功');
        return true;
      }
      
      // 第三次嘗試：強制刪除
      if (attempt === 3) {
        console.log('嘗試強制刪除容器...');
        await execCommand('docker', ['rm', '-f', containerId]);
        console.log('容器強制刪除成功');
        return true;
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`刪除容器嘗試 ${attempt} 失敗:`, lastError.message);
      
      // 如果不是最後一次嘗試，等待一段時間再重試
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // 遞增等待時間：1秒、2秒
        console.log(`等待 ${waitTime}ms 後重試...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // 所有嘗試都失敗了
  throw new Error(`刪除容器失敗，已嘗試 ${maxRetries} 次。最後錯誤: ${lastError?.message}`);
};

// GET - 獲取容器列表
export async function GET() {
  try {
    const result = await getAIWebIDEContainers();
    return NextResponse.json({
      success: true,
      data: result.containers,
      debugOutput: result.debugOutput // 包含完整的 Docker 輸出用於調試
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Docker operation failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: 'Docker 操作失敗',
      details: errorMessage,
      dockerError: true
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Docker operation failed:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: 'Docker 操作失敗',
      details: errorMessage,
      dockerError: true
    }, { status: 500 });
  }
} 