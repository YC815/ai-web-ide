/**
 * 智能端口管理器
 * 自動檢測和解決端口衝突，提供最佳的用戶體驗
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PortInfo {
  port: number;
  pid?: number;
  processName?: string;
  isAvailable: boolean;
}

export interface PortConfiguration {
  preferredPort: number;
  fallbackPorts: number[];
  allowAutoAllocation: boolean;
  autoKillConflicts: boolean;
}

export class SmartPortManager {
  private static instance: SmartPortManager | null = null;
  private portCache: Map<number, PortInfo> = new Map();
  private lastScanTime: number = 0;
  private scanInterval: number = 30000; // 30 秒緩存

  private constructor() {}

  public static getInstance(): SmartPortManager {
    if (!SmartPortManager.instance) {
      SmartPortManager.instance = new SmartPortManager();
    }
    return SmartPortManager.instance;
  }

  /**
   * 智能端口分配 - 自動找到可用端口並解決衝突
   */
  async allocatePort(config: PortConfiguration): Promise<{
    port: number;
    wasConflict: boolean;
    resolvedConflicts: string[];
    message: string;
  }> {
    console.log('🔍 開始智能端口分配...', config);

    const resolvedConflicts: string[] = [];

    // 1. 嘗試首選端口
    const preferredPortInfo = await this.getPortInfo(config.preferredPort);
    
    if (preferredPortInfo.isAvailable) {
      return {
        port: config.preferredPort,
        wasConflict: false,
        resolvedConflicts,
        message: `✅ 端口 ${config.preferredPort} 可用`
      };
    }

    console.log(`⚠️ 端口 ${config.preferredPort} 被佔用 (PID: ${preferredPortInfo.pid})`);

    // 2. 如果允許自動終止衝突進程
    if (config.autoKillConflicts && preferredPortInfo.pid) {
      const killResult = await this.killProcess(preferredPortInfo.pid);
      if (killResult.success) {
        resolvedConflicts.push(`終止進程 PID ${preferredPortInfo.pid} (${preferredPortInfo.processName || 'unknown'})`);
        
        // 等待一下讓端口釋放
        await this.delay(1000);
        
        const recheckInfo = await this.getPortInfo(config.preferredPort, true); // 強制重新檢查
        if (recheckInfo.isAvailable) {
          return {
            port: config.preferredPort,
            wasConflict: true,
            resolvedConflicts,
            message: `✅ 已釋放端口 ${config.preferredPort}，衝突已解決`
          };
        }
      }
    }

    // 3. 嘗試備用端口
    for (const fallbackPort of config.fallbackPorts) {
      const fallbackInfo = await this.getPortInfo(fallbackPort);
      if (fallbackInfo.isAvailable) {
        return {
          port: fallbackPort,
          wasConflict: true,
          resolvedConflicts,
          message: `✅ 使用備用端口 ${fallbackPort}（原端口 ${config.preferredPort} 被佔用）`
        };
      }
    }

    // 4. 自動分配可用端口
    if (config.allowAutoAllocation) {
      const autoPort = await this.findAvailablePort(config.preferredPort + 1000, config.preferredPort + 2000);
      if (autoPort) {
        return {
          port: autoPort,
          wasConflict: true,
          resolvedConflicts,
          message: `✅ 自動分配端口 ${autoPort}（範圍 ${config.preferredPort + 1000}-${config.preferredPort + 2000}）`
        };
      }
    }

    // 5. 所有方法都失敗
    throw new Error(`❌ 無法分配端口：首選端口 ${config.preferredPort} 被佔用，所有備用端口也不可用`);
  }

  /**
   * 獲取端口資訊
   */
  async getPortInfo(port: number, forceRefresh: boolean = false): Promise<PortInfo> {
    const now = Date.now();
    
    // 檢查緩存
    if (!forceRefresh && this.portCache.has(port) && (now - this.lastScanTime) < this.scanInterval) {
      return this.portCache.get(port)!;
    }

    try {
      // 使用 lsof 檢查端口
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout.trim().split('\n').filter(pid => pid);
      
      if (pids.length > 0) {
        const pid = parseInt(pids[0]);
        let processName = 'unknown';
        
        try {
          const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
          processName = psOutput.trim();
        } catch {
          // 忽略獲取進程名稱的錯誤
        }
        
        const portInfo: PortInfo = {
          port,
          pid,
          processName,
          isAvailable: false
        };
        
        this.portCache.set(port, portInfo);
        return portInfo;
      }
    } catch (error) {
      // lsof 返回錯誤通常表示端口未被使用
    }

    const portInfo: PortInfo = {
      port,
      isAvailable: true
    };
    
    this.portCache.set(port, portInfo);
    this.lastScanTime = now;
    
    return portInfo;
  }

  /**
   * 終止進程
   */
  async killProcess(pid: number): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔫 嘗試終止進程 PID ${pid}...`);
      
      // 先嘗試溫和終止
      await execAsync(`kill ${pid}`);
      await this.delay(2000);
      
      // 檢查進程是否還存在
      try {
        await execAsync(`ps -p ${pid}`);
        // 如果進程還存在，使用強制終止
        console.log(`💀 進程 ${pid} 仍存在，使用強制終止...`);
        await execAsync(`kill -9 ${pid}`);
      } catch {
        // 進程已經不存在了
      }
      
      return {
        success: true,
        message: `✅ 成功終止進程 PID ${pid}`
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 無法終止進程 PID ${pid}: ${error}`
      };
    }
  }

  /**
   * 在指定範圍內找到可用端口
   */
  async findAvailablePort(startPort: number, endPort: number): Promise<number | null> {
    for (let port = startPort; port <= endPort; port++) {
      const portInfo = await this.getPortInfo(port);
      if (portInfo.isAvailable) {
        return port;
      }
    }
    return null;
  }

  /**
   * 檢查多個端口的狀態
   */
  async checkMultiplePorts(ports: number[]): Promise<Map<number, PortInfo>> {
    const results = new Map<number, PortInfo>();
    
    const checks = ports.map(async (port) => {
      const info = await this.getPortInfo(port);
      results.set(port, info);
    });
    
    await Promise.all(checks);
    return results;
  }

  /**
   * 自動修復開發伺服器端口衝突
   */
  async autoFixDevServerPort(): Promise<{
    success: boolean;
    newPort?: number;
    message: string;
    actions: string[];
  }> {
    console.log('🔧 開始自動修復開發伺服器端口衝突...');
    
    const actions: string[] = [];
    
    try {
      const result = await this.allocatePort({
        preferredPort: 3000,
        fallbackPorts: [3001, 3002, 3003, 8000, 8080],
        allowAutoAllocation: true,
        autoKillConflicts: true
      });
      
      actions.push(...result.resolvedConflicts);
      
      if (result.port !== 3000) {
        actions.push(`切換到端口 ${result.port}`);
      }
      
      return {
        success: true,
        newPort: result.port,
        message: result.message,
        actions
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ 自動修復失敗: ${error}`,
        actions
      };
    }
  }

  /**
   * 清理殭屍進程和端口
   */
  async cleanupZombiePorts(): Promise<{
    cleaned: number[];
    message: string;
  }> {
    console.log('🧹 開始清理殭屍端口...');
    
    const cleaned: number[] = [];
    const commonPorts = [3000, 3001, 3002, 8000, 8080];
    
    for (const port of commonPorts) {
      const portInfo = await this.getPortInfo(port, true);
      
      if (!portInfo.isAvailable && portInfo.pid) {
        try {
          // 檢查進程是否為 Node.js 開發伺服器
          const { stdout } = await execAsync(`ps -p ${portInfo.pid} -o args=`);
          const cmdLine = stdout.trim().toLowerCase();
          
          if (cmdLine.includes('node') && (cmdLine.includes('dev') || cmdLine.includes('next'))) {
            const killResult = await this.killProcess(portInfo.pid);
            if (killResult.success) {
              cleaned.push(port);
            }
          }
        } catch {
          // 忽略錯誤
        }
      }
    }
    
    return {
      cleaned,
      message: cleaned.length > 0 
        ? `✅ 已清理 ${cleaned.length} 個殭屍端口: ${cleaned.join(', ')}`
        : '✨ 沒有發現需要清理的殭屍端口'
    };
  }

  /**
   * 獲取系統端口使用報告
   */
  async getPortUsageReport(): Promise<{
    totalPorts: number;
    usedPorts: PortInfo[];
    availablePorts: number[];
    recommendations: string[];
  }> {
    const commonPorts = [3000, 3001, 3002, 3003, 8000, 8080, 5000, 5001, 4000, 4001];
    const portInfos = await this.checkMultiplePorts(commonPorts);
    
    const usedPorts: PortInfo[] = [];
    const availablePorts: number[] = [];
    
    for (const [port, info] of portInfos) {
      if (info.isAvailable) {
        availablePorts.push(port);
      } else {
        usedPorts.push(info);
      }
    }
    
    const recommendations: string[] = [];
    
    if (availablePorts.length === 0) {
      recommendations.push('⚠️ 所有常用端口都被佔用，建議清理不需要的進程');
    } else if (availablePorts.length < 3) {
      recommendations.push('⚠️ 可用端口較少，建議定期清理端口');
    }
    
    if (usedPorts.length > 5) {
      recommendations.push('💡 有較多端口被佔用，建議檢查是否有多餘的開發伺服器運行');
    }
    
    return {
      totalPorts: commonPorts.length,
      usedPorts,
      availablePorts,
      recommendations
    };
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清除緩存
   */
  clearCache(): void {
    this.portCache.clear();
    this.lastScanTime = 0;
  }
}

// 導出單例實例
export const smartPortManager = SmartPortManager.getInstance(); 