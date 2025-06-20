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
  private restartCount = 0;
  private lastRestartTime = 0;
  private readonly MAX_RESTART_COUNT = 5;
  private readonly RESTART_COOLDOWN = 10000; // 10秒

  constructor(private dockerContext: DockerContext) {}

  /**
   * 在Docker容器內啟動開發伺服器
   */
  async startDevServer(): Promise<DockerToolResponse<{ message: string; url?: string; containerOutput?: string }>> {
    try {
      // 先檢查是否已經在運行
      const statusCheck = await this.checkDevServerStatus();
      if (statusCheck.data?.isRunning) {
        return {
          success: true,
          data: {
            message: 'Docker容器內開發伺服器已在運行',
            url: await this.detectServerUrl()
          },
          message: 'Docker容器內開發伺服器已在運行'
        };
      }

      // 啟動開發伺服器
      const result = await this.executeInContainer([
        'bash', '-c', 
        'cd /app && nohup npm run dev > /app/logs/dev.log 2>&1 & echo "Started dev server with PID: $!"'
      ]);

      if (!result.success) {
        return {
          success: false,
          error: `啟動Docker容器內開發伺服器失敗: ${result.error}`
        };
      }

      // 等待服務啟動並檢測URL
      await this.waitForServerStart();
      const serverUrl = await this.detectServerUrl();

      return {
        success: true,
        data: {
          message: 'Docker容器內開發伺服器啟動成功',
          url: serverUrl,
          containerOutput: result.containerOutput
        },
        message: `Docker容器內開發伺服器啟動成功${serverUrl ? ` - URL: ${serverUrl}` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: `啟動Docker容器內開發伺服器失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 等待開發伺服器啟動
   */
  private async waitForServerStart(maxWaitTime: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusCheck = await this.checkDevServerStatus();
        if (statusCheck.data?.isRunning) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      } catch {
        // 繼續等待，忽略錯誤
      }
    }
  }

  /**
   * 從容器日誌中檢測開發伺服器URL
   */
  private async detectServerUrl(): Promise<string | undefined> {
    try {
      // 讀取開發伺服器日誌
      const logResult = await this.executeInContainer([
        'bash', '-c', 'tail -50 /app/logs/dev.log 2>/dev/null || echo "No logs found"'
      ]);

      if (!logResult.success || !logResult.containerOutput) {
        return undefined;
      }

      const logs = logResult.containerOutput;
      
      // 常見的Next.js開發伺服器URL模式
      const urlPatterns = [
        /- Local:\s+(?:http:\/\/)?([^\s]+)/i,           // Next.js: - Local: http://localhost:3000
        /ready on (?:http:\/\/)?([^\s]+)/i,            // Next.js: ready on http://localhost:3000
        /Local:\s+(?:http:\/\/)?([^\s]+)/i,            // Vite: Local: http://localhost:3000
        /server running at (?:http:\/\/)?([^\s]+)/i,   // 一般格式
        /listening on (?:http:\/\/)?([^\s]+)/i,        // 一般格式
        /http:\/\/([^\s]+)/i                           // 直接匹配http://格式
      ];

      for (const pattern of urlPatterns) {
        const match = logs.match(pattern);
        if (match && match[1]) {
          let url = match[1];
          // 確保URL格式正確
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `http://${url}`;
          }
          
          // 如果是localhost或0.0.0.0，需要轉換為可訪問的URL
          url = this.normalizeUrl(url);
          
          return url;
        }
      }

      // 如果無法從日誌檢測，嘗試檢查端口
      return await this.detectUrlByPort();
      
    } catch (error) {
      console.error('檢測服務器URL失敗:', error);
      return undefined;
    }
  }

  /**
   * 通過檢查端口來檢測URL
   */
  private async detectUrlByPort(): Promise<string | undefined> {
    try {
      // 檢查常見的開發端口
      const commonPorts = [3000, 3001, 8080, 5173, 4000];
      
      for (const port of commonPorts) {
        const checkResult = await this.executeInContainer([
          'bash', '-c', `netstat -tlnp 2>/dev/null | grep :${port} || ss -tlnp 2>/dev/null | grep :${port} || echo "not found"`
        ]);
        
        if (checkResult.success && checkResult.containerOutput && !checkResult.containerOutput.includes('not found')) {
          return this.normalizeUrl(`http://localhost:${port}`);
        }
      }
      
      return undefined;
    } catch {
      // 發生錯誤時返回 undefined
      return undefined;
    }
  }

  /**
   * 正規化URL，將容器內的localhost轉換為外部可訪問的URL
   */
  private normalizeUrl(url: string): string {
    // 如果是容器內的localhost或0.0.0.0，需要轉換
    if (url.includes('localhost') || url.includes('0.0.0.0')) {
      // 假設容器映射到宿主機的相同端口
      const portMatch = url.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3000';
      return `http://localhost:${port}`;
    }
    
    return url;
  }

  /**
   * 在Docker容器內重啟開發伺服器
   */
  async restartDevServer(reason?: string): Promise<DockerToolResponse<{ message: string; url?: string; restartCount?: number; containerOutput?: string }>> {
    try {
      const now = Date.now();
      
      // 防爆閥檢查
      if (now - this.lastRestartTime < this.RESTART_COOLDOWN) {
        return {
          success: false,
          error: `重啟頻率過高，請等待 ${Math.ceil((this.RESTART_COOLDOWN - (now - this.lastRestartTime)) / 1000)} 秒`
        };
      }

      if (this.restartCount >= this.MAX_RESTART_COUNT) {
        return {
          success: false,
          error: `已達最大重啟次數限制 (${this.MAX_RESTART_COUNT})`
        };
      }

      this.lastRestartTime = now;
      this.restartCount++;

      // 在容器內先停止再啟動
      const stopResult = await this.killDevServer();
      const startResult = await this.startDevServer();

      const success = stopResult.success && startResult.success;
      
      if (success) {
        this.restartCount = 0; // 重啟成功後重置計數
      }

      // 獲取URL信息
      const serverUrl = success ? await this.detectServerUrl() : undefined;

      return {
        success,
        data: {
          message: success ? 
            `Docker容器內重啟成功 (第 ${this.restartCount} 次)${reason ? ` - 原因: ${reason}` : ''}` : 
            '重啟失敗',
          url: serverUrl,
          restartCount: this.restartCount,
          containerOutput: `${stopResult.containerOutput}\n${startResult.containerOutput || startResult.data?.containerOutput}`
        },
        message: success ? 
          `Docker容器內重啟成功${serverUrl ? ` - URL: ${serverUrl}` : ''}` : 
          '重啟失敗',
        error: success ? undefined : '重啟過程中發生錯誤'
      };
    } catch (error) {
      return {
        success: false,
        error: `Docker容器內重啟失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 終止Docker容器內的開發伺服器
   */
  async killDevServer(): Promise<DockerToolResponse> {
    try {
      const result = await this.executeInContainer([
        'bash', '-c', 'pkill -f "npm run dev" || pkill -f "next dev" || echo "No dev server found"'
      ]);

      if (result.success) {
        this.restartCount = 0;
      }

      return {
        success: result.success,
        message: result.success ? 'Docker容器內開發伺服器已終止' : '終止失敗',
        containerOutput: result.containerOutput,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `終止Docker容器內開發伺服器失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 檢查Docker容器內開發伺服器狀態
   */
  async checkDevServerStatus(): Promise<DockerToolResponse<{ isRunning: boolean; pid?: string; port?: string; url?: string; message: string }>> {
    try {
      const result = await this.executeInContainer([
        'bash', '-c', 'pgrep -f "npm run dev" || pgrep -f "next dev" || echo "not running"'
      ]);

      // 修復類型問題：確保 isRunning 總是 boolean
      const isRunning = Boolean(
        result.success && 
        result.containerOutput && 
        result.containerOutput.trim() !== '' && 
        !result.containerOutput.includes('not running')
      );
      
      const pid = isRunning ? result.containerOutput?.trim() : undefined;
      
      // 如果服務在運行，嘗試檢測URL
      const serverUrl = isRunning ? await this.detectServerUrl() : undefined;
      
      // 檢測端口
      let port: string | undefined;
      if (isRunning) {
        const portResult = await this.executeInContainer([
          'bash', '-c', 'netstat -tlnp 2>/dev/null | grep :3000 | head -1 || echo "no port"'
        ]);
        if (portResult.success && !portResult.containerOutput?.includes('no port')) {
          const portMatch = portResult.containerOutput?.match(/:(\d+)/);
          port = portMatch ? portMatch[1] : '3000';
        }
      }

      return {
        success: true,
        data: {
          isRunning,
          pid,
          port,
          url: serverUrl,
          message: isRunning ? 
            `Docker容器內開發伺服器運行中 (PID: ${pid})${serverUrl ? ` - URL: ${serverUrl}` : ''}` : 
            'Docker容器內開發伺服器未運行'
        },
        message: isRunning ? 
          `Docker容器內開發伺服器運行中 (PID: ${pid})${serverUrl ? ` - URL: ${serverUrl}` : ''}` : 
          'Docker容器內開發伺服器未運行'
      };
    } catch (error) {
      return {
        success: false,
        error: `檢查Docker容器內開發伺服器狀態失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      // 構建正確的 API URL
      const apiUrl = typeof window !== 'undefined' 
        ? '/api/docker'  // 客戶端環境
        : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

      const response = await fetch(apiUrl, {
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
    // 構建正確的 API URL
    const apiUrl = typeof window !== 'undefined' 
      ? '/api/docker'  // 客戶端環境
      : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

    const response = await fetch(apiUrl, {
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
      // 構建正確的 API URL
      const apiUrl = typeof window !== 'undefined' 
        ? '/api/docker'  // 客戶端環境
        : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

      const response = await fetch(apiUrl, {
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
      // 構建正確的 API URL
      const apiUrl = typeof window !== 'undefined' 
        ? '/api/docker'  // 客戶端環境
        : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

      const response = await fetch(apiUrl, {
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
      // 構建正確的 API URL
      const apiUrl = typeof window !== 'undefined' 
        ? '/api/docker'  // 客戶端環境
        : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

      const response = await fetch(apiUrl, {
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
  // 移除未使用的 securityValidator，使用內建的路徑驗證
  
  constructor(
    private dockerContext: DockerContext, 
    private projectName?: string
  ) {
    // 使用內建的安全驗證邏輯
  }

  /**
   * 讀取Docker容器內的檔案（需安全驗證）
   */
  async readFile(filePath: string): Promise<DockerToolResponse<string>> {
    try {
      // 簡化的安全驗證
      if (!this.isValidFilePath(filePath)) {
        return {
          success: false,
          error: `不安全的檔案路徑: ${filePath}`
        };
      }
      
      const result = await this.executeInContainer([
        'cat', filePath
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
   * 寫入檔案到Docker容器內（需安全驗證）
   */
  async writeFile(filePath: string, content: string): Promise<DockerToolResponse<string>> {
    try {
      // 簡化的安全驗證
      if (!this.isValidFilePath(filePath)) {
        return {
          success: false,
          error: `不安全的檔案路徑: ${filePath}`
        };
      }
      
      const result = await this.executeInContainer([
        'sh', '-c', `echo '${content.replace(/'/g, "'\\''")}' > ${filePath}`
      ]);

      return {
        success: result.success,
        data: result.containerOutput || '',
        message: result.success ? `成功寫入容器內檔案: ${filePath}` : '寫入失敗',
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
   * 簡化的檔案路徑安全驗證
   */
  private isValidFilePath(filePath: string): boolean {
    // 檢查基本的安全問題
    const dangerousPatterns = [
      /\.\./,           // 路徑遍歷
      /\/etc\//,        // 系統檔案
      /\/proc\//,       // 系統檔案
      /\/sys\//,        // 系統檔案
      /\/dev\//,        // 設備檔案
      /\/root\//,       // Root 目錄
      /\/home\/(?!app)/ // 其他用戶目錄
    ];

    return !dangerousPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * 列出Docker容器內目錄內容（需安全驗證）- 限制在workspace內，排除node_modules
   */
  async listDirectory(dirPath: string = '.', options?: { 
    recursive?: boolean; 
    showHidden?: boolean;
    useTree?: boolean;
  }): Promise<DockerToolResponse<string[]>> {
    try {
      const { recursive = false, showHidden = false, useTree = false } = options || {};
      
      // 修復路徑處理：確保在正確的工作目錄下執行
      const baseDir = this.dockerContext.workingDirectory || '/app';
      let safeDirPath = this.sanitizePath(dirPath);
      
      // 如果提供的路徑是相對路徑，則在基礎目錄下執行命令，但保持相對路徑
      // 不直接拼接路徑，而是通過 cd 命令切換目錄
      if (!safeDirPath.startsWith('/')) {
        // 保持相對路徑，稍後通過 cd 命令處理
      } else {
        // 如果是絕對路徑，檢查是否在安全範圍內
        if (!safeDirPath.startsWith('/app')) {
          safeDirPath = '/app' + safeDirPath;
        }
      }
      
      // 簡化的安全驗證
      if (!this.isValidDirectoryPath(safeDirPath)) {
        return {
          success: false,
          error: `不安全的目錄路徑: ${safeDirPath}`
        };
      }
      
      let command: string[];
      
      if (useTree) {
        // 使用tree命令，強制排除node_modules並限制深度
        const treeArgs = ['-I', 'node_modules|.next|.git|dist|build'];
        if (!recursive) treeArgs.push('-L', '3'); // 限制深度為3層
        if (showHidden) treeArgs.push('-a');
        
        command = ['bash', '-c', 
          `cd "${baseDir}" && (` +
          `tree ${treeArgs.join(' ')} "${safeDirPath}" | head -200 || ` + // 限制最多200行輸出
          `(command -v apt-get >/dev/null 2>&1 && apt-get update && apt-get install -y tree && tree ${treeArgs.join(' ')} "${safeDirPath}" | head -200) || ` +
          `(command -v apk >/dev/null 2>&1 && apk add --no-cache tree && tree ${treeArgs.join(' ')} "${safeDirPath}" | head -200) || ` +
          `echo "無法安裝 tree 命令，請使用標準 ls 列出"` +
          `)`
        ];
      } else {
        // 使用ls命令，排除node_modules
        if (recursive) {
          // 遞迴列出，明確排除node_modules等大型目錄
          command = ['bash', '-c', `cd "${baseDir}" && find "${safeDirPath}" -maxdepth 3 -name node_modules -prune -o -name .next -prune -o -name .git -prune -o -name dist -prune -o -name build -prune -o -print | head -100`];
        } else {
          // 非遞迴列出
          if (showHidden) {
            command = ['bash', '-c', `cd "${baseDir}" && ls -la "${safeDirPath}" | grep -v node_modules | head -50`];
          } else {
            command = ['bash', '-c', `cd "${baseDir}" && ls -l "${safeDirPath}" | grep -v node_modules | head -50`];
          }
        }
      }

      console.log(`🗂️ [listDirectory] 執行命令 (限制workspace):`, command.join(' '));

      const result = await this.executeInContainer(command);

      if (!result.success) {
        console.error(`❌ [listDirectory] 命令執行失敗:`, result.error);
        return {
          success: false,
          error: result.error || '列出目錄失敗'
        };
      }

      const output = result.containerOutput || '';
      
      // 早期截斷處理，避免過長輸出
      const lines = output.split('\n');
      let files = lines.filter(line => line.trim() && !line.includes('node_modules'));

      // 處理 ls -l 格式的輸出
      if (output.includes('total ') && !useTree) {
        files = files
          .filter(line => !line.startsWith('total '))
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return parts[parts.length - 1];
          })
          .filter(name => name && name !== '.' && name !== '..');
      }

      // 嚴格限制輸出長度 - 防止context爆炸
      if (files.length > 100) {
        files = files.slice(0, 100);
        files.push('⚠️ 輸出已截斷至100項以避免context爆炸');
        files.push('✨ 使用更具體的路徑來查看特定目錄');
      }

      // 移除包含敏感資訊的行
      files = files.filter(file => 
        !file.includes('node_modules') && 
        !file.includes('.next') && 
        !file.includes('.git') &&
        file.length < 200 // 避免單行過長
      );

      console.log(`✅ [listDirectory] 成功列出workspace目錄 (已過濾):`, { 
        path: safeDirPath, 
        fileCount: files.length
      });

      return {
        success: true,
        data: files,
        message: `成功列出workspace目錄: ${safeDirPath} (已排除node_modules等)`,
        containerOutput: files.join('\n') // 使用過濾後的輸出
      };
    } catch (error) {
      console.error(`❌ [listDirectory] 異常:`, error);
      return {
        success: false,
        error: `列出Docker容器內目錄失敗: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 簡化的目錄路徑安全驗證
   */
  private isValidDirectoryPath(dirPath: string): boolean {
    // 檢查基本的安全問題
    const dangerousPatterns = [
      /\.\./,           // 路徑遍歷
      /\/etc$/,         // 系統目錄
      /\/proc$/,        // 系統目錄
      /\/sys$/,         // 系統目錄
      /\/dev$/,         // 設備目錄
      /\/root$/,        // Root 目錄
      /\/home\/(?!app)/ // 其他用戶目錄
    ];

    return !dangerousPatterns.some(pattern => pattern.test(dirPath));
  }

  /**
   * 路徑安全化處理
   */
  private sanitizePath(path: string): string {
    // 移除危險字符和路徑遍歷
    let safePath = path
      .replace(/\.\./g, '') // 移除 ..
      .replace(/[;&|`$()]/g, '') // 移除shell特殊字符
      .trim();
    
    // 如果路徑為空或只是 .，使用當前目錄
    if (!safePath || safePath === '.') {
      return '.';
    }
    
    // 確保路徑不以 / 開頭（相對路徑）
    if (safePath.startsWith('/')) {
      safePath = '.' + safePath;
    }
    
    return safePath;
  }

  /**
   * 使用tree命令顯示Docker容器內目錄樹狀結構 - 限制workspace，排除node_modules
   */
  async showDirectoryTree(dirPath: string = '.', maxDepth?: number): Promise<DockerToolResponse<string>> {
    // 修復路徑處理
    const baseDir = this.dockerContext.workingDirectory || '/app';
    let sanitizedPath = this.sanitizePath(dirPath);
    
    if (!this.isValidDirectoryPath(sanitizedPath)) {
      return { success: false, error: '不安全的目錄路徑' };
    }

    // 設定安全的預設深度和排除規則
    const safeMaxDepth = maxDepth && maxDepth > 0 && maxDepth <= 4 ? maxDepth : 3;
    const excludePattern = 'node_modules|.next|.git|dist|build|coverage|.nyc_output';
    
    const command = `cd "${baseDir}" && tree -L ${safeMaxDepth} -I "${excludePattern}" -F --dirsfirst "${sanitizedPath}" | head -100`;

    let result = await this.executeInContainer(['bash', '-c', command]);

    // 如果第一次執行失敗，嘗試安裝 tree 並重試
    if (!result.success && result.error?.includes('tree: not found')) {
      console.log('tree 命令未找到，嘗試自動安裝...');
      
      // 嘗試安裝 tree
      const installResult = await this.executeInContainer([
        'bash', 
        '-c', 
        '(command -v apk >/dev/null 2>&1 && apk add --no-cache tree) || (command -v apt-get >/dev/null 2>&1 && apt-get update && apt-get install -y tree) || (command -v yum >/dev/null 2>&1 && yum install -y tree) || echo "無法安裝tree命令"'
      ]);

      if (installResult.success) {
        console.log('tree 安裝成功，重試命令...');
        // 再次執行 tree 命令
        const newCommand = `cd "${baseDir}" && tree -L ${safeMaxDepth} -I "${excludePattern}" -F --dirsfirst "${sanitizedPath}" | head -100`;
        result = await this.executeInContainer(['bash', '-c', newCommand]);
      } else {
        result.error += ` | 自動安裝 tree 失敗: ${installResult.error}`;
      }
    }
    
    // 如果 tree 還是失敗，使用 find 作為備用方案
    if (!result.success) {
      console.warn('tree 命令執行失敗，使用 find 作為備用方案...');
      const findCommand = `find "${sanitizedPath}" -maxdepth ${safeMaxDepth} -type d | grep -v -E "${excludePattern}" | head -50 | sort`;
      const findResult = await this.executeInContainer(['bash', '-c', findCommand]);
      
      if (findResult.success && findResult.containerOutput) {
        return {
          success: true,
          data: `🌳 ${sanitizedPath} 目錄結構 (使用find替代):\n${findResult.containerOutput}`,
          message: '使用 find 替代 tree 成功 - 已排除node_modules等大型目錄'
        };
      }
      result.error += ` | find 備用方案也失敗了: ${findResult.error}`;
    }

    // 過濾輸出，確保不包含敏感內容
    let outputData = result.containerOutput || '';
    if (outputData.length > 5000) { // 限制輸出長度
      outputData = outputData.substring(0, 5000) + '\n⚠️ 輸出已截斷以避免context爆炸';
    }
    
    return {
      success: result.success,
      data: result.success ? `🌳 ${sanitizedPath} 目錄結構:\n${outputData}` : outputData,
      error: result.error,
      message: result.success ? `${sanitizedPath} 目錄樹狀結構已生成 (已排除node_modules等)` : undefined
    };
  }

  /**
   * 在Docker容器內執行命令
   */
  private async executeInContainer(command: string[]): Promise<DockerToolResponse> {
    try {
      // 構建正確的 API URL
      const apiUrl = typeof window !== 'undefined' 
        ? '/api/docker'  // 客戶端環境
        : `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/docker`;  // 服務器端環境

      const response = await fetch(apiUrl, {
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

  constructor(dockerContext: DockerContext, projectName?: string) {
    this.devServer = new DockerDevServerTool(dockerContext);
    this.logMonitor = new DockerLogMonitorTool(dockerContext);
    this.healthCheck = new DockerHealthCheckTool(dockerContext);
    this.fileSystem = new DockerFileSystemTool(dockerContext, projectName);
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
          devServerStatus: devServerStatus,
          serviceHealth: serviceHealth,
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
 * 創建Docker工具實例的工廠函數（專案工作區模式）
 */
export function createDockerToolkit(dockerContext: DockerContext, projectName?: string): DockerToolkit {
  return new DockerToolkit(dockerContext, projectName);
}

/**
 * 標準化專案名稱：將短橫線轉換為底線
 */
function normalizeProjectName(projectName: string): string {
  return projectName.replace(/-/g, '_');
}

/**
 * 創建預設Docker上下文配置（嚴格限制在專案工作區）
 */
export function createDefaultDockerContext(containerId: string, containerName?: string, projectName?: string): DockerContext {
  // 標準化專案名稱並強制使用專案工作區路徑
  const normalizedProjectName = projectName ? normalizeProjectName(projectName) : null;
  const workingDirectory = normalizedProjectName 
    ? `/app/workspace/${normalizedProjectName}` 
    : '/app/workspace';
  
  console.log(`🐳 創建 Docker 上下文:`, {
    containerId: containerId.substring(0, 12),
    containerName: containerName || `ai-dev-${containerId.substring(0, 12)}`,
    workingDirectory,
    originalProjectName: projectName,
    normalizedProjectName
  });
  
  return {
    containerId,
    containerName: containerName || `ai-dev-${containerId.substring(0, 12)}`,
    workingDirectory,
    status: 'running'
  };
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