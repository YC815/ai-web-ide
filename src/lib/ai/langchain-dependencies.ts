// Langchain 依賴管理和配置
// 確保所有必要的 Langchain 套件都正確安裝和配置

/**
 * 所需的 Langchain 套件清單
 * 請確保在 package.json 中安裝這些套件
 */
export const REQUIRED_LANGCHAIN_PACKAGES = {
  core: [
    "@langchain/core",
    "@langchain/openai", 
    "langchain"
  ],
  memory: [
    "langchain/memory",
    "langchain/vectorstores/memory"
  ],
  agents: [
    "langchain/agents",
    "langchain/tools"
  ],
  chains: [
    "langchain/chains"
  ],
  utils: [
    "langchain/hub",
    "langchain/util/document"
  ]
} as const;

/**
 * 推薦的版本配置
 */
export const RECOMMENDED_VERSIONS = {
  "@langchain/core": "^0.2.0",
  "@langchain/openai": "^0.2.0", 
  "langchain": "^0.2.0"
} as const;

/**
 * 安裝指令
 */
export const INSTALL_COMMANDS = {
  npm: "npm install @langchain/core @langchain/openai langchain",
  yarn: "yarn add @langchain/core @langchain/openai langchain",
  pnpm: "pnpm add @langchain/core @langchain/openai langchain"
} as const;

/**
 * 環境變數配置
 */
export const ENV_VARIABLES = {
  OPENAI_API_KEY: "sk-...", // OpenAI API Key
  LANGCHAIN_TRACING_V2: "true", // 可選，用於 Langchain 追蹤
  LANGCHAIN_PROJECT: "ai-web-ide", // 可選，專案名稱
  LANGCHAIN_ENDPOINT: "https://api.smith.langchain.com", // 可選，Langchain Smith
} as const;

/**
 * 檢查依賴是否已安裝
 */
export async function checkLangchainDependencies(): Promise<{
  installed: boolean;
  missing: string[];
  errors: string[];
}> {
  const missing: string[] = [];
  const errors: string[] = [];

  try {
    // 檢查核心套件
    await import("@langchain/core");
    await import("@langchain/openai");
    await import("langchain");
  } catch (error) {
    missing.push("Core Langchain packages");
    errors.push(`核心套件缺失: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    // 檢查記憶體套件
    await import("langchain/memory");
    await import("langchain/vectorstores/memory");
  } catch (error) {
    missing.push("Memory packages");
    errors.push(`記憶體套件缺失: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    // 檢查代理套件
    await import("langchain/agents");
  } catch (error) {
    missing.push("Agent packages");
    errors.push(`代理套件缺失: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    installed: missing.length === 0,
    missing,
    errors
  };
}

/**
 * Langchain 配置選項
 */
export interface LangchainConfig {
  // OpenAI 配置
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  
  // 記憶體配置
  memory: {
    contextWindow: number;
    maxMemorySize: number;
    enableVectorStore: boolean;
  };
  
  // 代理配置
  agent: {
    maxIterations: number;
    maxRetries: number;
    verbose: boolean;
    earlyStoppingMethod: 'generate' | 'force';
  };
  
  // 追蹤配置
  tracing: {
    enabled: boolean;
    project?: string;
    endpoint?: string;
  };
}

/**
 * 預設 Langchain 配置
 */
export const DEFAULT_LANGCHAIN_CONFIG: LangchainConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o',
    temperature: 0.1,
    maxTokens: 4000
  },
  memory: {
    contextWindow: 20,
    maxMemorySize: 100000, // tokens
    enableVectorStore: true
  },
  agent: {
    maxIterations: 5,
    maxRetries: 3,
    verbose: false,
    earlyStoppingMethod: 'generate'
  },
  tracing: {
    enabled: process.env.LANGCHAIN_TRACING_V2 === 'true',
    project: process.env.LANGCHAIN_PROJECT || 'ai-web-ide',
    endpoint: process.env.LANGCHAIN_ENDPOINT
  }
};

/**
 * 驗證配置
 */
export function validateLangchainConfig(config: Partial<LangchainConfig>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 檢查 OpenAI API Key
  if (!config.openai?.apiKey || !config.openai.apiKey.startsWith('sk-')) {
    errors.push('無效的 OpenAI API Key');
  }

  // 檢查模型名稱
  const validModels = ['gpt-4o', 'gpt-4o-turbo', 'gpt-3.5-turbo'];
  if (config.openai?.model && !validModels.includes(config.openai.model)) {
    warnings.push(`不支援的模型: ${config.openai.model}`);
  }

  // 檢查溫度設定
  if (config.openai?.temperature !== undefined && 
      (config.openai.temperature < 0 || config.openai.temperature > 2)) {
    errors.push('Temperature 必須在 0-2 之間');
  }

  // 檢查記憶體配置
  if (config.memory?.contextWindow !== undefined && config.memory.contextWindow < 1) {
    errors.push('Context window 必須大於 0');
  }

  // 檢查代理配置
  if (config.agent?.maxIterations !== undefined && config.agent.maxIterations < 1) {
    errors.push('Max iterations 必須大於 0');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 建立配置
 */
export function createLangchainConfig(
  apiKey: string, 
  overrides: Partial<LangchainConfig> = {}
): LangchainConfig {
  return {
    ...DEFAULT_LANGCHAIN_CONFIG,
    ...overrides,
    openai: {
      ...DEFAULT_LANGCHAIN_CONFIG.openai,
      ...overrides.openai,
      apiKey
    }
  };
}

/**
 * 安裝指南
 */
export const INSTALLATION_GUIDE = `
# Langchain 聊天引擎安裝指南

## 📦 套件安裝

### 使用 npm
\`\`\`bash
${INSTALL_COMMANDS.npm}
\`\`\`

### 使用 yarn  
\`\`\`bash
${INSTALL_COMMANDS.yarn}
\`\`\`

### 使用 pnpm
\`\`\`bash
${INSTALL_COMMANDS.pnpm}
\`\`\`

## 🔧 環境變數配置

在 .env.local 中添加：

\`\`\`env
# 必要
OPENAI_API_KEY=sk-your-api-key

# 可選 - Langchain 追蹤
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=ai-web-ide
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
\`\`\`

## ✅ 依賴檢查

使用內建的依賴檢查函數：

\`\`\`typescript
import { checkLangchainDependencies } from './langchain-dependencies';

const check = await checkLangchainDependencies();
if (!check.installed) {
  console.error('缺失依賴:', check.missing);
  console.error('錯誤:', check.errors);
}
\`\`\`

## 🚀 快速開始

\`\`\`typescript
import { createLangchainChatEngine } from './langchain-chat-engine';

const engine = createLangchainChatEngine('sk-your-api-key', {
  model: 'gpt-4o',
  temperature: 0.1
});

const response = await engine.processMessage(
  'session-id',
  '創建一個 React 組件',
  { projectId: 'my-project', projectName: 'My App' }
);
\`\`\`
`;

export default {
  REQUIRED_LANGCHAIN_PACKAGES,
  RECOMMENDED_VERSIONS,
  INSTALL_COMMANDS,
  ENV_VARIABLES,
  DEFAULT_LANGCHAIN_CONFIG,
  checkLangchainDependencies,
  validateLangchainConfig,
  createLangchainConfig,
  INSTALLATION_GUIDE
}; 