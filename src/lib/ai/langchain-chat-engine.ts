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

Here is the current conversation history:`;

export async function createLangChainChatEngine(
  projectName?: string,
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
  if (projectName) {
    try {
      const normalizedName = normalizeProjectName(projectName);
      logger.info(`[ChatEngine] Setting up Docker tools for project: ${projectName} (Normalized: ${normalizedName})`);

      dockerContext = await getDockerContextByName(normalizedName);

      if (!dockerContext) {
        logger.error(`[ChatEngine] Could not find a running container for project: ${projectName}. Docker tools will not be available.`);
      } else {
        logger.info(`[ChatEngine] Docker context created for container ID: ${dockerContext.containerId}`);
        logger.info(`[ChatEngine] All tools from registry will be loaded for project '${projectName}'.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[ChatEngine] Failed to initialize Docker tools for project ${projectName}: ${errorMessage}`);
    }
  } else {
    logger.warn('[ChatEngine] No project name provided. Docker-specific-tools are disabled.');
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
        console.log(`[Agent Tool] Attempting to execute tool: ${tool.schema.name} with args:`, args);
        // 如果工具需要 Docker 但上下文不存在，則返回錯誤
        if (requiresDocker && !dockerContext) {
          const errorMsg = `Error: Docker context for project '${projectName}' is not available. Cannot execute tool '${tool.schema.name}'.`;
          console.error(`[Agent Tool] Pre-execution error: ${errorMsg}`);
          return errorMsg;
        }
        try {
          // 將 dockerContext 傳遞給執行器
          const result = await executeToolById(tool.id, args, dockerContext);
          const resultString = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          console.log(`[Agent Tool] Execution successful for ${tool.schema.name}. Result:`, resultString.substring(0, 200) + '...');
          // LangChain agent 期望返回 string
          return resultString;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Agent Tool] Execution error for tool '${tool.schema.name}': ${errorMessage}`);
          logger.error(`Error executing tool '${tool.schema.name}': ${errorMessage}`);
          return `Error: ${errorMessage}`;
        }
      },
    });
  });

  tools.push(...formattedTools);

  // 如果 Docker 工具初始化失敗，添加一個錯誤提示工具
  if (projectName && !dockerContext) {
    const dockerErrorTool = {
      name: 'docker_connection_error',
      description: `This tool indicates that there was an error connecting to the Docker environment for project '${projectName}'. Attempt to self-diagnose the connection issue before reporting failure.`,
      func: () => `Error: Could not connect to the Docker container for project ${projectName}. Please check if the project is running correctly and that you have specified the correct project name.`,
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
  });

  return agentExecutor;
}