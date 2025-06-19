import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { AIMessage, HumanMessage, SystemMessage, } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder, } from '@langchain/core/prompts';
// TODO: Re-enable Tavily Search once the dependency issue is resolved.
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DockerFileSystemTool, DockerDevServerTool, createDefaultDockerContext, } from '@/lib/docker/tools';
import { getDockerContextByName, normalizeProjectName, } from '@/lib/docker/docker-context-config';
import { logger } from '@/lib/logger';
import { AI_ASSISTANT_NAME } from '@/lib/constants';
const PROMPT_TEMPLATE = `You are a helpful AI assistant named ${AI_ASSISTANT_NAME} who is an expert in web development.
Your primary role is to assist users with their web development projects running inside Docker containers.
You have access to a suite of tools to interact with the user's Docker environment, including file system operations,
starting/stopping development servers, and checking logs.

**IMPORTANT RULES:**
1.  **ALWAYS operate within the user's project context.** All file operations (read, write, list) are sandboxed to their project's Docker container. You don't have access to the host machine.
2.  **NEVER ask for the project name.** The project context is automatically handled. When using file system tools, just provide the relative path inside the container (e.g., 'src/app/page.tsx').
3.  **Be proactive and helpful.** If a user's request is vague, ask for clarification. If you see an error, try to diagnose it using the available tools.
4.  **Security is paramount.** Do not perform any dangerous operations. The tools have built-in security to prevent misuse.

Here is the current conversation history:`;
export async function createLangChainChatEngine(chatHistory, projectName) {
    const messages = chatHistory.map((msg) => msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content));
    const model = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.2,
    });
    // Using a specific type for the tools array to avoid 'any'
    const tools = [
    // new TavilySearchResults({ maxResults: 3 }),
    ];
    if (projectName) {
        try {
            const normalizedName = normalizeProjectName(projectName);
            logger.info(`[ChatEngine] Setting up Docker tools for project: ${projectName} (Normalized: ${normalizedName})`);
            const containerContext = getDockerContextByName(normalizedName);
            if (!containerContext) {
                logger.error(`[ChatEngine] Could not find a running container for project: ${projectName}. Docker tools will not be available.`);
            }
            else {
                const dockerContext = createDefaultDockerContext(containerContext.containerId, containerContext.containerName, projectName);
                logger.info(`[ChatEngine] Docker context created for container ID: ${containerContext.containerId}`);
                const fileSystemTool = new DockerFileSystemTool(dockerContext, projectName);
                const devServerTool = new DockerDevServerTool(dockerContext);
                // LangChain can infer the schema from the function and description.
                // We are wrapping them in a BaseTool-like structure for type safety.
                const dynamicTools = [
                    {
                        name: 'docker_listFiles',
                        description: `List files and directories inside the Docker container for the project '${projectName}'. Use this to explore the project structure. Ex: docker_listFiles({ "dirPath": "src/components" })`,
                        func: (args) => fileSystemTool.listDirectory(args.dirPath, args),
                    },
                    {
                        name: 'docker_readFile',
                        description: `Read the contents of a file inside the Docker container for project '${projectName}'. Ex: docker_readFile({ "filePath": "src/app/page.tsx" })`,
                        func: (args) => fileSystemTool.readFile(args.filePath),
                    },
                    {
                        name: 'docker_writeFile',
                        description: `Write or overwrite a file inside the Docker container for project '${projectName}'. Ex: docker_writeFile({ "filePath": "src/app/page.tsx", "content": "..." })`,
                        func: (args) => fileSystemTool.writeFile(args.filePath, args.content),
                    },
                    {
                        name: 'docker_startDevServer',
                        description: `Starts the development server inside the Docker container for project '${projectName}'.`,
                        func: () => devServerTool.startDevServer(),
                    }
                ];
                tools.push(...dynamicTools); // Use 'as any' to bridge the structural type with BaseTool
                logger.info(`[ChatEngine] Docker tools for project '${projectName}' have been successfully added.`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`[ChatEngine] Failed to initialize Docker tools for project ${projectName}: ${errorMessage}`);
            const dockerErrorTool = {
                name: 'docker_error',
                description: `This tool indicates that there was an error connecting to the Docker environment for project '${projectName}'. Inform the user about the connection failure.`,
                func: () => `Error: Could not connect to the Docker container for project ${projectName}. Please check if the project is running correctly.`,
            };
            tools.push(dockerErrorTool);
        }
    }
    else {
        logger.warn('[ChatEngine] No project name provided. Docker-specific tools are disabled.');
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
        new HumanMessage('{input}'),
        new MessagesPlaceholder('agent_scratchpad'),
    ]);
    const agent = await createOpenAIFunctionsAgent({
        llm: model,
        tools,
        prompt,
    });
    const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: process.env.NODE_ENV === 'development',
    });
    return {
        run: async (input) => {
            const response = await agentExecutor.invoke({
                input,
                chat_history: messages,
            });
            return response.output;
        },
    };
}
