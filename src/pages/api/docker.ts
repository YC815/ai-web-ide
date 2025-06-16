// Docker API 接口
// 處理所有 Docker 容器內的操作請求
import { NextApiRequest, NextApiResponse } from 'next';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<DockerApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action, containerId, containerName, command, workingDirectory } = req.body;

  if (!containerId && !containerName) {
    return res.status(400).json({ success: false, error: 'Container ID or name is required' });
  }

  try {
    const containerRef = containerId || containerName;

    switch (action) {
      case 'exec':
        return await handleExecCommand(res, containerRef, command, workingDirectory);
      
      case 'status':
        return await handleStatusCheck(res, containerRef);
      
      case 'health':
        return await handleHealthCheck(res, containerRef);
      
      case 'logs':
        return await handleGetLogs(res, containerRef);
      
      case 'start':
        return await handleStartContainer(res, containerRef);
      
      case 'stop':
        return await handleStopContainer(res, containerRef);
      
      case 'restart':
        return await handleRestartContainer(res, containerRef);
      
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Docker API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * 在Docker容器內執行命令
 */
async function handleExecCommand(
  res: NextApiResponse<DockerApiResponse>, 
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

    return res.status(200).json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error: any) {
    console.error('Docker exec error:', error);
    return res.status(200).json({
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
async function handleStatusCheck(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker inspect ${containerRef} --format='{{.State.Status}}'`);
    const status = stdout.trim();

    return res.status(200).json({
      success: true,
      status,
      output: `Container ${containerRef} status: ${status}`
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: `Failed to check container status: ${error.message}`,
      status: 'unknown'
    });
  }
}

/**
 * 檢查Docker容器健康狀態
 */
async function handleHealthCheck(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    // 檢查容器是否在運行
    const { stdout: statusOutput } = await execAsync(`docker inspect ${containerRef} --format='{{.State.Status}}'`);
    const status = statusOutput.trim();

    if (status !== 'running') {
      return res.status(200).json({
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
        return res.status(200).json({
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
      return res.status(200).json({
        success: true,
        health: 'healthy',
        output: 'Container is running and responsive'
      });
    } catch (execError) {
      return res.status(200).json({
        success: false,
        health: 'unhealthy',
        output: 'Container is running but not responsive'
      });
    }
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      health: 'unknown',
      error: `Health check failed: ${error.message}`
    });
  }
}

/**
 * 獲取Docker容器日誌
 */
async function handleGetLogs(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker logs --tail 1000 ${containerRef}`);
    
    return res.status(200).json({
      success: true,
      stdout: stdout,
      output: 'Container logs retrieved successfully'
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: `Failed to get container logs: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 啟動Docker容器
 */
async function handleStartContainer(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker start ${containerRef}`);
    
    return res.status(200).json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} started successfully`
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: `Failed to start container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 停止Docker容器
 */
async function handleStopContainer(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker stop ${containerRef}`);
    
    return res.status(200).json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} stopped successfully`
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: `Failed to stop container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
}

/**
 * 重啟Docker容器
 */
async function handleRestartContainer(res: NextApiResponse<DockerApiResponse>, containerRef: string) {
  try {
    const { stdout } = await execAsync(`docker restart ${containerRef}`);
    
    return res.status(200).json({
      success: true,
      stdout: stdout.trim(),
      output: `Container ${containerRef} restarted successfully`
    });
  } catch (error: any) {
    return res.status(200).json({
      success: false,
      error: `Failed to restart container: ${error.message}`,
      stderr: error.stderr || ''
    });
  }
} 