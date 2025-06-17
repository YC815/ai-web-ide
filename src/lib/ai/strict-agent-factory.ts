/**
 * 嚴格 Agent 工廠類別
 * 只使用嚴格限制在 Docker 容器內 /app/workspace/[project-name] 的工具
 * 完全替換原有的Agent工廠，確保無法訪問宿主機檔案
 */

import { logger } from '../logger';
import { AgentController, AgentConfig } from './agent-controller';
import { StrictToolRegistry } from './strict-tool-registry';
import { DockerAIEditorManager, DockerAIEditorConfig } from '../docker/ai-editor-manager';
import { OpenAIService } from './openai-service';
import { aiOutputLogger } from './ai-output-logger';

export interface StrictAgentFactoryConfig {
  // 專案配置（必要）
  projectName: string;
  dockerContainerId: string;
  
  // OpenAI 配置
  openaiApiKey?: string;
  openaiModel?: string;
  
  // Agent 配置
  maxToolCalls?: number;
  maxRetries?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
}

export class StrictAgentFactory {
  private static instance: StrictAgentFactory;
  private agentController?: AgentController;
  private strictToolRegistry?: StrictToolRegistry;
  private dockerManager?: DockerAIEditorManager;
  private openaiService?: OpenAIService;
  
  private constructor() {}

  /**
   * 獲取單例實例
   */
  static getInstance(): StrictAgentFactory {
    if (!StrictAgentFactory.instance) {
      StrictAgentFactory.instance = new StrictAgentFactory();
    }
    return StrictAgentFactory.instance;
  }

  /**
   * 建立嚴格的 Agent 控制器
   * @param config 配置選項
   * @returns Agent 控制器實例
   */
  async createStrictAgentController(config: StrictAgentFactoryConfig): Promise<AgentController> {
    try {
      logger.info('[StrictAgentFactory] 🔒 開始建立嚴格 Agent 控制器...');
      
      // 驗證必要配置
      if (!config.projectName || !config.dockerContainerId) {
        throw new Error('projectName 和 dockerContainerId 是必要的配置');
      }
      
      // 記錄嚴格Agent控制器建立開始
      await aiOutputLogger.logSystem(
        'StrictAgentFactory',
        '開始建立嚴格 Agent 控制器',
        { 
          config,
          securityLevel: 'MAXIMUM',
          workingDirectory: `/app/workspace/${config.projectName}`
        }
      );

      // 1. 建立嚴格的 Docker 管理器
      if (!this.dockerManager) {
        const dockerConfig: DockerAIEditorConfig = {
          dockerContext: {
            containerId: config.dockerContainerId,
            containerName: `strict-${config.projectName}`,
            workingDirectory: `/app/workspace/${config.projectName}`,
            status: 'running' as const,
          },
          enableUserConfirmation: false,
          enableActionLogging: config.enableLogging ?? true,
          enableAdvancedTools: false, // 嚴格模式下關閉進階工具
        };
        
        this.dockerManager = new DockerAIEditorManager(dockerConfig);
        logger.info('[StrictAgentFactory] ✅ 嚴格 Docker 管理器已建立');
        
        // 記錄Docker管理器建立
        await aiOutputLogger.logSystem(
          'StrictAgentFactory',
          '嚴格 Docker 管理器已建立',
          { dockerConfig, securityLevel: 'MAXIMUM' }
        );
      }

      // 2. 建立 OpenAI 服務
      if (!this.openaiService) {
        this.openaiService = new OpenAIService(config.openaiApiKey);
        logger.info('[StrictAgentFactory] ✅ OpenAI 服務已建立');
      }

      // 3. 建立嚴格工具註冊器
      if (!this.strictToolRegistry) {
        this.strictToolRegistry = new StrictToolRegistry(
          this.dockerManager,
          config.projectName,
          config.dockerContainerId,
          config.enableLogging ?? true
        );
        logger.info('[StrictAgentFactory] ✅ 嚴格工具註冊器已建立');
        
        // 記錄安全報告
        const securityReport = this.strictToolRegistry.getSecurityReport();
        await aiOutputLogger.logSystem(
          'StrictAgentFactory',
          '嚴格工具註冊器已建立',
          { securityReport }
        );
      }

      // 4. 建立 Agent 控制器
      const agentConfig: AgentConfig = {
        maxToolCalls: config.maxToolCalls ?? 3, // 降低最大工具調用次數
        maxRetries: config.maxRetries ?? 1,     // 降低重試次數
        timeoutMs: config.timeoutMs ?? 20000,   // 降低超時時間
        enableLogging: config.enableLogging ?? true,
      };

      this.agentController = new AgentController(
        this.strictToolRegistry,
        this.openaiService,
        agentConfig
      );

      logger.info('[StrictAgentFactory] ✅ 嚴格 Agent 控制器建立完成');
      
      // 記錄Agent控制器建立完成
      await aiOutputLogger.logSystem(
        'StrictAgentFactory',
        '嚴格 Agent 控制器建立完成',
        { 
          agentConfig,
          projectName: config.projectName,
          securityLevel: 'MAXIMUM'
        }
      );
      
      return this.agentController;

    } catch (error) {
      logger.error(`[StrictAgentFactory] ❌ 建立嚴格 Agent 控制器失敗: ${error}`);
      await aiOutputLogger.logError(
        'StrictAgentFactory',
        `建立嚴格 Agent 控制器失敗: ${error}`,
        { config, error: String(error) }
      );
      throw new Error(`建立嚴格 Agent 控制器失敗: ${error}`);
    }
  }

  /**
   * 快速建立並執行嚴格 Agent
   * @param userMessage 使用者訊息
   * @param config 配置選項
   * @returns 執行結果
   */
  async quickStrictRun(
    userMessage: string,
    config: StrictAgentFactoryConfig
  ): Promise<string> {
    try {
      const agent = await this.createStrictAgentController(config);
      
      // 記錄執行開始
      await aiOutputLogger.logDecision(
        'StrictAgentFactory',
        '開始執行嚴格模式 Agent',
        { 
          userMessage,
          projectName: config.projectName,
          securityLevel: 'MAXIMUM'
        }
      );
      
      const result = await agent.runAgentController(userMessage);
      
      // 記錄執行完成
      await aiOutputLogger.logOutput(
        'StrictAgentFactory',
        '嚴格模式 Agent 執行完成',
        { 
          userMessage,
          resultLength: result.length,
          projectName: config.projectName
        }
      );
      
      return result;
    } catch (error) {
      logger.error(`[StrictAgentFactory] ❌ 嚴格快速執行失敗: ${error}`);
      await aiOutputLogger.logError(
        'StrictAgentFactory',
        `嚴格快速執行失敗: ${error}`,
        { userMessage, config, error: String(error) }
      );
      throw new Error(`嚴格快速執行失敗: ${error}`);
    }
  }

  /**
   * 測試嚴格 Agent 系統
   * @param config 配置選項
   * @returns 測試結果
   */
  async testStrictSystem(config: StrictAgentFactoryConfig): Promise<{
    success: boolean;
    message: string;
    details: Record<string, unknown>;
  }> {
    try {
      logger.info('[StrictAgentFactory] 🧪 開始嚴格系統測試...');

      // 建立嚴格 Agent 控制器
      const agent = await this.createStrictAgentController(config);

      // 測試嚴格工具連接性
      if (this.strictToolRegistry) {
        const toolTestResults = await this.strictToolRegistry.testAllTools();
        
        if (toolTestResults.passedTests === 0) {
          return {
            success: false,
            message: '所有嚴格工具測試都失敗',
            details: toolTestResults,
          };
        }

        // 執行嚴格的 Agent 測試
        const testMessage = `請列出專案 ${config.projectName} 的根目錄內容`;
        const agentResult = await agent.runAgentController(testMessage);

        // 獲取安全報告
        const securityReport = this.strictToolRegistry.getSecurityReport();

        return {
          success: true,
          message: `嚴格系統測試成功！工具測試: ${toolTestResults.passedTests}/${toolTestResults.totalTests} 通過`,
          details: {
            toolTests: toolTestResults,
            securityReport: securityReport,
            agentTest: {
              input: testMessage,
              output: agentResult,
            },
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
      logger.error(`[StrictAgentFactory] ❌ 嚴格系統測試失敗: ${error}`);
      return {
        success: false,
        message: `嚴格系統測試失敗: ${error}`,
        details: { error: String(error) },
      };
    }
  }

  /**
   * 獲取嚴格系統狀態
   */
  getStrictSystemStatus(): {
    dockerManager: boolean;
    openaiService: boolean;
    strictToolRegistry: boolean;
    agentController: boolean;
    securityLevel: 'MAXIMUM';
    projectInfo?: {
      projectName: string;
      containerId: string;
      workingDirectory: string;
    };
    toolStats?: Record<string, unknown>;
  } {
    const status = {
      dockerManager: !!this.dockerManager,
      openaiService: !!this.openaiService,
      strictToolRegistry: !!this.strictToolRegistry,
      agentController: !!this.agentController,
      securityLevel: 'MAXIMUM' as const,
    };

    if (this.strictToolRegistry) {
      const toolStats = this.strictToolRegistry.getToolStats();
      const securityReport = this.strictToolRegistry.getSecurityReport();
      
      return {
        ...status,
        projectInfo: {
          projectName: securityReport.projectName,
          containerId: securityReport.containerId,
          workingDirectory: securityReport.workingDirectory,
        },
        toolStats: toolStats,
      };
    }

    return status;
  }

  /**
   * 重置嚴格工廠（清除所有快取的實例）
   */
  reset(): void {
    logger.info('[StrictAgentFactory] 🔄 重置嚴格工廠...');
    this.agentController = undefined;
    this.strictToolRegistry = undefined;
    this.dockerManager = undefined;
    this.openaiService = undefined;
    logger.info('[StrictAgentFactory] ✅ 嚴格工廠重置完成');
  }

  /**
   * 嚴格測試案例
   */
  static readonly STRICT_TEST_CASES = {
    LIST_PROJECT_ROOT: "請列出專案根目錄的內容",
    READ_PACKAGE_JSON: "請讀取 package.json 檔案的內容",
    GET_PROJECT_INFO: "請獲取專案的基本資訊",
    FIND_REACT_FILES: "請找出所有的 .tsx 檔案",
    CHECK_SRC_STRUCTURE: "請檢查 src 目錄的結構",
  };

  /**
   * 執行嚴格測試案例
   */
  async runStrictTestCase(
    testCaseName: keyof typeof StrictAgentFactory.STRICT_TEST_CASES,
    config: StrictAgentFactoryConfig
  ): Promise<string> {
    const testMessage = StrictAgentFactory.STRICT_TEST_CASES[testCaseName];
    logger.info(`[StrictAgentFactory] 🧪 執行嚴格測試案例: ${testCaseName}`);
    
    await aiOutputLogger.logDecision(
      'StrictAgentFactory',
      `執行嚴格測試案例: ${testCaseName}`,
      { testMessage, projectName: config.projectName }
    );
    
    return await this.quickStrictRun(testMessage, config);
  }
} 