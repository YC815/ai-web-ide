/**
 * AI 工具控制框架（Tool-calling Agent Controller）
 * 讓 AI 能夠有「先 tool → 看結果 → 再決定」的能力
 */

import { logger } from '../logger';
import { ToolRegistry } from '../docker/tool-registry';
import { OpenAIService } from './openai-service';
import { aiOutputLogger } from './ai-output-logger';

// 定義訊息類型
export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

// 定義工具呼叫結構
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 定義 LLM 回應結構
export interface LLMResponse {
  content: string | null;
  tool_calls?: ToolCall[];
}

// 定義工具執行結果
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Agent 控制器配置
export interface AgentConfig {
  maxToolCalls?: number;      // 最大工具呼叫次數（防暴走）
  maxRetries?: number;        // 最大重試次數
  timeoutMs?: number;         // 單次工具呼叫超時時間
  enableLogging?: boolean;    // 是否啟用日誌
}

export class AgentController {
  private toolRegistry: ToolRegistry;
  private openaiService: OpenAIService;
  private config: Required<AgentConfig>;

  constructor(
    toolRegistry: ToolRegistry,
    openaiService: OpenAIService,
    config: AgentConfig = {}
  ) {
    this.toolRegistry = toolRegistry;
    this.openaiService = openaiService;
    this.config = {
      maxToolCalls: config.maxToolCalls ?? 5,
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 30000,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * 主控制函數：執行 Agent 控制流程
   * @param userMessage 使用者輸入訊息
   * @param systemPrompt 系統提示詞（可選）
   * @returns 最終回應結果
   */
  async runAgentController(
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const history: Message[] = [];

    // 記錄使用者輸入
    await aiOutputLogger.logSystem(
      'AgentController',
      `開始執行 Agent 控制流程`,
      { userMessage, systemPrompt }
    );

    // 添加系統提示詞
    if (systemPrompt) {
      history.push({ role: 'system', content: systemPrompt });
    } else {
      history.push({ role: 'system', content: this.getDefaultSystemPrompt() });
    }

    // 添加使用者訊息
    history.push({ role: 'user', content: userMessage });

    let toolCallCount = 0;
    let retryCount = 0;

    this.log(`🚀 開始執行 Agent 控制流程，使用者訊息: ${userMessage}`);

    while (true) {
      try {
        // 檢查是否超過最大工具呼叫次數
        if (toolCallCount >= this.config.maxToolCalls) {
          this.log(`⚠️ 已達到最大工具呼叫次數限制 (${this.config.maxToolCalls})`);
          return `已達到最大工具呼叫次數限制，無法繼續處理。目前已執行 ${toolCallCount} 次工具呼叫。`;
        }

        // 呼叫 LLM 進行推論
        this.log(`🧠 第 ${toolCallCount + 1} 次 LLM 推論...`);
        
        // 記錄LLM推論決策
        await aiOutputLogger.logDecision(
          'AgentController',
          `第 ${toolCallCount + 1} 次 LLM 推論開始`,
          { historyLength: history.length, toolCallCount }
        );
        
        const llmResponse = await this.callLLM(history);

        // 記錄LLM回應
        await aiOutputLogger.logOutput(
          'AgentController',
          `LLM 回應: ${llmResponse.content || '無內容'}`,
          { 
            hasToolCalls: !!(llmResponse.tool_calls && llmResponse.tool_calls.length > 0),
            toolCallsCount: llmResponse.tool_calls?.length || 0
          }
        );

        // 如果 LLM 決定不需要呼叫工具，直接回傳結果
        if (!llmResponse.tool_calls || llmResponse.tool_calls.length === 0) {
          this.log(`✅ LLM 決定不需要呼叫工具，直接回傳結果`);
          
          // 記錄最終結果
          await aiOutputLogger.logOutput(
            'AgentController',
            `最終回應: ${llmResponse.content || '無法產生回應'}`,
            { finalResponse: true, toolCallCount }
          );
          
          return llmResponse.content || '無法產生回應';
        }

        // 執行工具呼叫
        toolCallCount++;
        this.log(`🛠️ 執行第 ${toolCallCount} 次工具呼叫...`);

        // 建立包含 tool_calls 的 assistant 訊息
        const assistantMessage: Message = {
          role: 'assistant',
          content: llmResponse.content || '',
          tool_calls: llmResponse.tool_calls
        };
        history.push(assistantMessage);

        // 處理每個工具呼叫
        for (const toolCall of llmResponse.tool_calls) {
          const { name, arguments: argsStr } = toolCall.function;
          
          try {
            // 解析工具參數
            const parameters = JSON.parse(argsStr);
            this.log(`🔧 呼叫工具: ${name}, 參數: ${JSON.stringify(parameters)}`);

            // 記錄工具呼叫決策
            await aiOutputLogger.logDecision(
              'AgentController',
              `決定呼叫工具: ${name}`,
              { parameters, toolCallId: toolCall.id }
            );

            // 執行工具
            const toolResult = await this.executeToolWithTimeout(name, parameters);

            // 記錄工具執行結果
            await aiOutputLogger.logOutput(
              'AgentController',
              `工具 ${name} 執行${toolResult.success ? '成功' : '失敗'}`,
              { 
                toolName: name,
                success: toolResult.success,
                result: toolResult.data,
                error: toolResult.error
              }
            );

            // 將工具結果添加到歷史記錄
            const toolMessage: Message = {
              role: 'tool',
              name: name,
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id,
            };
            history.push(toolMessage);

            this.log(`📊 工具執行結果: ${toolResult.success ? '成功' : '失敗'}`);

            // 如果工具執行失敗，增加重試計數
            if (!toolResult.success) {
              retryCount++;
              if (retryCount >= this.config.maxRetries) {
                this.log(`❌ 工具執行失敗次數過多，停止執行`);
                
                // 記錄失敗退出
                await aiOutputLogger.logError(
                  'AgentController',
                  `工具執行失敗次數過多，停止執行`,
                  { retryCount, maxRetries: this.config.maxRetries, error: toolResult.error }
                );
                
                return `工具執行失敗次數過多，無法繼續處理。錯誤: ${toolResult.error}`;
              }
            } else {
              retryCount = 0; // 成功後重置重試計數
            }

          } catch (error) {
            this.log(`❌ 工具呼叫發生錯誤: ${error}`);
            
            // 記錄工具呼叫錯誤
            await aiOutputLogger.logError(
              'AgentController',
              `工具 ${name} 呼叫發生錯誤: ${error}`,
              { toolName: name, error: error.toString() }
            );
            
            const errorMessage: Message = {
              role: 'tool',
              name: name,
              content: JSON.stringify({
                success: false,
                error: `工具呼叫錯誤: ${error}`,
              }),
              tool_call_id: toolCall.id,
            };
            history.push(errorMessage);
          }
        }

        // 繼續迴圈，讓 LLM 根據工具結果決定下一步

      } catch (error) {
        this.log(`❌ Agent 控制流程發生錯誤: ${error}`);
        return `處理過程中發生錯誤: ${error}`;
      }
    }
  }

  /**
   * 呼叫 LLM 進行推論
   */
  private async callLLM(history: Message[]): Promise<LLMResponse> {
    try {
      // 獲取可用的工具列表
      const availableTools = this.toolRegistry.getAllToolSchemas();
      
      // 呼叫 OpenAI API
      const response = await this.openaiService.createChatCompletion({
        messages: history,
        tools: availableTools,
        tool_choice: 'auto',
        model: 'gpt-4',
        temperature: 0.1,
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('LLM 未回傳有效訊息');
      }

      return {
        content: message.content || '',
        tool_calls: message.tool_calls,
      };

    } catch (error) {
      this.log(`❌ LLM 呼叫失敗: ${error}`);
      throw new Error(`LLM 呼叫失敗: ${error}`);
    }
  }

  /**
   * 執行工具（帶超時保護）
   */
  private async executeToolWithTimeout(
    name: string,
    parameters: any
  ): Promise<ToolResult> {
    return new Promise(async (resolve) => {
      // 設定超時處理
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: `工具 ${name} 執行超時 (${this.config.timeoutMs}ms)`,
        });
      }, this.config.timeoutMs);

      try {
        // 執行工具
        const result = await this.toolRegistry.executeTool(name, parameters);
        clearTimeout(timeout);
        
        resolve({
          success: true,
          data: result,
          message: `工具 ${name} 執行成功`,
        });

      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `工具 ${name} 執行失敗: ${error}`,
        });
      }
    });
  }

  /**
   * 獲取預設系統提示詞
   */
  private getDefaultSystemPrompt(): string {
    const availableTools = this.toolRegistry.getAllToolNames();
    
    return `你是一個自主的 AI 助手，可以使用工具來完成使用者的請求。

可用工具: ${availableTools.join(', ')}

重要規則:
1. 在每次工具呼叫後，你必須觀察結果並決定下一步:
   - 如果有足夠的資訊，直接回答使用者
   - 如果需要更多資訊，呼叫另一個工具
2. 不要預設一直呼叫工具，只在必要時使用
3. 如果工具執行失敗，嘗試用其他方法或告知使用者
4. 保持回應簡潔且有用
5. 使用繁體中文回應`;
  }

  /**
   * 日誌記錄
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      logger.info(`[AgentController] ${message}`);
    }
  }

  /**
   * 快速測試方法
   */
  async quickTest(testMessage: string = "請幫我找出首頁的程式碼長怎樣"): Promise<string> {
    this.log(`🧪 執行快速測試: ${testMessage}`);
    return await this.runAgentController(testMessage);
  }
} 