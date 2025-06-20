import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import {
  SystemMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DynamicTool } from '@langchain/core/tools';
import {
  createDefaultDockerContext,
} from '@/lib/docker/tools';
import {
  getDockerContextByName,
  getDockerContextById,
  createDockerContextFromUrl,
  extractProjectFromUrl,
  normalizeProjectName,
} from '@/lib/docker/docker-context-config';
import { logger } from '@/lib/logger';
import { AI_ASSISTANT_NAME } from '@/lib/constants';
import { allTools, executeToolById } from '@/lib/functions';
import { DockerContext } from '@/lib/docker/tools';

// 修復：定義自定義工具介面以匹配我們的工具系統
interface CustomTool {
  id: string;
  schema: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const PROMPT_TEMPLATE = `You are a helpful AI assistant named ${AI_ASSISTANT_NAME} who is an expert in web development.
Your primary role is to assist users with their web development projects running inside Docker containers.
You have access to a suite of tools to interact with the user's Docker environment.

**Core Directives:**
1.  **Goal-Oriented Execution:** Your primary goal is to complete the user's request. Be proactive and autonomous. Use tools to gather information and solve problems.
2.  **Container Sandbox:** All file operations are sandboxed to the user's project Docker container. You CANNOT access the host machine.
3.  **Dynamic Context:** The project context (containerId, projectName, workingDirectory) is automatically handled. When using file tools, you can use relative paths (e.g., 'src/app/page.tsx'), and the system will resolve them.

**CRITICAL BEHAVIORAL RULES - NON-NEGOTIABLE:**
4.  **IMMEDIATE STOP ON SUCCESS:** This is the most important rule. The moment a tool call successfully provides the information the user asked for, you MUST stop.
    *   **After successfully reading a file with \`docker_read_file\` → STOP IMMEDIATELY and output the file content.**
    *   After successfully listing files and finding what you need → STOP and use that information.
    *   After any successful action that completes the user's request → STOP and provide a summary.
5.  **NO REPETITIVE ACTIONS:** Do not call the same tool with the same parameters more than once. If a tool call gives you the information you need, do not call it again. If a tool call fails, analyze the error and try a different approach, do not just repeat the same failed call.
6.  **EFFICIENT TOOL USE:** Each tool call must have a clear purpose. Do not explore the filesystem aimlessly. If you need to find a file, use \`docker_ls\` or \`docker_tree\` on specific directories. If you know the filename, you can try searching for it.

**Example Scenarios:**
-   User asks: "What's in page.tsx?"
    1.  You think: "I need to find and read page.tsx".
    2.  Call \`docker_ls\` on likely directories (e.g., '.', 'src', 'src/app').
    3.  Once you see 'page.tsx' in the output of a \`docker_ls\` call (e.g., in 'src/app'), you know the path is 'src/app/page.tsx'.
    4.  Call \`docker_read_file({ filePath: 'src/app/page.tsx' })\`.
    5.  The tool returns the file content.
    6.  **STOP. Immediately output the content to the user.**

- User asks: "Create a new component."
    1. You create the file with \`docker_write_file\`.
    2. The tool returns success.
    3. **STOP. Immediately confirm to the user that the file has been created.**

Your task is to follow these rules strictly to provide a fast and accurate response.
Here is the current conversation history:`;

/**
 * 專案上下文介面
 */
export interface ProjectContext {
  projectName?: string;
  projectId?: string;
  url?: string;
  containerId?: string;
}

/**
 * 將自定義工具定義轉換為 LangChain 的 DynamicTool
 * @param tool - 自定義工具
 * @param context - 包含 containerId 等資訊的上下文
 * @returns DynamicTool 實例
 */
function toLangChainTool(
  tool: CustomTool,
  context: { containerId: string; projectName?: string; workingDirectory?: string; }
): DynamicTool {
  
  // 為了相容 LangChain Agent，動態將 'path' 參數改名為 'input'
  const toolSchema = { ...tool.schema };
  if (toolSchema.parameters.properties.path && !toolSchema.parameters.properties.input) {
    console.log(`[toLangChainTool] 正在為 ${tool.id} 將 'path' 參數轉換為 'input'...`);
    toolSchema.parameters.properties.input = {
      ...toolSchema.parameters.properties.path,
      description: (toolSchema.parameters.properties.path as { description: string }).description.replace(/path/g, 'input'),
    };
    delete toolSchema.parameters.properties.path;
  }
  
  // 創建 DynamicTool
  return new DynamicTool({
    name: tool.id,
    description: tool.schema.description,
    func: async (args: string) => {
      // 修復：正確處理參數類型
      let processedArgs: Record<string, unknown>;
      
      try {
        console.log(`[Agent Tool] 執行工具: ${tool.id}`, { args });

        // --- 核心參數修正邏輯 ---
        // 確保無論 agent 如何傳參（input, path, 或字串），都能正確處理
        if (typeof args === 'string') {
          try {
            processedArgs = JSON.parse(args);
          } catch {
            processedArgs = { input: args };
          }
        } else {
          processedArgs = args as Record<string, unknown>;
        }
        
        // 統一參數名稱：優先使用正確的參數名稱
        if (processedArgs && (processedArgs.path !== undefined || processedArgs.input !== undefined)) {
          const pathValue = processedArgs.path !== undefined ? processedArgs.path : processedArgs.input;
          
          // 根據工具類型設置正確的參數名稱
          if (tool.id === 'docker_ls' || tool.id === 'docker_tree') {
            processedArgs.path = pathValue;
            delete processedArgs.input; // 移除錯誤的參數名稱
          } else if (tool.id === 'docker_read_file' || tool.id === 'docker_write_file') {
            processedArgs.filePath = pathValue;
            delete processedArgs.input;
            delete processedArgs.path;
          } else if (tool.id === 'docker_list_directory') {
            processedArgs.dirPath = pathValue;
            delete processedArgs.input;
            delete processedArgs.path;
          } else {
            processedArgs.path = pathValue;
          }
        }

        // --- 修復路徑處理 ---
        // 不要強制修改路徑，讓 Docker 工具自己處理相對路徑
        // Docker 工具內部會正確處理工作目錄切換
        console.log(`[Agent Tool] 保持原始路徑參數，讓 Docker 工具處理:`, { 
          toolId: tool.id, 
          originalArgs: processedArgs 
        });
        
        // 如果工具需要 filePath 參數
        if (tool.schema.parameters.properties.filePath && processedArgs && processedArgs.path) {
          processedArgs.filePath = processedArgs.path;
        }

        // 建立增強的上下文
        const enhancedContext = {
          containerId: context.containerId,
          projectName: context.projectName,
        };
        
        const result = await executeToolById(tool.id, processedArgs, enhancedContext);
        
        const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        
        console.log(`[Agent Tool] 工具 ${tool.id} 執行成功`, { output });
        
        return output;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Agent Tool] 工具 ${tool.id} 執行失敗:`, errorMessage);
        return `Error: ${errorMessage}`;
      }
    },
  });
}

export async function createLangChainChatEngine(
  projectContext?: ProjectContext | string,
) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.2,
  });

  // 修復：使用正確的工具類型
  const tools: DynamicTool[] = [];

  let dockerContext: DockerContext | null = null;
  let contextInfo: string = '';

  // 標準化專案上下文
  let normalizedContext: ProjectContext = {};
  if (typeof projectContext === 'string') {
    // 如果是字串，嘗試判斷是 URL 還是專案名稱
    if (projectContext.startsWith('http')) {
      normalizedContext.url = projectContext;
    } else {
      normalizedContext.projectName = projectContext;
    }
  } else if (projectContext) {
    normalizedContext = projectContext;
  }

  logger.info(`[ChatEngine] 開始建立 Docker 上下文: ${JSON.stringify(normalizedContext)}`);

  try {
    // 1. 嘗試從 URL 創建上下文
    if (normalizedContext.url) {
      logger.info(`[ChatEngine] 從 URL 創建 Docker 上下文: ${normalizedContext.url}`);
      dockerContext = await createDockerContextFromUrl(normalizedContext.url);
      const projectId = extractProjectFromUrl(normalizedContext.url);
      contextInfo = `URL: ${normalizedContext.url}, Project ID: ${projectId}`;
    }
    
    // 2. 嘗試從專案 ID 創建上下文
    else if (normalizedContext.projectId) {
      logger.info(`[ChatEngine] 從專案 ID 創建 Docker 上下文: ${normalizedContext.projectId}`);
      dockerContext = await getDockerContextByName(normalizedContext.projectId) ||
                      await getDockerContextById(normalizedContext.projectId);
      contextInfo = `Project ID: ${normalizedContext.projectId}`;
    }
    
    // 3. 嘗試從專案名稱創建上下文
    else if (normalizedContext.projectName) {
      const normalizedName = normalizeProjectName(normalizedContext.projectName);
      logger.info(`[ChatEngine] 從專案名稱創建 Docker 上下文: ${normalizedContext.projectName} (標準化: ${normalizedName})`);
      dockerContext = await getDockerContextByName(normalizedName);
      contextInfo = `Project Name: ${normalizedContext.projectName} (Normalized: ${normalizedName})`;
    }
    
    // 4. 嘗試從容器 ID 創建上下文
    else if (normalizedContext.containerId) {
      logger.info(`[ChatEngine] 從容器 ID 創建 Docker 上下文: ${normalizedContext.containerId}`);
      dockerContext = await getDockerContextById(normalizedContext.containerId);
      contextInfo = `Container ID: ${normalizedContext.containerId}`;
    }
    
    // 5. 如果都沒有提供，使用預設上下文
    else {
      logger.info(`[ChatEngine] 未提供專案上下文，使用預設 Docker 上下文`);
      dockerContext = createDefaultDockerContext('default-container');
      contextInfo = 'Default Docker context';
    }

    if (dockerContext) {
      logger.info(`[ChatEngine] 成功創建 Docker 上下文: ${JSON.stringify({
        containerId: dockerContext.containerId,
        containerName: dockerContext.containerName,
        workingDirectory: dockerContext.workingDirectory,
        status: dockerContext.status,
        contextInfo
      })}`);
    } else {
      logger.error(`[ChatEngine] 無法創建 Docker 上下文，參數: ${JSON.stringify(normalizedContext)}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[ChatEngine] 建立 Docker 上下文時發生錯誤: ${errorMessage} ${JSON.stringify(normalizedContext)}`);
  }

  // 將 allTools 轉換為 LangChain Agent 可以使用的格式
  const formattedTools: DynamicTool[] = allTools.map(tool => toLangChainTool(tool as CustomTool, { 
    containerId: dockerContext?.containerId || '', 
    projectName: dockerContext?.containerName, 
    workingDirectory: dockerContext?.workingDirectory 
  }));

  tools.push(...formattedTools);

  // 如果 Docker 工具初始化失敗，添加一個錯誤提示工具
  if (!dockerContext && (normalizedContext.projectName || normalizedContext.projectId || normalizedContext.url)) {
    const dockerErrorTool = new DynamicTool({
      name: 'docker_connection_error',
      description: `This tool indicates that there was an error connecting to the Docker environment. Context: ${contextInfo}. Attempt to self-diagnose the connection issue before reporting failure.`,
      func: async () => `Error: Could not connect to the Docker container. Context: ${contextInfo}. Please check if the project is running correctly.`,
    });
    tools.push(dockerErrorTool);
  }

  // 創建向量存儲用於知識庫搜尋
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new MemoryVectorStore(embeddings);
  const retriever = vectorStore.asRetriever();
  
  // 修正：使用正確的 DynamicTool 格式
  const searchTool = new DynamicTool({
    name: "search_knowledge_base",
    description: "Search and return relevant information from the knowledge base.",
    func: async (query: string) => {
      const docs = await retriever.getRelevantDocuments(query);
      return docs.map(doc => doc.pageContent).join('\n');
    },
  });
  tools.push(searchTool);

  const prompt = ChatPromptTemplate.fromMessages([
    new SystemMessage(PROMPT_TEMPLATE),
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  // 修復：使用 OpenAI Tools Agent 的標準創建方式
  const agent = await createOpenAIToolsAgent({
    llm: model,
    tools: tools,
    prompt: prompt,
  });

  // 建立 Agent Executor
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true, // 開啟詳細日誌
    maxIterations: 15, // 增加最大迭代次數
    returnIntermediateSteps: true, // 返回中間步驟以供除錯
    handleParsingErrors: true, // 處理潛在的解析錯誤
  });

  console.log('[Agent Executor] 已建立，配置:', {
    verbose: true,
    maxIterations: 15,
    returnIntermediateSteps: true,
  });

  return executor;
}