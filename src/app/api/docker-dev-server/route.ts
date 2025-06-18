import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export interface DevServerResponse {
  success: boolean;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'debug';
  pid?: string;
  port?: number;
  projectPath?: string;
  logs?: string[];
  error?: string;
  lastChecked: string;
  debugInfo?: string[];
}

/**
 * 檢查容器內開發服務器狀態
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const containerId = searchParams.get('containerId');
  const debug = searchParams.get('debug') === 'true';
  
  if (!containerId) {
    return NextResponse.json(
      { success: false, error: 'containerId is required' },
      { status: 400 }
    );
  }

  try {
    // 如果是 debug 模式，返回詳細的容器內部結構
    if (debug) {
      const debugInfo: string[] = [];
      
      try {
        // 檢查容器狀態
        const containerStatus = execSync(
          `docker inspect ${containerId} --format="{{.State.Status}}"`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`容器狀態: ${containerStatus}`);
        
        // 使用與用戶完全相同的命令序列
        const rootContent = execSync(
          `docker exec ${containerId} ls`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`根目錄 ls 結果:\n${rootContent}`);
        
        const appContent = execSync(
          `docker exec ${containerId} sh -c "cd app && ls"`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`cd app && ls 結果:\n${appContent}`);
        
        const workspaceContent = execSync(
          `docker exec ${containerId} sh -c "cd app && cd workspace && ls"`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`cd app && cd workspace && ls 結果:\n${workspaceContent}`);
        
        // 如果找到目錄，檢查其內容
        if (workspaceContent && workspaceContent !== '') {
          const dirs = workspaceContent.split('\n').filter(dir => dir.trim());
          for (const dir of dirs) {
            try {
              const dirContent = execSync(
                `docker exec ${containerId} sh -c "cd app/workspace/${dir} && ls"`,
                { encoding: 'utf8', timeout: 5000 }
              ).trim();
              debugInfo.push(`${dir} 目錄內容:\n${dirContent}`);
              
              // 檢查是否有 package.json
              const hasPackageJson = dirContent.split('\n').some(file => file.trim() === 'package.json');
              if (hasPackageJson) {
                debugInfo.push(`✅ 在 ${dir} 中找到 package.json`);
                
                // 讀取 package.json 內容
                const packageContent = execSync(
                  `docker exec ${containerId} sh -c "cd app/workspace/${dir} && cat package.json"`,
                  { encoding: 'utf8', timeout: 5000 }
                ).trim();
                debugInfo.push(`${dir}/package.json 內容:\n${packageContent.substring(0, 500)}...`);
              }
            } catch (error) {
              debugInfo.push(`檢查 ${dir} 目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
        
        // 也嘗試直接檢查 new_testing 目錄（基於用戶的手動檢查結果）
        try {
          const newTestingContent = execSync(
            `docker exec ${containerId} sh -c "cd app/workspace/new_testing && ls"`,
            { encoding: 'utf8', timeout: 5000 }
          ).trim();
          debugInfo.push(`直接檢查 new_testing 目錄:\n${newTestingContent}`);
        } catch (error) {
          debugInfo.push(`直接檢查 new_testing 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // 檢查工作目錄設置
        const pwd = execSync(
          `docker exec ${containerId} pwd`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`當前工作目錄: ${pwd}`);
        
        // 檢查環境變量
        const env = execSync(
          `docker exec ${containerId} env | grep -E "(PATH|PWD|HOME)" || echo "無相關環境變量"`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        debugInfo.push(`相關環境變量:\n${env}`);
        
      } catch (error) {
        debugInfo.push(`調試信息收集失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return NextResponse.json({
        success: true,
        status: 'debug',
        debugInfo: debugInfo,
        lastChecked: new Date().toISOString()
      });
    }

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
    let port = 3000;

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
      port,
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
    // 1. 先檢查容器內的目錄結構，使用與用戶相同的命令
    let debugInfo: string[] = [];
    
    try {
      // 使用用戶相同的命令檢查 workspace 目錄
      const workspaceContent = execSync(
        `docker exec ${containerId} sh -c "cd app && cd workspace && ls"`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      debugInfo.push(`workspace 目錄內容:\n${workspaceContent || '(目錄為空)'}`);
      
      if (!workspaceContent) {
        return NextResponse.json({
          success: false,
          status: 'error',
          error: '未找到任何專案目錄，workspace 目錄為空',
          debugInfo: debugInfo,
          lastChecked: new Date().toISOString()
        });
      }
      
      // 檢查每個子目錄
      const dirs = workspaceContent.split('\n').filter(dir => dir.trim());
      let selectedProject: string | null = null;
      
      for (const dir of dirs) {
        try {
          debugInfo.push(`檢查目錄: ${dir}`);
          
          // 檢查目錄內容
          const dirContent = execSync(
            `docker exec ${containerId} sh -c "cd app/workspace/${dir} && ls"`,
            { encoding: 'utf8', timeout: 5000 }
          ).trim();
          debugInfo.push(`${dir} 目錄內容: ${dirContent}`);
          
          // 檢查是否有 package.json
          const hasPackageJson = dirContent.split('\n').some(file => file.trim() === 'package.json');
          
          if (hasPackageJson) {
            debugInfo.push(`✅ 在 ${dir} 中找到 package.json`);
            
            // 讀取 package.json 檢查是否為 Next.js 專案
            try {
              const packageContent = execSync(
                `docker exec ${containerId} sh -c "cd app/workspace/${dir} && cat package.json"`,
                { encoding: 'utf8', timeout: 5000 }
              ).trim();
              
              if (packageContent.includes('"next"') || packageContent.includes('next dev')) {
                selectedProject = `/app/workspace/${dir}`;
                debugInfo.push(`🎯 選中 Next.js 專案: ${selectedProject}`);
                break;
              } else {
                debugInfo.push(`${dir} 不是 Next.js 專案，繼續搜索`);
                if (!selectedProject) {
                  selectedProject = `/app/workspace/${dir}`;
                  debugInfo.push(`暫時選中第一個專案: ${selectedProject}`);
                }
              }
            } catch (error) {
              debugInfo.push(`讀取 ${dir}/package.json 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          } else {
            debugInfo.push(`${dir} 中沒有 package.json`);
          }
        } catch (error) {
          debugInfo.push(`檢查 ${dir} 失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      if (!selectedProject) {
        return NextResponse.json({
          success: false,
          status: 'error',
          error: '未找到包含 package.json 的專案目錄',
          debugInfo: debugInfo,
          lastChecked: new Date().toISOString()
        });
      }
      
      // 啟動開發服務器
      debugInfo.push(`準備啟動開發服務器，專案路徑: ${selectedProject}`);
      return await startDevServer(containerId, selectedProject);
      
    } catch (error) {
      debugInfo.push(`目錄檢查失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `自動檢測失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
        debugInfo: debugInfo,
        lastChecked: new Date().toISOString()
      });
    }

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
    let debugInfo: string[] = [];
    
    // 如果沒有指定路徑，嘗試自動檢測
    if (!targetPath) {
      debugInfo.push('未指定專案路徑，開始自動檢測...');
      
      const findResult = execSync(
        `docker exec ${containerId} find /app/workspace -maxdepth 3 -name "package.json" -type f | head -1`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      debugInfo.push(`自動檢測結果: ${findResult || '(未找到)'}`);
      
      if (findResult) {
        targetPath = findResult.replace('/package.json', '');
        debugInfo.push(`設定目標路徑為: ${targetPath}`);
      } else {
        targetPath = '/app/workspace';
        debugInfo.push(`使用預設路徑: ${targetPath}`);
      }
    } else {
      debugInfo.push(`使用指定的專案路徑: ${targetPath}`);
    }

    // 列出目標目錄的內容
    try {
      const dirContent = execSync(
        `docker exec ${containerId} ls -la "${targetPath}"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      debugInfo.push(`目標目錄 ${targetPath} 的內容:\n${dirContent}`);
    } catch (error) {
      debugInfo.push(`無法列出目標目錄內容: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 確保目錄存在且有 package.json
    const dirExists = execSync(
      `docker exec ${containerId} test -d "${targetPath}" && echo "exists" || echo "not_exists"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    debugInfo.push(`目錄存在檢查 (${targetPath}): ${dirExists}`);

    if (dirExists !== 'exists') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `項目目錄不存在: ${targetPath}`,
        debugInfo: debugInfo,
        lastChecked: new Date().toISOString()
      });
    }

    // 檢查 package.json
    const packageExists = execSync(
      `docker exec ${containerId} test -f "${targetPath}/package.json" && echo "exists" || echo "not_exists"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    debugInfo.push(`package.json 存在檢查 (${targetPath}/package.json): ${packageExists}`);

    if (packageExists !== 'exists') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `未找到 package.json: ${targetPath}/package.json`,
        debugInfo: debugInfo,
        lastChecked: new Date().toISOString()
      });
    }

    // 檢查 package.json 內容
    try {
      const packageContent = execSync(
        `docker exec ${containerId} cat "${targetPath}/package.json"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      debugInfo.push(`package.json 內容預覽: ${packageContent.substring(0, 200)}...`);
    } catch (error) {
      debugInfo.push(`無法讀取 package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 安裝依賴（如果需要）
    try {
      debugInfo.push('開始安裝 npm 依賴...');
      const npmInstallOutput = execSync(
        `docker exec ${containerId} bash -c "cd ${targetPath} && npm install --silent"`,
        { encoding: 'utf8', timeout: 60000 }
      );
      debugInfo.push(`npm install 完成: ${npmInstallOutput.substring(0, 100)}...`);
    } catch (error) {
      debugInfo.push(`npm install 失敗或跳過: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // 繼續執行，可能依賴已經安裝過了
    }

    // 檢查是否已有開發服務器在運行
    try {
      const runningProcesses = execSync(
        `docker exec ${containerId} pgrep -f "npm run dev" || echo "none"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      if (runningProcesses !== 'none') {
        debugInfo.push(`發現已運行的開發服務器進程: ${runningProcesses}`);
        return NextResponse.json({
          success: true,
          status: 'running',
          pid: runningProcesses,
          port: 3000,
          projectPath: targetPath,
          logs: debugInfo.concat([`開發服務器已在運行，PID: ${runningProcesses}`]),
          lastChecked: new Date().toISOString()
        });
      }
    } catch (error) {
      debugInfo.push(`檢查運行中進程失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 啟動開發服務器（後台運行）
    debugInfo.push('準備啟動開發服務器...');
    const startCommand = `cd ${targetPath} && nohup npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/dev.log 2>&1 & echo $!`;
    
    const pid = execSync(
      `docker exec ${containerId} bash -c "${startCommand}"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    debugInfo.push(`開發服務器啟動命令執行完成，PID: ${pid}`);

    // 等待服務器啟動
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 檢查服務器是否真的啟動了
    try {
      const checkProcess = execSync(
        `docker exec ${containerId} ps aux | grep "${pid}" | grep -v grep || echo "not_found"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      
      debugInfo.push(`啟動後進程檢查: ${checkProcess !== 'not_found' ? '進程存在' : '進程不存在'}`);
    } catch (error) {
      debugInfo.push(`啟動後進程檢查失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      status: 'starting',
      pid,
      port: 3000,
      projectPath: targetPath,
      logs: debugInfo.concat([`開發服務器已在 ${targetPath} 啟動`, `PID: ${pid}`]),
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