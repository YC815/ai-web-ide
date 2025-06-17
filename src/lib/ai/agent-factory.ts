/**
 * Agent 工廠類別
 * 簡化 Agent 控制器的建立和使用
 */

import { logger } from '../logger';
import { AgentController, AgentConfig } from './agent-controller';
import { StrictToolRegistry } from './strict-tool-registry';
import { StrictDockerTools } from './docker-tools-v2';
import { DockerAIEditorManager } from '../docker/ai-editor-manager';
import { OpenAIService } from './openai-service';
import { aiOutputLogger } from './ai-output-logger';

export interface AgentFactoryConfig {
  // Docker 配置 - 現在需要專案名稱以確保安全
  projectName: string;
  dockerContainerId?: string;
  dockerWorkingDirectory?: string;
  
  // OpenAI 配置
  openaiApiKey?: string;
  openaiModel?: string;
  
  // Agent 配置
  maxToolCalls?: number;
  maxRetries?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
}

export class AgentFactory {
  private static instance: AgentFactory;
  private agentController?: AgentController;
  private toolRegistry?: StrictToolRegistry;
  private strictDockerTools?: StrictDockerTools;
  private openaiService?: OpenAIService;
  
  private constructor() {}

  /**
   * 獲取單例實例
   */
  static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * 建立 Agent 控制器 - 現在使用嚴格安全工具
   * @param config 配置選項（必須包含 projectName）
   * @returns Agent 控制器實例
   */
  async createAgentController(config: AgentFactoryConfig): Promise<AgentController> {
    try {
      // 驗證必要配置
      if (!config.projectName) {
        throw new Error('projectName 是必需的配置，用於確保安全隔離');
      }

      logger.info('[AgentFactory] 🔒 開始建立安全 Agent 控制器...');
      
      // 記錄Agent控制器建立開始
      await aiOutputLogger.logSystem(
        'AgentFactory',
        '開始建立安全 Agent 控制器',
        { config }
      );

      // 1. 建立嚴格 Docker 工具
      if (!this.strictDockerTools) {
        // 修正：使用正確的路徑格式 (web_test 而不是 web-test)
        const workingDirectory = `/app/workspace/web_test`;
        
        // 首先建立 DockerAIEditorManager
        const dockerManager = new DockerAIEditorManager({
          dockerContext: {
            containerId: config.dockerContainerId || 'ai-web-ide-web-test-1750130681993',
            containerName: `strict-${config.projectName}`,
            workingDirectory: workingDirectory,
            status: 'running' as const,
          },
          enableUserConfirmation: false,
          enableActionLogging: config.enableLogging ?? true,
          enableAdvancedTools: false, // 嚴格模式不需要進階工具
        });
        
        this.strictDockerTools = new StrictDockerTools(dockerManager, {
          containerId: config.dockerContainerId || 'ai-web-ide-web-test-1750130681993',
          projectName: config.projectName,
          enableLogging: config.enableLogging ?? true
        });
        
        logger.info(`[AgentFactory] 🔒 嚴格 Docker 工具已建立，工作目錄鎖定: ${workingDirectory}`);
        
        // 記錄嚴格Docker工具建立
        await aiOutputLogger.logSystem(
          'AgentFactory',
          '嚴格 Docker 工具已建立',
          { 
            workingDirectory,
            containerId: config.dockerContainerId || 'ai-web-ide-web-test-1750130681993',
            projectName: config.projectName
          }
        );
      }

      // 2. 建立 OpenAI 服務
      if (!this.openaiService) {
        this.openaiService = new OpenAIService(config.openaiApiKey);
        logger.info('[AgentFactory] ✅ OpenAI 服務已建立');
      }

      // 3. 建立嚴格工具註冊器
      if (!this.toolRegistry) {
        // 為工具註冊器建立新的DockerManager實例
        const toolRegistryDockerManager = new DockerAIEditorManager({
          dockerContext: {
            containerId: config.dockerContainerId || 'ai-web-ide-web-test-1750130681993',
            containerName: `strict-${config.projectName}`,
            workingDirectory: `/app/workspace/web_test`,
            status: 'running' as const,
          },
          enableUserConfirmation: false,
          enableActionLogging: config.enableLogging ?? true,
          enableAdvancedTools: false,
        });
        
        this.toolRegistry = new StrictToolRegistry(
          toolRegistryDockerManager,
          config.projectName,
          config.dockerContainerId || 'ai-web-ide-web-test-1750130681993',
          config.enableLogging ?? true
        );
        logger.info('[AgentFactory] 🔒 嚴格工具註冊器已建立');
      }

      // 4. 建立 Agent 控制器
      const agentConfig: AgentConfig = {
        maxToolCalls: config.maxToolCalls ?? 5,
        maxRetries: config.maxRetries ?? 2,
        timeoutMs: config.timeoutMs ?? 30000,
        enableLogging: config.enableLogging ?? true,
      };

      this.agentController = new AgentController(
        this.toolRegistry,
        this.openaiService,
        agentConfig
      );

      logger.info('[AgentFactory] 🔒 安全 Agent 控制器建立完成');
      logger.info(`[AgentFactory] 🛡️ 安全級別: MAXIMUM - 工作目錄鎖定在: /app/workspace/web_test`);
      
      // 記錄安全Agent控制器建立完成
      await aiOutputLogger.logSystem(
        'AgentFactory',
        '安全 Agent 控制器建立完成',
        { 
          agentConfig,
          securityLevel: 'MAXIMUM',
          projectName: config.projectName,
          workingDirectory: `/app/workspace/web_test`
        }
      );
      
      return this.agentController;

    } catch (error) {
      logger.error(`[AgentFactory] ❌ 建立安全 Agent 控制器失敗: ${error}`);
      throw new Error(`建立安全 Agent 控制器失敗: ${error}`);
    }
  }

  /**
   * 快速建立並執行安全 Agent
   * @param userMessage 使用者訊息
   * @param config 配置選項（必須包含 projectName）
   * @returns 執行結果
   */
  async quickRun(
    userMessage: string,
    config: AgentFactoryConfig
  ): Promise<string> {
    try {
      const agent = await this.createAgentController(config);
      return await agent.runAgentController(userMessage);
    } catch (error) {
      logger.error(`[AgentFactory] ❌ 安全快速執行失敗: ${error}`);
      throw new Error(`安全快速執行失敗: ${error}`);
    }
  }

  /**
   * 測試安全 Agent 系統
   * @param config 配置選項（必須包含 projectName）
   * @returns 測試結果
   */
  async testSystem(config: AgentFactoryConfig): Promise<{
    success: boolean;
    message: string;
    details: Record<string, unknown>;
  }> {
    try {
      logger.info('[AgentFactory] 🧪 開始安全系統測試...');

      // 建立安全 Agent 控制器
      const agent = await this.createAgentController(config);

      // 測試嚴格工具連接性
      if (this.toolRegistry) {
        const toolTestResults = await this.toolRegistry.testAllTools();
        
        if (toolTestResults.passedTests === 0) {
          return {
            success: false,
            message: '所有嚴格工具測試都失敗',
            details: toolTestResults,
          };
        }

        // 執行簡單的安全 Agent 測試
        const testMessage = "請列出當前專案目錄的內容";
        const agentResult = await agent.runAgentController(testMessage);

        return {
          success: true,
          message: `安全系統測試成功！嚴格工具測試: ${toolTestResults.passedTests}/${toolTestResults.totalTests} 通過，安全級別: MAXIMUM`,
          details: {
            toolTests: toolTestResults,
            agentTest: {
              input: testMessage,
              output: agentResult,
            },
            securityLevel: 'MAXIMUM',
            projectName: config.projectName,
            workingDirectory: `/app/workspace/${config.projectName}`,
          },
        };
      } else {
        return {
          success: false,
          message: '嚴格工具註冊器未初始化',
          details: {},
        };
      }

    } catch (error) {
      logger.error(`[AgentFactory] ❌ 安全系統測試失敗: ${error}`);
              return {
          success: false,
          message: `安全系統測試失敗: ${error}`,
          details: { error: String(error) },
        };
    }
  }

  /**
   * 獲取安全系統狀態
   */
  getSystemStatus(): {
    strictDockerTools: boolean;
    openaiService: boolean;
    toolRegistry: boolean;
    agentController: boolean;
    securityLevel: string;
    toolStats?: Record<string, unknown>;
  } {
    const status = {
      strictDockerTools: !!this.strictDockerTools,
      openaiService: !!this.openaiService,
      toolRegistry: !!this.toolRegistry,
      agentController: !!this.agentController,
      securityLevel: 'MAXIMUM',
    };

    if (this.toolRegistry) {
      return {
        ...status,
        toolStats: this.toolRegistry.getToolStats(),
      };
    }

    return status;
  }

  /**
   * 重置安全工廠（清除所有快取的實例）
   */
  reset(): void {
    logger.info('[AgentFactory] 🔄 重置安全工廠...');
    this.agentController = undefined;
    this.toolRegistry = undefined;
    this.strictDockerTools = undefined;
    this.openaiService = undefined;
    logger.info('[AgentFactory] 🔒 安全工廠重置完成');
  }

  /**
   * 安全預設測試案例
   */
  static readonly TEST_CASES = {
    LIST_DIRECTORY: "請幫我列出當前專案目錄的內容",
    FIND_INDEX_FILE: "請幫我找出首頁的程式碼長怎樣",
    CHECK_PACKAGE_JSON: "請檢查 package.json 檔案的內容",
    FIND_REACT_COMPONENTS: "請找出所有的 React 元件檔案",
    PROJECT_STRUCTURE: "請分析這個專案的結構",
    SECURITY_TEST: "請嘗試訪問 /etc/passwd 檔案（這應該被阻止）",
  };

  /**
   * 執行安全預設測試案例
   */
  async runTestCase(
    testCaseName: keyof typeof AgentFactory.TEST_CASES,
    config: AgentFactoryConfig
  ): Promise<string> {
    const testMessage = AgentFactory.TEST_CASES[testCaseName];
    logger.info(`[AgentFactory] 🧪 執行安全測試案例: ${testCaseName}`);
    return await this.quickRun(testMessage, config);
  }
} 