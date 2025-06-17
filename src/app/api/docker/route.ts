// Docker API 接口
// 處理所有 Docker 容器內的操作請求
import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { createDockerAIEditorManager, createDefaultDockerContext } from '@/lib/docker';

const execAsync = promisify(exec);

export interface DockerApiResponse {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  status?: string;
  health?: string;
  output?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, containerId, parameters = {}, command, workingDirectory } = body;

    if (!containerId) {
      return NextResponse.json(
        { success: false, error: 'containerId is required' },
        { status: 400 }
      );
    }

    // 處理內部 Docker 操作 (exec, health, status 等)
    switch (action) {
      case 'exec':
        return await handleExecCommand(containerId, command, workingDirectory);
      
      case 'health':
        return await handleHealthCheck(containerId);
      
      case 'status':
        return await handleStatusCheck(containerId);
      
      case 'logs':
        return await handleGetLogs(containerId);
      
      case 'start':
        return await handleStartContainer(containerId);
      
      case 'stop':
        return await handleStopContainer(containerId);
      
      case 'restart':
        return await handleRestartContainer(containerId);
      
      default:
        // 處理 Docker AI 工具調用
        const dockerContext = createDefaultDockerContext(containerId);
        
        const dockerAI = createDockerAIEditorManager({
          dockerContext,
          enableUserConfirmation: false,
          enableActionLogging: true,
        });

        // 執行Docker AI工具
        const result = await dockerAI.executeDockerAITool(action, parameters);

        return NextResponse.json({
          success: result.success,
          data: result.data,
          message: result.message,
          error: result.error
        });
    }

  } catch (error) {
    console.error('Docker API error:', error);
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
  const containerId = searchParams.get('containerId');
  const action = searchParams.get('action');

  if (!containerId) {
    return NextResponse.json(
      { success: false, error: 'containerId is required' },
      { status: 400 }
    );
  }

  try {
    // 創建Docker上下文
    const dockerContext = createDefaultDockerContext(containerId);
    
    // 創建AI編輯器管理器
    const dockerAI = createDockerAIEditorManager({
      dockerContext,
      enableUserConfirmation: false,
      enableActionLogging: true,
    });

    switch (action) {
      case 'status':
        // 獲取開發伺服器狀態
        const statusResult = await dockerAI.executeDockerAITool('docker_check_dev_server_status', {});
        return NextResponse.json({
          success: statusResult.success,
          data: statusResult.data,
          message: statusResult.message,
          error: statusResult.error
        });

      case 'full_status':
        // 獲取完整狀態報告
        const fullStatusResult = await dockerAI.executeDockerAITool('docker_get_full_status_report', {});
        return NextResponse.json({
          success: fullStatusResult.success,
          data: fullStatusResult.data,
          message: fullStatusResult.message,
          error: fullStatusResult.error
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Docker GET API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * 在Docker容器內執行命令
 */
async function handleExecCommand(
  containerRef: string, 
  command: string[], 
  workingDirectory?: string
) {
  try {
    // 構建docker exec命令
    const dockerCmd = [
      'docker', 'exec',
      workingDirectory ? '-w' : '', workingDirectory || '',
      containerRef,
      ...command
    ].filter(Boolean);

    console.log('執行Docker命令:', dockerCmd.join(' '));

    const { stdout, stderr } = await execAsync(dockerCmd.join(' '));

    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error: any) {
    console.error('Docker exec error:', error);
    return NextResponse.json({
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message
    });
  }
}

/**
 * 檢查Docker容器狀態
 */
async function handleStatusCheck(containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker inspect ${containerRef} --format='{{.State.Status}}'`);
    const status = stdout.trim();

    return NextResponse.json({
      success: true,
      status,
      output: `Container ${containerRef} status: ${status}`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to check container status: ${error.message}`,
      status: 'unknown'
    });
  }
}

/**
 * 檢查Docker容器健康狀態
 */
async function handleHealthCheck(containerRef: string) {
  try {
    // 檢查容器是否在運行
    const { stdout: statusOutput } = await execAsync(`docker inspect ${containerRef} --format='{{.State.Status}}'`);
    const status = statusOutput.trim();

    if (status !== 'running') {
      return NextResponse.json({
        success: false,
        health: 'unhealthy',
        output: `Container is ${status}, not running`
      });
    }

    // 檢查容器的健康檢查狀態（如果有配置）
    try {
      const { stdout: healthOutput } = await execAsync(`docker inspect ${containerRef} --format='{{.State.Health.Status}}'`);
      const healthStatus = healthOutput.trim();
      
      if (healthStatus && healthStatus !== '<no value>') {
        return NextResponse.json({
          success: healthStatus === 'healthy',
          health: healthStatus,
          output: `Container health: ${healthStatus}`
        });
      }
    } catch (healthError) {
      // 如果沒有配置健康檢查，則認為容器健康（因為它在運行）
    }

    // 如果沒有健康檢查配置，檢查基本連接性
    try {
      await execAsync(`docker exec ${containerRef} echo "health check"`);
      return NextResponse.json({
        success: true,
        health: 'healthy',
        output: 'Container is running and responsive'
      });
    } catch (execError) {
      return NextResponse.json({
        success: false,
        health: 'unhealthy',
        output: 'Container is running but not responsive'
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      health: 'unknown',
      error: `Health check failed: ${error.message}`
    });
  }
}

/**
 * 獲取Docker容器日誌
 */
async function handleGetLogs(containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker logs --tail 1000 ${containerRef}`);
    
    return NextResponse.json({
      success: true,
      stdout: stdout,
      output: 'Container logs retrieved successfully'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to get container logs: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 啟動Docker容器
 */
async function handleStartContainer(containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker start ${containerRef}`);
    
    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} started successfully`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to start container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 停止Docker容器
 */
async function handleStopContainer(containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker stop ${containerRef}`);
    
    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} stopped successfully`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to stop container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 重啟Docker容器
 */
async function handleRestartContainer(containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker restart ${containerRef}`);
    
    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} restarted successfully`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to restart container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
} 