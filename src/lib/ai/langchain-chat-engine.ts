import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
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

const DYNAMIC_PROMPT_TEMPLATE = `You are a helpful AI assistant named ${AI_ASSISTANT_NAME} who is an expert in web development.
Your primary role is to assist users with their web development projects running inside Docker containers.
You have access to a suite of tools to interact with the user's Docker environment.

**Current Project Context:**
- Project Name: {project_name}
- Container ID: {container_id}
- Working Directory: {working_directory}

**Core Directives:**
1.  **Goal-Oriented Execution:** Your primary goal is to complete the user's request. Be proactive and autonomous. Use tools to gather information and solve problems.
2.  **Container Sandbox:** All file operations are sandboxed to the user's project Docker container. You CANNOT access the host machine.
3.  **Dynamic Context:** The project context above is automatically handled. When using file tools, you can use relative paths (e.g., 'src/app/page.tsx'), and the system will resolve them within the working directory.

**CRITICAL BEHAVIORAL RULES - NON-NEGOTIABLE:**
4.  **IMMEDIATE STOP ON SUCCESS:** This is the most important rule. The moment a tool call successfully provides the information the user asked for, you MUST stop.
    *   After successfully reading a file with \`docker_read_file\` → STOP IMMEDIATELY and output the file content.
    *   After successfully listing files and finding what you need → STOP and use that information.
    *   After any successful action that completes the user's request → STOP and provide a summary.
5.  **NO REPETITIVE ACTIONS:** Do not call the same tool with the same parameters more than once. If a tool call gives you the information you need, do not call it again. If a tool call fails, analyze the error and try a different approach, do not just repeat the same failed call.
6.  **EFFICIENT TOOL USE:** Each tool call must have a clear purpose. Do not explore the filesystem aimlessly. If you need to find a file, use \`docker_ls\` or \`docker_tree\` on specific directories. If you know the filename, you can try searching for it.
`;

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
  
  // 使用原始的工具 schema，不進行參數名稱轉換
  const toolSchema = { ...tool.schema };
  
  // 創建 DynamicTool
  return new DynamicTool({
    name: tool.id,
    description: tool.schema.description,
    func: async (args: any) => { // 接受任何類型的參數
      let processedArgs: Record<string, unknown>;
      
      try {
        // 增強日誌：記錄收到的原始參數
        console.log(`[Agent Tool] RAW ARGS for ${tool.id}:`, { args, type: typeof args });

        if (typeof args === 'string') {
          try {
            processedArgs = JSON.parse(args);
            console.log(`[Agent Tool] Parsed args from string:`, processedArgs);
          } catch (e) {
            console.error(`[Agent Tool] JSON.parse failed for args string:`, args, e);
            // 解析失敗時的降級處理
            if (tool.id === 'docker_read_file' || tool.id === 'docker_write_file') {
              processedArgs = { filePath: args };
            } else {
              processedArgs = { path: args };
            }
          }
        } else {
          processedArgs = args as Record<string, unknown>;
          console.log(`[Agent Tool] Args is already an object:`, processedArgs);
        }
        
        console.log(`[Agent Tool] BEFORE transformation:`, JSON.parse(JSON.stringify(processedArgs)));
        
        // --- 關鍵修復：統一處理名為 'input' 的不正確參數 ---
        if (processedArgs.input !== undefined) {
          const inputValue = processedArgs.input;
          console.log(`[Agent Tool] 偵測到 'input' 參數，值類型: ${typeof inputValue}`);

          if (tool.id === 'docker_write_file') {
            // === Docker Write File 的特殊處理邏輯 ===
            console.log(`[docker_write_file] 開始處理 input 參數: ${JSON.stringify(inputValue)}`);
            
            // 情況1：input 是檔案路徑（短字串，包含副檔名）
            if (typeof inputValue === 'string' && 
                inputValue.length < 200 && 
                inputValue.match(/\.(tsx?|jsx?|css|html|md|json|js|ts)$/i)) {
              
              console.log(`[docker_write_file] 將 input 識別為檔案路徑: ${inputValue}`);
              processedArgs.filePath = inputValue;
              delete processedArgs.input; // 移除 input 參數
              
              // 如果沒有 content 參數，這是錯誤的
              if (!processedArgs.content) {
                console.error(`[docker_write_file] 錯誤：檔案路徑在 input 中，但缺少 content 參數`);
                throw new Error('參數錯誤：當 input 是檔案路徑時，必須提供 content 參數');
              }
            }
            
            // 情況2：input 是檔案內容（長字串，包含程式碼特徵）
            else if (typeof inputValue === 'string' && 
                     (inputValue.length > 100 || 
                      inputValue.includes('import ') || 
                      inputValue.includes('export ') ||
                      inputValue.includes('function ') ||
                      inputValue.includes('<') ||
                      inputValue.includes('{'))) {
              
              console.log(`[docker_write_file] 將 input 識別為檔案內容，長度: ${inputValue.length}`);
              processedArgs.content = inputValue;
              delete processedArgs.input; // 移除 input 參數
              
              // 確保有 filePath
              if (!processedArgs.filePath) {
                console.error(`[docker_write_file] 錯誤：檔案內容在 input 中，但缺少 filePath 參數`);
                throw new Error('參數錯誤：當 input 是檔案內容時，必須提供 filePath 參數');
              }
            }
            
            // 情況3：無法識別的 input 格式
            else {
              console.warn(`[docker_write_file] 無法自動識別 input 參數格式，保持原樣: ${typeof inputValue}`);
              // 不刪除 input，讓後端函數處理
            }
            
            console.log(`[docker_write_file] 處理後參數:`, {
              filePath: processedArgs.filePath,
              content: processedArgs.content ? `內容長度: ${processedArgs.content.length}` : '無',
              input: processedArgs.input ? `input長度: ${processedArgs.input.length}` : '已移除'
            });
          }
          
          // 其他工具的 input 處理邏輯保持不變
          else if (tool.id === 'docker_read_file') {
            if (typeof inputValue === 'string') {
              processedArgs.filePath = inputValue;
              delete processedArgs.input;
              console.log(`[Agent Tool] 將 'input' 映射為 'filePath' (docker_read_file): ${inputValue}`);
            }
          } else if (tool.id === 'docker_ls') {
            if (typeof inputValue === 'string') {
              processedArgs.path = inputValue;
              delete processedArgs.input;
              console.log(`[Agent Tool] 將 'input' 映射為 'path' (docker_ls): ${inputValue}`);
            }
          } else {
            console.log(`[Agent Tool] 工具 ${tool.id} 不支援 'input' 參數，保持原樣`);
          }
        }

        console.log(`[Agent Tool] AFTER transformation:`, JSON.parse(JSON.stringify(processedArgs)));
        
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
      dockerContext = await createDefaultDockerContext();
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

  // 安全地處理 dockerContext 可能為 null 的情況
  const systemPrompt = DYNAMIC_PROMPT_TEMPLATE
    .replace('{project_name}', dockerContext?.containerName || 'Unknown')
    .replace('{container_id}', dockerContext?.containerId?.substring(0, 12) || 'Unknown')
    .replace('{working_directory}', dockerContext?.workingDirectory || '/app');

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
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
    dockerContext: dockerContext ? {
      containerId: dockerContext.containerId,
      containerName: dockerContext.containerName,
      workingDirectory: dockerContext.workingDirectory
    } : 'null'
  });

  return executor;
}