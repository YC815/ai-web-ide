// AI 編輯器使用範例
// 這個檔案展示如何使用 AI 編輯器工具進行各種操作

import { createAIEditorManager, AIEditorConfig } from './ai-editor-manager';
import { getFunctionDefinitionsForOpenAI } from './ai-function-schemas';

// 🎯 基本使用範例
export async function basicUsageExample() {
  // 1. 創建 AI 編輯器配置
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableAdvancedTools: true,
    enableUserConfirmation: true,
    enableActionLogging: true
  };

  // 2. 創建 AI 編輯器管理器
  const aiEditor = createAIEditorManager(config);

  // 3. 讀取檔案
  const fileContent = await aiEditor.executeAITool('read_file', {
    path: 'src/components/Button.tsx'
  });

  if (fileContent.success) {
    console.log('檔案內容:', fileContent.data);
  }

  // 4. 列出檔案
  const fileList = await aiEditor.executeAITool('list_files', {
    dir: 'src/components',
    glob: '*.tsx'
  });

  if (fileList.success) {
    console.log('組件檔案:', fileList.data);
  }

  // 5. 搜尋代碼
  const searchResults = await aiEditor.executeAITool('search_code', {
    keyword: 'useState'
  });

  if (searchResults.success) {
    console.log('搜尋結果:', searchResults.data);
  }

  // 6. 獲取專案上下文
  const projectContext = await aiEditor.executeAITool('get_project_context', {});

  if (projectContext.success) {
    console.log('專案結構:', projectContext.data);
  }
}

// 🔧 進階使用範例 - 代碼修改流程
export async function codeModificationExample() {
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableUserConfirmation: true,
    enableActionLogging: true
  };

  const aiEditor = createAIEditorManager(config);

  // 1. 讀取要修改的檔案
  const originalFile = await aiEditor.executeAITool('read_file', {
    path: 'src/components/Button.tsx'
  });

  if (!originalFile.success || !originalFile.data) {
    console.error('無法讀取檔案');
    return;
  }

  // 2. 提議代碼修改
  const diffProposal = await aiEditor.executeAITool('propose_diff', {
    path: 'src/components/Button.tsx',
    original: originalFile.data,
    instruction: '添加 loading 狀態支持，包含 loading prop 和 spinner 圖標'
  });

  if (diffProposal.success) {
    console.log('代碼修改提議:', diffProposal.data);
    
    // 如果啟用了用戶確認，這裡會等待用戶確認
    if (diffProposal.requiresConfirmation) {
      console.log('等待用戶確認...');
      // 用戶確認會通過 aiEditor.handleUserConfirmation() 處理
    }
  }

  // 3. 執行測試
  const testResult = await aiEditor.executeAITool('test_file', {
    path: 'src/components/Button.test.tsx'
  });

  if (testResult.success) {
    console.log('測試結果:', testResult.data);
  }
}

// 🚀 與 OpenAI API 整合範例
export async function openAIIntegrationExample() {
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableAdvancedTools: true,
    enableUserConfirmation: true
  };

  const aiEditor = createAIEditorManager(config);

  // 獲取 OpenAI function 定義
  const functionDefinitions = aiEditor.getFunctionDefinitionsForOpenAI();

  // 模擬 OpenAI API 調用
  const openAIRequest = {
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `你是一個 AI 編程助手。你可以使用以下工具來幫助用戶編輯代碼：
        - read_file: 讀取檔案內容
        - list_files: 列出檔案清單
        - search_code: 搜尋代碼
        - propose_diff: 提議代碼修改
        - run_command: 執行命令
        - ask_user: 與用戶互動
        
        請根據用戶的需求選擇合適的工具。`
      },
      {
        role: 'user',
        content: '請幫我在 Button 組件中添加 loading 狀態支持'
      }
    ],
    functions: functionDefinitions,
    function_call: 'auto'
  };

  console.log('OpenAI 請求配置:', JSON.stringify(openAIRequest, null, 2));

  // 模擬 AI 回應處理
  const mockAIResponse = {
    function_call: {
      name: 'read_file',
      arguments: JSON.stringify({ path: 'src/components/Button.tsx' })
    }
  };

  // 執行 AI 建議的工具調用
  if (mockAIResponse.function_call) {
    const toolName = mockAIResponse.function_call.name as any;
    const parameters = JSON.parse(mockAIResponse.function_call.arguments);
    
    const result = await aiEditor.executeAITool(toolName, parameters);
    console.log('工具執行結果:', result);
  }
}

// 📊 監控和日誌範例
export async function monitoringExample() {
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableActionLogging: true
  };

  const aiEditor = createAIEditorManager(config);

  // 執行一些操作
  await aiEditor.executeAITool('read_file', { path: 'package.json' });
  await aiEditor.executeAITool('list_files', { dir: 'src' });
  await aiEditor.executeAITool('search_code', { keyword: 'export' });

  // 獲取操作日誌
  const logs = aiEditor.getActionLogs(10);
  console.log('最近 10 條操作日誌:', logs);

  // 獲取待處理的操作
  const pendingActions = aiEditor.getPendingActions();
  console.log('待處理操作:', pendingActions);
}

// 🔒 安全性範例
export async function securityExample() {
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableUserConfirmation: true // 啟用用戶確認以提高安全性
  };

  const aiEditor = createAIEditorManager(config);

  // 嘗試執行安全命令
  const safeCommand = await aiEditor.executeAITool('run_command', {
    cmd: 'npm install lodash'
  });

  console.log('安全命令結果:', safeCommand);

  // 嘗試執行危險命令（會被阻止）
  const dangerousCommand = await aiEditor.executeAITool('run_command', {
    cmd: 'rm -rf /'
  });

  console.log('危險命令結果:', dangerousCommand); // 應該返回錯誤

  // 嘗試存取不安全路徑（會被阻止）
  const unsafePath = await aiEditor.executeAITool('read_file', {
    path: '../../../etc/passwd'
  });

  console.log('不安全路徑結果:', unsafePath); // 應該返回錯誤
}

// 🎨 用戶確認界面範例
export function userConfirmationUIExample() {
  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableUserConfirmation: true
  };

  const aiEditor = createAIEditorManager(config);

  // 模擬用戶確認處理
  const handleUserConfirmation = async (actionId: string, confirmed: boolean, data?: any) => {
    await aiEditor.handleUserConfirmation(actionId, confirmed, data);
    console.log(`操作 ${actionId} ${confirmed ? '已確認' : '已取消'}`);
  };

  // 在實際應用中，這些會通過 UI 組件觸發
  // 例如：
  // <ConfirmationDialog 
  //   onConfirm={(actionId) => handleUserConfirmation(actionId, true)}
  //   onCancel={(actionId) => handleUserConfirmation(actionId, false)}
  // />

  return { handleUserConfirmation };
}

// 📝 完整工作流程範例
export async function completeWorkflowExample() {
  console.log('🚀 開始 AI 編輯器完整工作流程範例');

  const config: AIEditorConfig = {
    projectPath: '/path/to/project',
    projectContext: {
      projectId: 'my-project-123',
      projectName: 'My Next.js App',
      containerStatus: 'running'
    },
    enableAdvancedTools: true,
    enableUserConfirmation: true,
    enableActionLogging: true
  };

  const aiEditor = createAIEditorManager(config);

  try {
    // 1. 獲取專案概覽
    console.log('📊 獲取專案概覽...');
    const projectContext = await aiEditor.executeAITool('get_project_context', {});
    console.log('專案結構:', projectContext.data);

    // 2. 搜尋需要修改的組件
    console.log('🔍 搜尋 Button 組件...');
    const searchResults = await aiEditor.executeAITool('search_code', {
      keyword: 'Button'
    });
    console.log('搜尋結果:', searchResults.data?.slice(0, 3)); // 只顯示前 3 個結果

    // 3. 讀取組件檔案
    console.log('📖 讀取 Button 組件...');
    const buttonFile = await aiEditor.executeAITool('read_file', {
      path: 'src/components/Button.tsx'
    });

    if (buttonFile.success) {
      // 4. 提議修改
      console.log('✏️ 提議代碼修改...');
      const diffProposal = await aiEditor.executeAITool('propose_diff', {
        path: 'src/components/Button.tsx',
        original: buttonFile.data!,
        instruction: '添加 loading 狀態支持，包含 loading prop 和 spinner 圖標'
      });

      if (diffProposal.success) {
        console.log('修改提議已生成，等待用戶確認...');
      }
    }

    // 5. 執行測試
    console.log('🧪 執行測試...');
    const testResult = await aiEditor.executeAITool('run_command', {
      cmd: 'npm test Button'
    });

    if (testResult.success) {
      console.log('測試執行完成');
    }

    // 6. 檢查 Git 狀態
    console.log('📋 檢查 Git 狀態...');
    const gitDiff = await aiEditor.executeAITool('get_git_diff', {});
    console.log('Git diff:', gitDiff.data?.substring(0, 200) + '...');

    // 7. 獲取操作日誌
    console.log('📝 獲取操作日誌...');
    const logs = aiEditor.getActionLogs(5);
    console.log('最近操作:', logs.map(log => `${log.action} - ${log.result}`));

  } catch (error) {
    console.error('工作流程執行失敗:', error);
  }

  console.log('✅ AI 編輯器工作流程範例完成');
}

// 導出所有範例
export const examples = {
  basicUsage: basicUsageExample,
  codeModification: codeModificationExample,
  openAIIntegration: openAIIntegrationExample,
  monitoring: monitoringExample,
  security: securityExample,
  userConfirmationUI: userConfirmationUIExample,
  completeWorkflow: completeWorkflowExample
}; 