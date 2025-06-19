import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor } from 'langchain/agents';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
// TODO: Re-enable Tavily Search once the dependency issue is resolved.
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { type BaseTool, DynamicTool } from '@langchain/core/tools';
import {
  DockerFileSystemTool,
  DockerDevServerTool,
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
import { RunnableSequence } from '@langchain/core/runnables';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { OpenAIToolsAgentOutputParser } from 'langchain/agents/openai/output_parser';
import type { AgentStep } from '@langchain/core/agents';
import { formatToOpenAIToolMessages } from 'langchain/agents/format_scratchpad/openai_tools';

const PROMPT_TEMPLATE = `You are a helpful AI assistant named ${AI_ASSISTANT_NAME} who is an expert in web development.
Your primary role is to assist users with their web development projects running inside Docker containers.
You have access to a suite of tools to interact with the user's Docker environment, including file system operations,
starting/stopping development servers, and checking logs.

**IMPORTANT RULES:**
1.  **ALWAYS operate within the user's project context.** All file operations (read, write, list) are sandboxed to their project's Docker container. You don't have access to the host machine.
2.  **NEVER ask for the project name.** The project context is automatically handled. When using file system tools, just provide the relative path inside the container (e.g., 'src/app/page.tsx').
3.  **Be proactive and autonomous.** Your main goal is to complete the user's request. Use your tools to gather all necessary information and solve problems on your own. Do not ask for clarification if you can find the answer with your tools (e.g., use file system tools to understand project structure). If a file path is needed, explore the filesystem to find it. Formulate a plan and execute it to fulfill the user's request.
4.  **Security is paramount.** Do not perform any dangerous operations. The tools have built-in security to prevent misuse.

**CRITICAL COMPLETION RULES:**
5.  **RECOGNIZE WHEN TASKS ARE COMPLETE.** After successfully completing a task (e.g., file created, server started, issue resolved), STOP using tools and provide a clear summary to the user. Do NOT continue exploring or checking unless explicitly asked.
6.  **AVOID REPETITIVE TOOL CALLS.** If you've already checked the server status or listed a directory, don't do it again unless the user asks for an update or there's a clear reason (like after making changes).
7.  **USE TOOLS EFFICIENTLY.** Each tool call should have a clear purpose. If a tool returns "success" or shows the task is complete, consider the task done.
8.  **RESPOND IMMEDIATELY AFTER SUCCESS.** When you see "✅", "success", "created successfully", or "completed" from a tool, that means the task is done - provide a summary response to the user right away.

**SMART STOPPING CONDITIONS:**
- If you've successfully created/modified a file → STOP and confirm completion
- If you've successfully started a server → STOP and provide the server info
- If you've successfully read a file the user asked about → STOP and provide the content
- If a tool returns an error but you've tried reasonable fixes → STOP and report the issue
- If you're checking status repeatedly with no changes → STOP and report current status

**ANTI-LOOP PROTECTION:**
- Never call the same tool with identical parameters more than ONCE in a conversation
- If you get the same result from a tool call → STOP and use that result
- If you've explored the file system enough to answer the user's question → STOP exploring
- If you've already found the information you need → STOP and respond to the user

**IMMEDIATE RESPONSE TRIGGERS:**
- If you've successfully found what the user asked for → RESPOND IMMEDIATELY
- If you've made the change the user requested → RESPOND IMMEDIATELY  
- If you've read the file content the user wants → RESPOND IMMEDIATELY
- If a tool gives you all the information needed → RESPOND IMMEDIATELY

**CRITICAL: AVOID TOOL SPAM**
- Each tool call must have a NEW PURPOSE
- Don't repeat the same directory listing
- Don't check the same file multiple times
- Don't verify things that are already confirmed

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

export async function createLangChainChatEngine(
  projectContext?: ProjectContext | string,
) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.2,
  });

  // Using a specific type for the tools array to avoid 'any'
  const tools: BaseTool[] = [
    // new TavilySearchResults({ maxResults: 3 }),
  ];

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

  logger.info(`[ChatEngine] 開始建立 Docker 上下文:`, normalizedContext);

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
      dockerContext = await createDefaultDockerContext();
      contextInfo = 'Default Docker context';
    }

    if (dockerContext) {
      logger.info(`[ChatEngine] 成功創建 Docker 上下文:`, {
        containerId: dockerContext.containerId,
        containerName: dockerContext.containerName,
        workingDirectory: dockerContext.workingDirectory,
        status: dockerContext.status,
        contextInfo
      });
    } else {
      logger.error(`[ChatEngine] 無法創建 Docker 上下文，參數:`, normalizedContext);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[ChatEngine] 建立 Docker 上下文時發生錯誤: ${errorMessage}`, normalizedContext);
  }

  // 將 allTools 轉換為 LangChain Agent 可以使用的格式
  const formattedTools: BaseTool[] = allTools.map(tool => {
    // 檢查此工具是否需要 Docker 上下文
    const requiresDocker = tool.metadata.category === 'docker' || tool.metadata.tags.includes('docker');
    
    return new DynamicTool({
      name: tool.schema.name,
      description: tool.schema.description,
      // 建立一個執行函數，它會呼叫我們統一的執行器
      func: async (args: any) => {
        console.log(`[Agent Tool] 執行工具: ${tool.schema.name}，原始參數:`, args);
        
        // 處理 LangChain 的參數格式
        let processedArgs = args;
        
        // 如果 args 是字符串，嘗試解析為 JSON
        if (typeof args === 'string') {
          try {
            processedArgs = JSON.parse(args);
          } catch {
            // 如果解析失敗，根據工具類型進行智能處理
            if (tool.schema.name === 'docker_ls' || tool.schema.name === 'docker_tree') {
              processedArgs = { path: args };
            } else if (tool.schema.name === 'docker_read_file') {
              processedArgs = { filePath: args };
            } else {
              processedArgs = { input: args };
            }
          }
        }
        
        // 處理嵌套的 input 結構（LangChain 有時會這樣包裝參數）
        if (processedArgs && typeof processedArgs === 'object' && processedArgs.input && typeof processedArgs.input === 'object') {
          console.log(`[Agent Tool] 檢測到嵌套 input 結構，解包參數`);
          processedArgs = processedArgs.input;
        }
        
        console.log(`[Agent Tool] 處理後參數:`, processedArgs);
        
        // 如果工具需要 Docker 但上下文不存在，則返回錯誤
        if (requiresDocker && !dockerContext) {
          const errorMsg = `Error: Docker context is not available (${contextInfo}). Cannot execute tool '${tool.schema.name}'.`;
          console.error(`[Agent Tool] 執行前錯誤: ${errorMsg}`);
          return errorMsg;
        }
        
        try {
          // 建立增強的上下文，包含更多資訊
          const enhancedContext = dockerContext ? {
            ...dockerContext,
            ...normalizedContext,
            originalContext: normalizedContext
          } : normalizedContext;
          
          // 將增強的 context 傳遞給執行器
          const result = await executeToolById(tool.id, processedArgs, enhancedContext);
          const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          console.log(`[Agent Tool] 工具 ${tool.schema.name} 執行成功，結果長度: ${resultString.length}`);
          
          // LangChain agent 期望返回 string
          return resultString;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Agent Tool] 工具 '${tool.schema.name}' 執行錯誤: ${errorMessage}`);
          logger.error(`Error executing tool '${tool.schema.name}': ${errorMessage}`);
          return `Error: ${errorMessage}`;
        }
      },
    });
  });

  tools.push(...formattedTools);

  // 如果 Docker 工具初始化失敗，添加一個錯誤提示工具
  if (!dockerContext && (normalizedContext.projectName || normalizedContext.projectId || normalizedContext.url)) {
    const dockerErrorTool = {
      name: 'docker_connection_error',
      description: `This tool indicates that there was an error connecting to the Docker environment. Context: ${contextInfo}. Attempt to self-diagnose the connection issue before reporting failure.`,
      func: () => `Error: Could not connect to the Docker container. Context: ${contextInfo}. Please check if the project is running correctly.`,
    };
    tools.push(new DynamicTool(dockerErrorTool));
  }

  // 創建向量存儲用於知識庫搜尋
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = new MemoryVectorStore(embeddings);
  const retriever = vectorStore.asRetriever();
  tools.push(createRetrieverTool(retriever, {
    name: "search_knowledge_base",
    description: "Search and return relevant information from the knowledge base.",
  }));

  const prompt = ChatPromptTemplate.fromMessages([
    new SystemMessage(PROMPT_TEMPLATE),
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const modelWithTools = model.bind({
    tools: tools,
  });

  const agent = RunnableSequence.from([
    {
      input: (i: { input: string; chat_history: BaseMessage[] }) => i.input,
      agent_scratchpad: (i: {
        input: string;
        chat_history: BaseMessage[];
        steps: AgentStep[];
      }) => formatToOpenAIToolMessages(i.steps),
      chat_history: (i: {
        input: string;
        chat_history: BaseMessage[];
        steps: AgentStep[];
      }) => i.chat_history,
    },
    prompt,
    modelWithTools,
    new OpenAIToolsAgentOutputParser(),
  ]).withConfig({ runName: 'OpenAIToolsAgent' });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: process.env.NODE_ENV === 'development',
    maxIterations: 8, // 降低到8次迭代，強制更快完成
    maxExecutionTime: 60000, // 1分鐘執行時間限制
    earlyStoppingMethod: 'force', // 強制停止，避免無限循環
    returnIntermediateSteps: false, // 不返回中間步驟，減少複雜性
  });

  return agentExecutor;
}