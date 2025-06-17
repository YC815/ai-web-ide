import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export interface DockerStatusResponse {
  success: boolean;
  containerStatus?: 'running' | 'stopped' | 'error';
  serviceUrl?: string;
  serviceStatus?: 'accessible' | 'inaccessible' | 'unknown';
  portMappings?: Array<{
    containerPort: number;
    hostPort: number;
    protocol: string;
  }>;
  error?: string;
  lastChecked: string;
}

/**
 * 動態檢測 Docker 容器內服務的連線狀態
 * 不依賴 AI，直接檢測端口和服務可用性
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const containerId = searchParams.get('containerId') || 'ai-web-ide-frontend';
  const targetPort = parseInt(searchParams.get('port') || '3000');

  try {
    // 1. 檢查容器狀態
    let containerStatus: 'running' | 'stopped' | 'error' = 'error';
    let portMappings: Array<{containerPort: number; hostPort: number; protocol: string}> = [];
    
    try {
      const statusOutput = execSync(`docker inspect ${containerId} --format="{{.State.Status}}"`, { 
        encoding: 'utf8', 
        timeout: 5000 
      }).trim();
      
      containerStatus = statusOutput === 'running' ? 'running' : 'stopped';
      
      // 2. 獲取端口映射資訊
      if (containerStatus === 'running') {
        const portOutput = execSync(`docker port ${containerId}`, { 
          encoding: 'utf8', 
          timeout: 5000 
        }).trim();
        
        portMappings = portOutput.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const match = line.match(/(\d+)\/(tcp|udp) -> .*:(\d+)/);
            if (match) {
              return {
                containerPort: parseInt(match[1]),
                hostPort: parseInt(match[3]),
                protocol: match[2]
              };
            }
            return null;
          })
          .filter(Boolean) as Array<{containerPort: number; hostPort: number; protocol: string}>;
      }
    } catch (error) {
      containerStatus = 'error';
    }

    // 3. 檢測服務連線狀態
    let serviceStatus: 'accessible' | 'inaccessible' | 'unknown' = 'unknown';
    let serviceUrl: string | undefined;

    if (containerStatus === 'running') {
      // 找到目標端口的映射
      const targetMapping = portMappings.find(mapping => mapping.containerPort === targetPort);
      
      if (targetMapping) {
        serviceUrl = `http://localhost:${targetMapping.hostPort}`;
        
        // 嘗試連接服務
        try {
          const response = await fetch(serviceUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3秒超時
          });
          
          serviceStatus = response.ok ? 'accessible' : 'inaccessible';
        } catch (error) {
          serviceStatus = 'inaccessible';
        }
      } else {
        serviceStatus = 'inaccessible';
      }
    }

    const result: DockerStatusResponse = {
      success: true,
      containerStatus,
      serviceUrl,
      serviceStatus,
      portMappings,
      lastChecked: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    const errorResult: DockerStatusResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString()
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}

/**
 * 檢測多個預設容器的狀態
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { containers = [
      { name: 'ai-web-ide-frontend', port: 3000 },
      { name: 'ai-web-ide-backend', port: 8000 }
    ] } = body;

    const results = await Promise.all(
      containers.map(async (container: { name: string; port: number }) => {
        const response = await fetch(
          `${request.nextUrl.origin}/api/docker-status?containerId=${container.name}&port=${container.port}`,
          { method: 'GET' }
        );
        const data = await response.json();
        return {
          containerName: container.name,
          targetPort: container.port,
          ...data
        };
      })
    );

    return NextResponse.json({
      success: true,
      containers: results,
      lastChecked: new Date().toISOString()
    });

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