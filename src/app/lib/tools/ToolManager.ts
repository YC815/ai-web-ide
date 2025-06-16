// AI 工具管理器
// 負責協調所有 AI 工具的運作和事件處理

import { 
  CallToolInterface, 
  ToolResponse, 
  ToolEvent, 
  ToolError,
  CodeDiff,
  ErrorSummary,
  TokenUsage,
  SessionUsage 
} from './types';

/**
 * AI 工具管理器
 * 
 * 功能特色：
 * - 🔧 統一的工具介面管理
 * - 📡 事件驅動的工具通訊
 * - 🔄 自動錯誤重試機制
 * - 📊 工具使用統計追蹤
 * - 🎯 智能工具選擇建議
 */
export class ToolManager implements CallToolInterface {
  private tools: Map<string, any> = new Map();
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  private operationHistory: ToolEvent[] = [];
  private sessionStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalTokens: 0,
    totalCost: 0,
    startTime: new Date()
  };

  constructor() {
    console.log('🚀 AI 工具管理器已初始化');
    this.initializeEventHandlers();
  }

  /**
   * 初始化事件處理器
   * 設置基本的系統事件監聽
   */
  private initializeEventHandlers() {
    // 監聽工具執行事件
    this.subscribe('tool:execute', (data) => {
      this.sessionStats.totalOperations++;
      this.logOperation(data);
    });

    // 監聽工具成功事件
    this.subscribe('tool:success', (data) => {
      this.sessionStats.successfulOperations++;
      console.log(`✅ 工具執行成功: ${data.toolName}.${data.method}`);
    });

    // 監聽工具失敗事件
    this.subscribe('tool:error', (data) => {
      this.sessionStats.failedOperations++;
      console.error(`❌ 工具執行失敗: ${data.toolName}.${data.method}`, data.error);
    });

    // 監聽 Token 使用事件
    this.subscribe('token:usage', (data: TokenUsage) => {
      this.sessionStats.totalTokens += data.total;
      this.sessionStats.totalCost += data.cost;
    });
  }

  /**
   * 註冊工具到管理器
   * @param name - 工具名稱
   * @param tool - 工具實例
   */
  registerTool(name: string, tool: any): void {
    this.tools.set(name, tool);
    console.log(`🔧 已註冊工具: ${name}`);
    
    this.emit('tool:registered', { name, tool });
  }

  /**
   * 移除工具
   * @param name - 工具名稱
   */
  unregisterTool(name: string): void {
    if (this.tools.has(name)) {
      this.tools.delete(name);
      console.log(`🗑️ 已移除工具: ${name}`);
      this.emit('tool:unregistered', { name });
    }
  }

  /**
   * 調用工具方法
   * @param toolName - 工具名稱
   * @param method - 方法名稱
   * @param params - 參數
   * @returns Promise<ToolResponse<T>>
   */
  async invoke<T = any>(
    toolName: string, 
    method: string, 
    params?: any
  ): Promise<ToolResponse<T>> {
    const startTime = Date.now();
    
    try {
      // 發送執行事件
      this.emit('tool:execute', { toolName, method, params, startTime });

      // 檢查工具是否存在
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new ToolError(
          `工具 '${toolName}' 未找到`,
          toolName,
          method,
          'TOOL_NOT_FOUND'
        );
      }

      // 檢查方法是否存在
      if (typeof tool[method] !== 'function') {
        throw new ToolError(
          `方法 '${method}' 在工具 '${toolName}' 中不存在`,
          toolName,
          method,
          'METHOD_NOT_FOUND'
        );
      }

      // 執行工具方法
      console.log(`🔄 執行工具: ${toolName}.${method}`, params);
      const result = await tool[method](params);
      
      // 確保回應格式符合 ToolResponse
      const response: ToolResponse<T> = {
        success: true,
        data: result,
        timestamp: new Date(),
        toolName: toolName
      };

      // 記錄執行時間
      const duration = Date.now() - startTime;
      console.log(`✅ 工具執行完成: ${toolName}.${method} (${duration}ms)`);

      // 發送成功事件
      this.emit('tool:success', { 
        toolName, 
        method, 
        params, 
        result: response, 
        duration 
      });

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 建立錯誤回應
      const errorResponse: ToolResponse<T> = {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
        toolName: toolName
      };

      // 發送錯誤事件
      this.emit('tool:error', { 
        toolName, 
        method, 
        params, 
        error: errorMessage, 
        duration 
      });

      console.error(`❌ 工具執行失敗: ${toolName}.${method} (${duration}ms)`, error);
      
      return errorResponse;
    }
  }

  /**
   * 訂閱事件
   * @param event - 事件名稱
   * @param callback - 回調函數
   */
  subscribe(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 取消事件訂閱
   * @param event - 事件名稱
   * @param callback - 回調函數
   */
  unsubscribe(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 發送事件
   * @param event - 事件名稱
   * @param data - 事件資料
   */
  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    const eventData: ToolEvent = {
      type: event,
      data,
      timestamp: new Date(),
      source: 'ToolManager'
    };

    listeners.forEach(callback => {
      try {
        callback(eventData.data);
      } catch (error) {
        console.error(`事件處理器錯誤 [${event}]:`, error);
      }
    });

    // 記錄到操作歷史
    this.operationHistory.push(eventData);
    
    // 限制歷史記錄數量 (保留最近1000條)
    if (this.operationHistory.length > 1000) {
      this.operationHistory = this.operationHistory.slice(-1000);
    }
  }

  /**
   * 取得已註冊的工具列表
   * @returns 工具名稱陣列
   */
  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 取得工具執行統計
   * @returns 統計資訊
   */
  getSessionStats() {
    const duration = Date.now() - this.sessionStats.startTime.getTime();
    return {
      ...this.sessionStats,
      duration: Math.floor(duration / 1000), // 秒
      successRate: this.sessionStats.totalOperations > 0 
        ? Math.round((this.sessionStats.successfulOperations / this.sessionStats.totalOperations) * 100)
        : 0
    };
  }

  /**
   * 取得操作歷史
   * @param limit - 限制返回數量
   * @returns 操作歷史
   */
  getOperationHistory(limit: number = 50): ToolEvent[] {
    return this.operationHistory.slice(-limit).reverse();
  }

  /**
   * 清除操作歷史
   */
  clearHistory(): void {
    this.operationHistory = [];
    console.log('🗑️ 操作歷史已清除');
  }

  /**
   * 重置會話統計
   */
  resetSession(): void {
    this.sessionStats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalTokens: 0,
      totalCost: 0,
      startTime: new Date()
    };
    this.clearHistory();
    console.log('🔄 會話統計已重置');
    this.emit('session:reset', {});
  }

  /**
   * 檢查工具健康狀態
   * @returns 健康狀態報告
   */
  async checkToolsHealth(): Promise<{
    healthy: string[];
    unhealthy: string[];
    total: number;
  }> {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [name, tool] of this.tools) {
      try {
        // 如果工具有健康檢查方法，調用它
        if (typeof tool.healthCheck === 'function') {
          await tool.healthCheck();
          healthy.push(name);
        } else {
          // 否則認為工具健康
          healthy.push(name);
        }
      } catch (error) {
        console.warn(`⚠️ 工具健康檢查失敗: ${name}`, error);
        unhealthy.push(name);
      }
    }

    const report = {
      healthy,
      unhealthy,
      total: healthy.length + unhealthy.length
    };

    console.log('🏥 工具健康檢查完成:', report);
    this.emit('tools:health-check', report);

    return report;
  }

  /**
   * 智能工具建議
   * 根據當前上下文建議最適合的工具
   * @param context - 上下文資訊
   * @returns 建議的工具和方法
   */
  suggestTools(context: {
    task?: string;
    files?: string[];
    errors?: any[];
    lastOperation?: string;
  }): { toolName: string; method: string; confidence: number; reason: string }[] {
    const suggestions: { toolName: string; method: string; confidence: number; reason: string }[] = [];

    // 根據任務類型提供建議
    if (context.task) {
      const task = context.task.toLowerCase();
      
      if (task.includes('預覽') || task.includes('render')) {
        suggestions.push({
          toolName: 'PreviewRenderTool',
          method: 'startPreview',
          confidence: 0.9,
          reason: '需要啟動預覽服務'
        });
      }
      
      if (task.includes('錯誤') || task.includes('error') || task.includes('修復')) {
        suggestions.push({
          toolName: 'ErrorAnalyzerTool',
          method: 'collectErrors',
          confidence: 0.85,
          reason: '需要分析和修復錯誤'
        });
      }
      
      if (task.includes('checkpoint') || task.includes('提交') || task.includes('commit')) {
        suggestions.push({
          toolName: 'GitCheckpointTool',
          method: 'createCheckpoint',
          confidence: 0.8,
          reason: '需要建立代碼檢查點'
        });
      }
    }

    // 根據錯誤提供建議
    if (context.errors && context.errors.length > 0) {
      suggestions.push({
        toolName: 'ErrorAnalyzerTool',
        method: 'analyzeError',
        confidence: 0.95,
        reason: '發現錯誤，需要分析和修復'
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 記錄操作到歷史
   * @param data - 操作資料
   */
  private logOperation(data: any): void {
    // 可以在這裡添加更詳細的日誌記錄邏輯
    // 例如：寫入檔案、發送到分析服務等
  }

  /**
   * 銷毀管理器
   * 清理資源和事件監聽器
   */
  destroy(): void {
    this.tools.clear();
    this.eventListeners.clear();
    this.operationHistory = [];
    console.log('🗑️ 工具管理器已銷毀');
  }
}

// 建立全局工具管理器實例
export const toolManager = new ToolManager(); 