// Docker 容器內部操作工具
// 這個模組確保所有 AI 操作都在 Docker 容器內部執行，不會影響宿主機專案

export interface DockerToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  containerOutput?: string; // Docker 容器內的執行輸出
}

export interface DockerContext {
  containerId: string;
  containerName: string;
  workingDirectory: string; // 容器內的工作目錄，如 /app
  status: 'running' | 'stopped' | 'error';
}

// Docker 容器內的開發伺服器管理
export class DockerDevServerTool {
  private static readonly MAX_RESTART_COUNT = 5;
  private static readonly RESTART_COOLDOWN_MS = 10000;
  private static lastRestartTime = 0;
  private static restartCount = 0;

  constructor(private dockerContext: DockerContext) {}

  /**
   * 在Docker容器內啟動開發伺服器
   */
  async startDevServer(): Promise<DockerToolResponse> {
    try {
      // 確保容器正在運行
      await this.ensureContainerRunning();

      // 在容器內執行 npm run dev
      const result = await this.executeInContainer([
        'bash', '-c', 'cd /app && nohup npm run dev > /app/logs/dev.log 2>&1 & echo $!'
      ]);

      if (result.success) {
        DockerDevServerTool.restartCount = 0;
      }

      return {
        success: result.success,
        message: result.success ? '開發伺服器在Docker容器內啟動成功' : '啟動失敗',
        containerOutput: result.containerOutput,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器內啟動失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內重啟開發伺服器
   */
  async restartDevServer(reason?: string): Promise<DockerToolResponse> {
    try {
      const now = Date.now();
      
      // 防爆閥檢查
      if (now - DockerDevServerTool.lastRestartTime < DockerDevServerTool.RESTART_COOLDOWN_MS) {
        return {
          success: false,
          error: `重啟頻率過高，請等待 ${Math.ceil((DockerDevServerTool.RESTART_COOLDOWN_MS - (now - DockerDevServerTool.lastRestartTime)) / 1000)} 秒`
        };
      }

      if (DockerDevServerTool.restartCount >= DockerDevServerTool.MAX_RESTART_COUNT) {
        return {
          success: false,
          error: `已達最大重啟次數限制 (${DockerDevServerTool.MAX_RESTART_COUNT})`
        };
      }

      DockerDevServerTool.lastRestartTime = now;
      DockerDevServerTool.restartCount++;

      // 在容器內先停止再啟動
      const stopResult = await this.executeInContainer([
        'bash', '-c', 'cd /app && pkill -f "npm run dev" || true'
      ]);

      if (!stopResult.success) {
        return stopResult;
      }

      // 等待進程完全停止
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 重新啟動
      const startResult = await this.startDevServer();

      return {
        success: startResult.success,
        message: startResult.success ? 
          `Docker容器內重啟成功 (第 ${DockerDevServerTool.restartCount} 次)${reason ? ` - 原因: ${reason}` : ''}` : 
          '重啟失敗',
        containerOutput: `${stopResult.containerOutput}\n${startResult.containerOutput}`,
        error: startResult.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器內重啟失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 檢查Docker容器內開發伺服器狀態
   */
  async checkDevServerStatus(): Promise<DockerToolResponse<{isRunning: boolean, pid?: string, port?: string}>> {
    try {
      const result = await this.executeInContainer([
        'bash', '-c', 'cd /app && pgrep -f "npm run dev" && netstat -tlnp | grep :3000 || echo "not_running"'
      ]);

      const isRunning = result.containerOutput && !result.containerOutput.includes('not_running');
      const pidMatch = result.containerOutput?.match(/(\d+)/);
      const pid = pidMatch ? pidMatch[1] : undefined;

      return {
        success: true,
        data: {
          isRunning: !!isRunning,
          pid,
          port: isRunning ? '3000' : undefined
        },
        message: `容器內開發伺服器狀態: ${isRunning ? '運行中' : '已停止'}`,
        containerOutput: result.containerOutput
      };
    } catch (error) {
      return {
        success: false,
        error: `檢查Docker容器內狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內終止開發伺服器
   */
  async killDevServer(): Promise<DockerToolResponse> {
    try {
      const result = await this.executeInContainer([
        'bash', '-c', 'cd /app && pkill -f "npm run dev" -SIGTERM && sleep 2 && pkill -f "npm run dev" -SIGKILL || true'
      ]);

      if (result.success) {
        DockerDevServerTool.restartCount = 0;
      }

      return {
        success: true,
        message: 'Docker容器內開發伺服器已終止',
        containerOutput: result.containerOutput
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器內終止失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      // 使用 docker exec 在容器內執行命令
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exec',
          containerId: this.dockerContext.containerId,
          command,
          workingDirectory: this.dockerContext.workingDirectory
        })
      });

      const result = await response.json();
      
      return {
        success: result.success,
        containerOutput: result.stdout || result.stderr,
        error: result.success ? undefined : result.error || result.stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 確保Docker容器正在運行
   */
  private async ensureContainerRunning(): Promise<void> {
    const response = await fetch('/api/docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        containerId: this.dockerContext.containerId
      })
    });

    const result = await response.json();
    
    if (!result.success || result.status !== 'running') {
      throw new Error(`Docker容器未運行: ${result.error || '狀態異常'}`);
    }
  }
}

// Docker 容器內的日誌監控工具
export class DockerLogMonitorTool {
  private static readonly MAX_LOG_LINES = 10000;
  private static readonly DEFAULT_LOG_LINES = 3000;

  constructor(private dockerContext: DockerContext) {}

  /**
   * 讀取Docker容器內的日誌
   */
  async readLogTail(options: {
    lines?: number;
    logFile?: string;
    keyword?: string;
  } = {}): Promise<DockerToolResponse<string[]>> {
    try {
      const {
        lines = DockerLogMonitorTool.DEFAULT_LOG_LINES,
        logFile = 'dev.log',
        keyword
      } = options;

      const safeLines = Math.min(lines, DockerLogMonitorTool.MAX_LOG_LINES);
      
      let command = `cd /app/logs && tail -n ${safeLines} ${logFile}`;
      if (keyword) {
        command += ` | grep "${keyword}"`;
      }

      const result = await this.executeInContainer(['bash', '-c', command]);
      
      const logLines = result.containerOutput ? 
        result.containerOutput.split('\n').filter(line => line.trim()) : 
        [];

      return {
        success: result.success,
        data: logLines,
        message: `從Docker容器讀取 ${logLines.length} 行日誌`,
        containerOutput: result.containerOutput,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `讀取Docker容器日誌失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 搜尋Docker容器內的錯誤日誌
   */
  async searchErrorLogs(keyword: string = 'Error', lines: number = 1000): Promise<DockerToolResponse<string[]>> {
    try {
      const command = `cd /app/logs && tail -n ${lines} dev.log | grep -i "${keyword}" | tail -100`;
      
      const result = await this.executeInContainer(['bash', '-c', command]);
      
      const errorLines = result.containerOutput ? 
        result.containerOutput.split('\n').filter(line => line.trim()) : 
        [];

      return {
        success: true,
        data: errorLines,
        message: `從Docker容器找到 ${errorLines.length} 條錯誤日誌`,
        containerOutput: result.containerOutput
      };
    } catch (error) {
      return {
        success: false,
        error: `搜尋Docker容器錯誤日誌失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取Docker容器內的日誌檔案清單
   */
  async getLogFiles(): Promise<DockerToolResponse<string[]>> {
    try {
      const result = await this.executeInContainer([
        'bash', '-c', 'cd /app/logs && ls -la *.log 2>/dev/null || echo "no logs found"'
      ]);

      const files = result.containerOutput ? 
        result.containerOutput.split('\n')
          .filter(line => line.includes('.log'))
          .map(line => line.split(' ').pop())
          .filter(Boolean) as string[] : 
        [];

      return {
        success: true,
        data: files,
        message: `Docker容器內找到 ${files.length} 個日誌檔案`,
        containerOutput: result.containerOutput
      };
    } catch (error) {
      return {
        success: false,
        error: `獲取Docker容器日誌檔案清單失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exec',
          containerId: this.dockerContext.containerId,
          command,
          workingDirectory: this.dockerContext.workingDirectory
        })
      });

      const result = await response.json();
      
      return {
        success: result.success,
        containerOutput: result.stdout || result.stderr,
        error: result.success ? undefined : result.error || result.stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Docker 容器健康檢查工具
export class DockerHealthCheckTool {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;

  constructor(private dockerContext: DockerContext) {}

  /**
   * 檢查Docker容器內服務的健康狀態
   */
  async checkHealth(port: number = 3000): Promise<DockerToolResponse<{
    status: 'up' | 'down';
    responseTimeMs: number;
    containerHealth: 'healthy' | 'unhealthy' | 'starting';
  }>> {
    try {
      const startTime = Date.now();

      // 檢查容器本身的健康狀態
      const containerHealthResult = await this.checkContainerHealth();
      
      // 檢查容器內服務是否在監聽指定端口
      const serviceResult = await this.executeInContainer([
        'bash', '-c', `curl -s http://localhost:${port} -m 5 || echo "service_down"`
      ]);

      const responseTime = Date.now() - startTime;
      const isServiceUp = serviceResult.containerOutput && !serviceResult.containerOutput.includes('service_down');

      return {
        success: true,
        data: {
          status: isServiceUp ? 'up' : 'down',
          responseTimeMs: responseTime,
          containerHealth: containerHealthResult.success ? 'healthy' : 'unhealthy'
        },
        message: `Docker容器服務狀態: ${isServiceUp ? '正常' : '異常'} (${responseTime}ms)`,
        containerOutput: serviceResult.containerOutput
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器健康檢查失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 檢查Docker容器本身的健康狀態
   */
  async checkContainerHealth(): Promise<DockerToolResponse> {
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'health',
          containerId: this.dockerContext.containerId
        })
      });

      const result = await response.json();
      
      return {
        success: result.success && result.health === 'healthy',
        message: `Docker容器健康狀態: ${result.health || 'unknown'}`,
        containerOutput: result.output
      };
    } catch (error) {
      return {
        success: false,
        error: `檢查Docker容器健康狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exec',
          containerId: this.dockerContext.containerId,
          command,
          workingDirectory: this.dockerContext.workingDirectory
        })
      });

      const result = await response.json();
      
      return {
        success: result.success,
        containerOutput: result.stdout || result.stderr,
        error: result.success ? undefined : result.error || result.stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Docker 容器檔案系統工具
export class DockerFileSystemTool {
  constructor(private dockerContext: DockerContext) {}

  /**
   * 讀取Docker容器內的檔案
   */
  async readFile(filePath: string): Promise<DockerToolResponse<string>> {
    try {
      const result = await this.executeInContainer([
        'cat', `${this.dockerContext.workingDirectory}/${filePath}`
      ]);

      return {
        success: result.success,
        data: result.containerOutput || '',
        message: result.success ? `成功讀取容器內檔案: ${filePath}` : '讀取失敗',
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `讀取Docker容器內檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 寫入檔案到Docker容器內
   */
  async writeFile(filePath: string, content: string): Promise<DockerToolResponse> {
    try {
      // 使用 tee 命令將內容寫入檔案
      const result = await this.executeInContainer([
        'bash', '-c', `echo '${content.replace(/'/g, "'\\''")}' | tee ${this.dockerContext.workingDirectory}/${filePath} > /dev/null`
      ]);

      return {
        success: result.success,
        message: result.success ? `成功寫入容器內檔案: ${filePath}` : '寫入失敗',
        containerOutput: result.containerOutput,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `寫入Docker容器內檔案失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exec',
          containerId: this.dockerContext.containerId,
          command,
          workingDirectory: this.dockerContext.workingDirectory
        })
      });

      const result = await response.json();
      
      return {
        success: result.success,
        containerOutput: result.stdout || result.stderr,
        error: result.success ? undefined : result.error || result.stderr
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker執行失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Docker 工具整合類
export class DockerToolkit {
  public devServer: DockerDevServerTool;
  public logMonitor: DockerLogMonitorTool;
  public healthCheck: DockerHealthCheckTool;
  public fileSystem: DockerFileSystemTool;

  constructor(dockerContext: DockerContext) {
    this.devServer = new DockerDevServerTool(dockerContext);
    this.logMonitor = new DockerLogMonitorTool(dockerContext);
    this.healthCheck = new DockerHealthCheckTool(dockerContext);
    this.fileSystem = new DockerFileSystemTool(dockerContext);
  }

  /**
   * 智能監控與自動修復 (Docker容器內)
   */
  async smartMonitorAndRecover(): Promise<DockerToolResponse<string[]>> {
    try {
      const results: string[] = [];

      results.push('🔍 開始在Docker容器內進行智能監控...');

      // 1. 檢查容器健康狀態
      const healthCheck = await this.healthCheck.checkHealth();
      results.push(`📊 容器健康檢查: ${healthCheck.data?.status || 'unknown'}`);

      // 2. 如果服務異常，分析日誌
      if (healthCheck.data?.status === 'down') {
        results.push('⚠️  偵測到容器內服務異常，開始分析日誌...');
        
        const errorLogs = await this.logMonitor.searchErrorLogs('Error', 500);
        if (errorLogs.success && errorLogs.data && errorLogs.data.length > 0) {
          results.push(`🔍 在容器內發現 ${errorLogs.data.length} 條錯誤日誌`);
          
          // 3. 嘗試在容器內自動重啟
          const restartResult = await this.devServer.restartDevServer('智能修復：偵測到容器內錯誤日誌');
          if (restartResult.success) {
            results.push('🔄 已在Docker容器內自動重啟開發伺服器');
            
            // 4. 等待後再次檢查
            await new Promise(resolve => setTimeout(resolve, 5000));
            const secondHealthCheck = await this.healthCheck.checkHealth();
            results.push(`✅ 容器內重啟後狀態: ${secondHealthCheck.data?.status || 'unknown'}`);
          } else {
            results.push(`❌ 容器內自動重啟失敗: ${restartResult.error}`);
          }
        } else {
          results.push('ℹ️  容器內未發現明顯錯誤日誌，可能需要手動檢查');
        }
      } else {
        results.push('✅ Docker容器內服務運行正常');
      }

      return {
        success: true,
        data: results,
        message: 'Docker容器內智能監控完成'
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器內智能監控失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 獲取Docker容器內完整狀態報告
   */
  async getFullStatusReport(): Promise<DockerToolResponse<{
    containerHealth: DockerToolResponse;
    devServerStatus: DockerToolResponse<{isRunning: boolean, pid?: string, port?: string}>;
    serviceHealth: DockerToolResponse<{status: 'up' | 'down'; responseTimeMs: number; containerHealth: 'healthy' | 'unhealthy' | 'starting'}>;
    recentLogs: string[];
  }>> {
    try {
      // 並行執行多個檢查
      const [containerHealth, devServerStatus, serviceHealth, recentLogs] = await Promise.all([
        this.healthCheck.checkContainerHealth(),
        this.devServer.checkDevServerStatus(),
        this.healthCheck.checkHealth(),
        this.logMonitor.readLogTail({ lines: 100 })
      ]);

      return {
        success: true,
        data: {
          containerHealth: containerHealth,
          devServerStatus: devServerStatus.data,
          serviceHealth: serviceHealth.data,
          recentLogs: recentLogs.data || []
        },
        message: 'Docker容器內狀態報告已生成'
      };
    } catch (error) {
      return {
        success: false,
        error: `生成Docker容器狀態報告失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * 創建Docker工具實例的工廠函數
 */
export function createDockerToolkit(dockerContext: DockerContext): DockerToolkit {
  return new DockerToolkit(dockerContext);
}

// Docker工具使用指南
export const DOCKER_TOOL_USAGE_GUIDE = `
# 🐳 Docker AI 工具使用指南

## 🎯 核心原則
**所有操作都在Docker容器內部執行，不會影響宿主機專案**

## 🚀 基本工作流程

1. **建立Docker工具實例**
   \`\`\`typescript
   const dockerContext: DockerContext = {
     containerId: 'your-container-id',
     containerName: 'ai-dev-container',
     workingDirectory: '/app',
     status: 'running'
   };
   
   const dockerToolkit = createDockerToolkit(dockerContext);
   \`\`\`

2. **容器內開發伺服器管理**
   \`\`\`typescript
   // 在容器內啟動開發伺服器
   await dockerToolkit.devServer.startDevServer();
   
   // 檢查容器內伺服器狀態
   const status = await dockerToolkit.devServer.checkDevServerStatus();
   
   // 在容器內重啟 (含安全防護)
   await dockerToolkit.devServer.restartDevServer('修復錯誤');
   \`\`\`

3. **容器內日誌監控**
   \`\`\`typescript
   // 讀取容器內日誌
   const logs = await dockerToolkit.logMonitor.readLogTail({ lines: 1000 });
   
   // 搜尋容器內錯誤日誌
   const errors = await dockerToolkit.logMonitor.searchErrorLogs('Error');
   \`\`\`

4. **容器內健康檢查**
   \`\`\`typescript
   // 檢查容器內服務健康狀態
   const health = await dockerToolkit.healthCheck.checkHealth(3000);
   \`\`\`

5. **容器內檔案操作**
   \`\`\`typescript
   // 讀取容器內檔案
   const content = await dockerToolkit.fileSystem.readFile('src/app/page.tsx');
   
   // 寫入容器內檔案
   await dockerToolkit.fileSystem.writeFile('src/components/Button.tsx', componentCode);
   \`\`\`

6. **智能監控與修復**
   \`\`\`typescript
   // 容器內自動監控與修復
   const recovery = await dockerToolkit.smartMonitorAndRecover();
   
   // 獲取容器內完整狀態報告
   const report = await dockerToolkit.getFullStatusReport();
   \`\`\`

## 🔒 隔離保證

- ✅ 所有命令通過 \`docker exec\` 在容器內執行
- ✅ 檔案操作限制在容器的 \`/app\` 目錄內
- ✅ 日誌存儲在容器的 \`/app/logs\` 目錄
- ✅ 開發伺服器運行在容器內的 3000 端口
- ✅ 不會影響宿主機的任何檔案或服務

## 🎯 與原有工具的差異

| 原有工具 (錯誤) | Docker工具 (正確) |
|---|---|
| 操作宿主機專案 | 操作容器內專案 |
| 影響 AI Code IDE | 完全隔離執行 |
| \`/api/project\` 接口 | \`/api/docker\` 接口 |
| 宿主機檔案系統 | 容器內檔案系統 |

## 🛡️ 安全機制 (保持不變)

- 重啟頻率限制：10秒內不可重啟超過一次
- 重啟次數上限：最多連續重啟5次
- 日誌讀取限制：單次最多讀取10,000行
- 健康檢查逾時：預設5秒逾時保護
`; 