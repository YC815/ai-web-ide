/**
 * 穩定的 Agent 執行器
 * 整合增強的 Schema、Prompt 和錯誤恢復機制
 */

import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { Tool } from '@langchain/core/tools';
import { BufferMemory } from 'langchain/memory';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

import { EnhancedPromptBuilder, PromptValidator } from './enhanced-prompts';
import { getEnhancedToolSchema } from './enhanced-tool-schemas';

// === 增強的Agent配置 ===
export interface StableAgentConfig {
  model: ChatOpenAI;
  tools: Tool[];
  memory: BufferMemory;
  vectorStore: MemoryVectorStore;
  maxRetries: number;
  retryDelay: number;
  enableValidation: boolean;
  enableErrorRecovery: boolean;
  verboseLogging: boolean;
}

// === 執行結果介面 ===
export interface StableExecutionResult {
  success: boolean;
  output: string;
  toolCalls: ToolCallResult[];
  retryCount: number;
  executionTime: number;
  error?: string;
  warnings?: string[];
  metadata: {
    sessionId: string;
    timestamp: string;
    finalDecision: 'completed' | 'failed' | 'retry_exhausted';
  };
}

export interface ToolCallResult {
  tool: string;
  input: Record<string, any>;
  output: string;
  success: boolean;
  duration: number;
  timestamp: string;
  attempt: number;
  validationErrors?: string[];
}

// === 主要執行器類別 ===
export class StableAgentExecutor {
  private agent: AgentExecutor;
  private config: StableAgentConfig;
  private executionHistory: ToolCallResult[] = [];

  constructor(config: StableAgentConfig) {
    this.config = config;
    this.agent = this.createEnhancedAgent();
  }

  /**
   * 創建增強的 Agent
   */
  private createEnhancedAgent(): AgentExecutor {
    // 使用增強的系統 Prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", EnhancedPromptBuilder.buildSystemPrompt()],
      ["placeholder", "{chat_history}"],
      ["human", "用戶需求: {input}\n\n⚡ 立即分析需求並自動執行相關工具完成任務。使用繁體中文回應！"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // 創建帶驗證的工具包裝器
    const validatedTools = this.wrapToolsWithValidation(this.config.tools);

    const agent = createStructuredChatAgent({
      llm: this.config.model,
      tools: validatedTools,
      prompt
    });

    return new AgentExecutor({
      agent,
      tools: validatedTools,
      memory: this.config.memory,
      verbose: this.config.verboseLogging,
      maxIterations: 20, // 增加迭代次數
      earlyStoppingMethod: "force",
      // 添加自定義執行器回調
      callbacks: [
        {
          handleToolStart: (tool: any, input: string) => {
            if (this.config.verboseLogging) {
              console.log(`🔧 開始執行工具: ${tool.name}`);
              console.log(`📝 輸入參數:`, input);
            }
          },
          handleToolEnd: (output: string) => {
            if (this.config.verboseLogging) {
              console.log(`✅ 工具執行完成`);
              console.log(`📄 輸出結果:`, output.substring(0, 200) + '...');
            }
          },
          handleToolError: (error: Error) => {
            console.error(`❌ 工具執行錯誤:`, error.message);
          }
        }
      ]
    });
  }

  /**
   * 包裝工具以添加驗證和錯誤恢復
   */
  private wrapToolsWithValidation(tools: Tool[]): Tool[] {
    return tools.map(tool => {
      const originalCall = tool._call.bind(tool);
      
      tool._call = async (input: any) => {
        const startTime = Date.now();
        
        // 預先驗證
        if (this.config.enableValidation) {
          const validation = PromptValidator.validateToolCall(tool.name, input);
          if (!validation.isValid) {
            const errorMsg = `工具驗證失敗: ${validation.errors.join(', ')}. 建議: ${validation.suggestions.join(', ')}`;
            console.warn(`⚠️ ${errorMsg}`);
            
            // 如果啟用錯誤恢復，嘗試修正參數
            if (this.config.enableErrorRecovery) {
              input = this.attemptParameterFix(tool.name, input, validation.suggestions);
            } else {
              throw new Error(errorMsg);
            }
          }
        }

        // 執行工具並記錄結果
        try {
          const result = await originalCall(input);
          const duration = Date.now() - startTime;
          
          this.recordToolCall({
            tool: tool.name,
            input,
            output: result,
            success: true,
            duration,
            timestamp: new Date().toISOString(),
            attempt: 1
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          this.recordToolCall({
            tool: tool.name,
            input,
            output: '',
            success: false,
            duration,
            timestamp: new Date().toISOString(),
            attempt: 1,
            validationErrors: [error instanceof Error ? error.message : String(error)]
          });

          // 如果啟用錯誤恢復，嘗試重試
          if (this.config.enableErrorRecovery) {
            return this.retryToolCall(tool.name, originalCall, input, error as Error);
          }

          throw error;
        }
      };

      return tool;
    });
  }

  /**
   * 嘗試修正參數
   */
  private attemptParameterFix(
    toolName: string, 
    input: any, 
    suggestions: string[]
  ): any {
    const fixedInput = { ...input };

    // 路徑修正
    if (fixedInput.filePath) {
      let path = fixedInput.filePath;
      
      // 移除絕對路徑前綴
      if (path.startsWith('/app/workspace/')) {
        path = path.replace(/^\/app\/workspace\/[^\/]+\//, '');
        console.log(`🔧 修正路徑: ${fixedInput.filePath} → ${path}`);
        fixedInput.filePath = path;
      }
      
      // 移除 ./ 前綴
      if (path.startsWith('./')) {
        path = path.substring(2);
        console.log(`🔧 修正路徑: ${fixedInput.filePath} → ${path}`);
        fixedInput.filePath = path;
      }
    }

    // 主頁檔案特殊處理
    if (toolName.includes('file') && !fixedInput.filePath) {
      fixedInput.filePath = 'src/app/page.tsx';
      console.log(`🔧 自動設定主頁路徑: ${fixedInput.filePath}`);
    }

    return fixedInput;
  }

  /**
   * 重試工具調用
   */
  private async retryToolCall(
    toolName: string,
    originalCall: Function,
    input: any,
    lastError: Error,
    attempt: number = 1
  ): Promise<string> {
    if (attempt >= this.config.maxRetries) {
      throw new Error(`工具 ${toolName} 重試 ${attempt} 次後仍然失敗: ${lastError.message}`);
    }

    console.log(`🔄 重試工具 ${toolName} (第 ${attempt + 1} 次)`);
    
    // 延遲重試
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));

    try {
      const result = await originalCall(input);
      
      console.log(`✅ 重試成功 (第 ${attempt + 1} 次)`);
      
      this.recordToolCall({
        tool: toolName,
        input,
        output: result,
        success: true,
        duration: 0,
        timestamp: new Date().toISOString(),
        attempt: attempt + 1
      });

      return result;
    } catch (error) {
      console.warn(`❌ 重試失敗 (第 ${attempt + 1} 次): ${error instanceof Error ? error.message : String(error)}`);
      
      this.recordToolCall({
        tool: toolName,
        input,
        output: '',
        success: false,
        duration: 0,
        timestamp: new Date().toISOString(),
        attempt: attempt + 1,
        validationErrors: [error instanceof Error ? error.message : String(error)]
      });

      return this.retryToolCall(toolName, originalCall, input, error as Error, attempt + 1);
    }
  }

  /**
   * 記錄工具調用
   */
  private recordToolCall(result: ToolCallResult): void {
    this.executionHistory.push(result);
    
    // 保持歷史記錄在合理範圍內
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
  }

  /**
   * 執行用戶請求 - 主要入口點
   */
  async executeUserRequest(
    userMessage: string, 
    sessionId: string
  ): Promise<StableExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    console.log(`🚀 開始執行用戶請求: ${userMessage}`);
    
    try {
      // 清理執行歷史
      this.executionHistory = [];
      
      // 執行 Agent
      const result = await this.agent.invoke({
        input: userMessage,
        chat_history: await this.config.memory.chatHistory.getMessages()
      });

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ 執行完成，耗時: ${executionTime}ms`);

      return {
        success: true,
        output: result.output,
        toolCalls: this.executionHistory,
        retryCount: this.calculateTotalRetries(),
        executionTime,
        warnings: this.extractWarnings(),
        metadata: {
          sessionId,
          timestamp,
          finalDecision: 'completed'
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ 執行失敗: ${errorMessage}`);

      return {
        success: false,
        output: '',
        toolCalls: this.executionHistory,
        retryCount: this.calculateTotalRetries(),
        executionTime,
        error: errorMessage,
        warnings: this.extractWarnings(),
        metadata: {
          sessionId,
          timestamp,
          finalDecision: 'failed'
        }
      };
    }
  }

  /**
   * 計算總重試次數
   */
  private calculateTotalRetries(): number {
    return this.executionHistory.reduce((total, call) => {
      return total + Math.max(0, call.attempt - 1);
    }, 0);
  }

  /**
   * 提取警告信息
   */
  private extractWarnings(): string[] {
    const warnings: string[] = [];
    
    // 檢查失敗的工具調用
    const failedCalls = this.executionHistory.filter(call => !call.success);
    if (failedCalls.length > 0) {
      warnings.push(`有 ${failedCalls.length} 個工具調用失敗`);
    }

    // 檢查重試次數
    const totalRetries = this.calculateTotalRetries();
    if (totalRetries > 0) {
      warnings.push(`總共重試 ${totalRetries} 次`);
    }

    // 檢查執行時間
    const longRunningCalls = this.executionHistory.filter(call => call.duration > 5000);
    if (longRunningCalls.length > 0) {
      warnings.push(`有 ${longRunningCalls.length} 個工具調用執行時間超過 5 秒`);
    }

    return warnings;
  }

  /**
   * 獲取執行統計
   */
  getExecutionStats(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
    totalRetries: number;
  } {
    const totalCalls = this.executionHistory.length;
    const successfulCalls = this.executionHistory.filter(call => call.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const averageExecutionTime = totalCalls > 0 
      ? this.executionHistory.reduce((sum, call) => sum + call.duration, 0) / totalCalls 
      : 0;
    const totalRetries = this.calculateTotalRetries();

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageExecutionTime,
      totalRetries
    };
  }

  /**
   * 重置執行器狀態
   */
  reset(): void {
    this.executionHistory = [];
    console.log('🔄 Agent 執行器已重置');
  }
}

// === 工廠函數 ===
export function createStableAgentExecutor(config: StableAgentConfig): StableAgentExecutor {
  return new StableAgentExecutor(config);
}

// === 預設配置 ===
export const DEFAULT_STABLE_CONFIG: Partial<StableAgentConfig> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 秒
  enableValidation: true,
  enableErrorRecovery: true,
  verboseLogging: true
}; 