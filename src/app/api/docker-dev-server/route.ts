import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export interface DevServerResponse {
  success: boolean;
  status: 'running' | 'stopped' | 'starting' | 'error';
  pid?: string;
  port?: number;
  projectPath?: string;
  logs?: string[];
  error?: string;
  lastChecked: string;
}

/**
 * 檢查容器內開發服務器狀態
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const containerId = searchParams.get('containerId');
  
  if (!containerId) {
    return NextResponse.json(
      { success: false, error: 'containerId is required' },
      { status: 400 }
    );
  }

  try {
    // 檢查容器是否在運行
    const containerStatus = execSync(
      `docker inspect ${containerId} --format="{{.State.Status}}"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (containerStatus !== 'running') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `容器未運行，當前狀態: ${containerStatus}`,
        lastChecked: new Date().toISOString()
      });
    }

    // 檢查開發服務器是否在運行
    let status: 'running' | 'stopped' | 'error' = 'stopped';
    let pid: string | undefined;
    let projectPath: string | undefined;

    try {
      // 查找 npm run dev 進程
      const processes = execSync(
        `docker exec ${containerId} ps aux | grep "npm run dev" | grep -v grep || echo "no_process"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();

      if (processes !== 'no_process') {
        const processLines = processes.split('\n').filter(line => line.trim());
        if (processLines.length > 0) {
          const processInfo = processLines[0].split(/\s+/);
          pid = processInfo[1];
          status = 'running';
        }
      }

      // 查找項目路徑
      const workspaces = execSync(
        `docker exec ${containerId} find /app/workspace -maxdepth 1 -type d -name "*" 2>/dev/null | head -5 || echo "/app/workspace"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();

      const projectDirs = workspaces.split('\n').filter(path => 
        path !== '/app/workspace' && path.includes('/app/workspace/')
      );

      if (projectDirs.length > 0) {
        projectPath = projectDirs[0]; // 使用第一個找到的項目目錄
      }

    } catch (error) {
      status = 'error';
    }

    const result: DevServerResponse = {
      success: true,
      status,
      pid,
      port: 3000,
      projectPath,
      lastChecked: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    });
  }
}

/**
 * 啟動、停止或重啟容器內開發服務器
 */
export async function POST(request: NextRequest) {
  try {
    const { action, containerId, projectPath } = await request.json();

    if (!containerId) {
      return NextResponse.json(
        { success: false, error: 'containerId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start':
        return await startDevServer(containerId, projectPath);
      
      case 'stop':
        return await stopDevServer(containerId);
      
      case 'restart':
        await stopDevServer(containerId);
        // 等待一秒後重啟
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await startDevServer(containerId, projectPath);
      
      case 'auto-detect-and-start':
        return await autoDetectAndStart(containerId);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * 自動檢測項目並啟動開發服務器
 */
async function autoDetectAndStart(containerId: string): Promise<NextResponse> {
  try {
    // 1. 查找所有可能的項目目錄
    const findCommand = `find /app/workspace -maxdepth 2 -name "package.json" -type f 2>/dev/null | head -5`;
    const packageJsonFiles = execSync(
      `docker exec ${containerId} ${findCommand}`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    if (!packageJsonFiles) {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: '未找到任何 package.json 文件，請確保項目已正確設置',
        lastChecked: new Date().toISOString()
      });
    }

    const projectFiles = packageJsonFiles.split('\n').filter(file => file.trim());
    let selectedProject: string | null = null;

    // 2. 優先選擇包含 Next.js 的項目
    for (const packageJsonPath of projectFiles) {
      const projectDir = packageJsonPath.replace('/package.json', '');
      
      try {
        // 檢查是否是 Next.js 項目
        const packageContent = execSync(
          `docker exec ${containerId} cat "${packageJsonPath}"`,
          { encoding: 'utf8', timeout: 5000 }
        );

        if (packageContent.includes('"next"') || packageContent.includes('next dev')) {
          selectedProject = projectDir;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // 如果沒找到 Next.js 項目，使用第一個項目
    if (!selectedProject && projectFiles.length > 0) {
      selectedProject = projectFiles[0].replace('/package.json', '');
    }

    if (!selectedProject) {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: '未找到有效的項目目錄',
        lastChecked: new Date().toISOString()
      });
    }

    // 3. 啟動開發服務器
    return await startDevServer(containerId, selectedProject);

  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'error',
      error: `自動檢測失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    });
  }
}

/**
 * 啟動開發服務器
 */
async function startDevServer(containerId: string, projectPath?: string): Promise<NextResponse> {
  try {
    let targetPath = projectPath;
    
    // 如果沒有指定路徑，嘗試自動檢測
    if (!targetPath) {
      const findResult = execSync(
        `docker exec ${containerId} find /app/workspace -maxdepth 2 -name "package.json" -type f | head -1`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      if (findResult) {
        targetPath = findResult.replace('/package.json', '');
      } else {
        targetPath = '/app/workspace';
      }
    }

    // 確保目錄存在且有 package.json
    const dirExists = execSync(
      `docker exec ${containerId} test -d "${targetPath}" && echo "exists" || echo "not_exists"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (dirExists !== 'exists') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `項目目錄不存在: ${targetPath}`,
        lastChecked: new Date().toISOString()
      });
    }

    // 檢查 package.json
    const packageExists = execSync(
      `docker exec ${containerId} test -f "${targetPath}/package.json" && echo "exists" || echo "not_exists"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    if (packageExists !== 'exists') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `未找到 package.json: ${targetPath}/package.json`,
        lastChecked: new Date().toISOString()
      });
    }

    // 安裝依賴（如果需要）
    try {
      execSync(
        `docker exec ${containerId} bash -c "cd ${targetPath} && npm install --silent"`,
        { encoding: 'utf8', timeout: 30000 }
      );
    } catch (error) {
      // 忽略安裝錯誤，可能已經安裝過了
    }

    // 啟動開發服務器（後台運行）
    const startCommand = `cd ${targetPath} && nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/dev.log 2>&1 & echo $!`;
    
    const pid = execSync(
      `docker exec ${containerId} bash -c "${startCommand}"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    // 等待服務器啟動
    await new Promise(resolve => setTimeout(resolve, 3000));

    return NextResponse.json({
      success: true,
      status: 'starting',
      pid,
      port: 3000,
      projectPath: targetPath,
      logs: [`開發服務器已在 ${targetPath} 啟動`, `PID: ${pid}`],
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'error',
      error: `啟動失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    });
  }
}

/**
 * 停止開發服務器
 */
async function stopDevServer(containerId: string): Promise<NextResponse> {
  try {
    // 殺死所有 npm run dev 進程
    execSync(
      `docker exec ${containerId} pkill -f "npm run dev" || true`,
      { encoding: 'utf8', timeout: 10000 }
    );

    // 等待進程結束
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      success: true,
      status: 'stopped',
      logs: ['開發服務器已停止'],
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'error',
      error: `停止失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    });
  }
} 