import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export interface ContainerInfo {
  name: string;
  id: string;
  image: string;
  status: string;
  ports: Array<{
    containerPort: number;
    hostPort: number;
    protocol: string;
  }>;
  created: string;
  labels: Record<string, string>;
}

/**
 * 獲取所有運行中的 Docker 容器資訊
 */
export async function GET() {
  try {
    // 獲取所有運行中的容器
    const containersOutput = execSync(
      'docker ps --format "{{.Names}}|{{.ID}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}" --no-trunc',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    if (!containersOutput) {
      return NextResponse.json({
        success: true,
        containers: [],
        message: '目前沒有運行中的容器'
      });
    }

    const containers: ContainerInfo[] = containersOutput
      .split('\n')
      .map(line => {
        const [name, id, image, status, ports, created] = line.split('|');
        
        // 解析端口映射
        const portMappings: Array<{containerPort: number; hostPort: number; protocol: string}> = [];
        if (ports && ports.trim()) {
          const portMatches = ports.match(/0\.0\.0\.0:(\d+)->(\d+)\/(tcp|udp)/g);
          if (portMatches) {
            portMatches.forEach(portMatch => {
              const match = portMatch.match(/0\.0\.0\.0:(\d+)->(\d+)\/(tcp|udp)/);
              if (match) {
                portMappings.push({
                  hostPort: parseInt(match[1]),
                  containerPort: parseInt(match[2]),
                  protocol: match[3]
                });
              }
            });
          }
        }

        // 獲取容器標籤
        let labels: Record<string, string> = {};
        try {
          const labelsOutput = execSync(
            `docker inspect ${id} --format="{{range $key, $value := .Config.Labels}}{{$key}}={{$value}}\n{{end}}"`,
            { encoding: 'utf8', timeout: 5000 }
          ).trim();
          
          if (labelsOutput) {
            labelsOutput.split('\n').forEach(line => {
              const [key, value] = line.split('=');
              if (key && value) {
                labels[key] = value;
              }
            });
          }
        } catch (error) {
          // 忽略標籤獲取錯誤
        }

        return {
          name,
          id: id.substring(0, 12), // 短ID
          image,
          status,
          ports: portMappings,
          created,
          labels
        };
      });

    // 根據名稱過濾出相關的容器（包含 ai-web-ide 的）
    const relevantContainers = containers.filter(container => 
      container.name.includes('ai-web-ide') || 
      container.image.includes('ai') ||
      container.ports.some(p => p.containerPort === 3000 || p.containerPort === 8000)
    );

    return NextResponse.json({
      success: true,
      containers: relevantContainers,
      total: containers.length,
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('獲取容器列表失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        containers: [],
        lastChecked: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 