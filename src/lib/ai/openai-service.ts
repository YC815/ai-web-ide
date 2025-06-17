/**
 * OpenAI 服務類別
 * 為 Agent 控制框架提供 OpenAI API 呼叫功能
 */

import OpenAI from 'openai';
import { logger } from '../logger';
import { aiOutputLogger } from './ai-output-logger';

export interface ChatCompletionRequest {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  tool_choice?: 'auto' | 'none' | 'required' | OpenAI.Chat.Completions.ChatCompletionNamedToolChoice;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  choices: {
    message: {
      content: string | null;
      tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
      role: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIService {
  private openai: OpenAI;
  private defaultModel: string = 'gpt-4';

  constructor(apiKey?: string) {
    // 從環境變數或參數獲取 API Key
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API Key 未設定。請提供 API Key 或設定 OPENAI_API_KEY 環境變數。');
    }

    this.openai = new OpenAI({ 
      apiKey: key,
    });

    logger.info('[OpenAIService] OpenAI 服務已初始化');
  }

  /**
   * 建立聊天完成請求
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const startTime = Date.now();
      
      // 過濾和轉換訊息格式，確保 content 不是 null
      const cleanedMessages = request.messages.map(msg => {
        // 確保 content 是字串
        if (msg.content === null || msg.content === undefined) {
          return { ...msg, content: '' };
        }
        return msg;
      });
      
      logger.info('[OpenAIService] 發送聊天完成請求', {
        model: request.model || this.defaultModel,
        messageCount: cleanedMessages.length,
        hasTools: !!request.tools && request.tools.length > 0,
        toolCount: request.tools?.length || 0,
      });

      // 記錄OpenAI請求
      await aiOutputLogger.logDecision(
        'OpenAIService',
        `發送聊天完成請求`,
        {
          model: request.model || this.defaultModel,
          messageCount: cleanedMessages.length,
          hasTools: !!request.tools && request.tools.length > 0,
          toolCount: request.tools?.length || 0,
          temperature: request.temperature || 0.1
        }
      );

      const response = await this.openai.chat.completions.create({
        model: request.model || this.defaultModel,
        messages: cleanedMessages,
        tools: request.tools,
        tool_choice: request.tool_choice || 'auto',
        temperature: request.temperature || 0.1,
        max_tokens: request.max_tokens,
      });

      const executionTime = Date.now() - startTime;
      
      logger.info('[OpenAIService] 聊天完成請求成功', {
        executionTime: `${executionTime}ms`,
        finishReason: response.choices[0]?.finish_reason,
        hasToolCalls: !!response.choices[0]?.message.tool_calls,
        toolCallCount: response.choices[0]?.message.tool_calls?.length || 0,
        usage: response.usage,
      });

      // 記錄OpenAI回應
      await aiOutputLogger.logOutput(
        'OpenAIService',
        `OpenAI 回應: ${response.choices[0]?.message.content || '無內容'}`,
        {
          executionTime: `${executionTime}ms`,
          finishReason: response.choices[0]?.finish_reason,
          hasToolCalls: !!response.choices[0]?.message.tool_calls,
          toolCallCount: response.choices[0]?.message.tool_calls?.length || 0,
          usage: response.usage
        }
      );

      return response as ChatCompletionResponse;

    } catch (error) {
      logger.error('[OpenAIService] 聊天完成請求失敗', error);
      
      if (error instanceof Error) {
        // 處理常見的 OpenAI API 錯誤
        if (error.message.includes('401')) {
          throw new Error('OpenAI API Key 無效。請檢查您的 API Key 是否正確。');
        } else if (error.message.includes('429')) {
          throw new Error('OpenAI API 請求頻率限制。請稍後再試。');
        } else if (error.message.includes('500')) {
          throw new Error('OpenAI API 伺服器錯誤。請稍後再試。');
        } else if (error.message.includes('400') && error.message.includes('content')) {
          throw new Error('OpenAI API 請求格式錯誤。訊息內容不能為空。');
        }
      }
      
      throw new Error(`OpenAI API 請求失敗: ${error}`);
    }
  }

  /**
   * 設定預設模型
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
    logger.info('[OpenAIService] 預設模型已更新', { model });
  }

  /**
   * 獲取預設模型
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * 驗證 API Key 是否有效
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      logger.error('[OpenAIService] API Key 驗證失敗', error);
      return false;
    }
  }

  /**
   * 獲取可用的模型列表
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.openai.models.list();
      return response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      logger.error('[OpenAIService] 獲取模型列表失敗', error);
      return [this.defaultModel];
    }
  }
} 