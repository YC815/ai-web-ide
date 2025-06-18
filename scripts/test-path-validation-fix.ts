#!/usr/bin/env tsx

/**
 * 測試路徑驗證修復效果
 */

import { createDockerAIEditorManager, createDefaultDockerContext } from '../src/lib/docker';
import { createDefaultDockerContext as createToolsDefaultContext } from '../src/lib/docker/tools';
import { DockerSecurityValidator } from '../src/lib/ai/docker-security-validator';

async function testPathValidationFix() {
  console.log('🧪 測試路徑驗證修復效果\n');
  
  const containerId = 'ai-web-ide-new-testing-1750210123230';
  const projectName = 'new-testing';
  
  try {
    // 1. 測試 tools.ts 中的 createDefaultDockerContext
    console.log('1️⃣ 測試 tools.ts 中的 createDefaultDockerContext');
    const toolsContext = createToolsDefaultContext(containerId, `ai-dev-${projectName}`, projectName);
    console.log('✅ Tools Docker Context:', {
      containerId: toolsContext.containerId,
      containerName: toolsContext.containerName,
      workingDirectory: toolsContext.workingDirectory,
      status: toolsContext.status
    });
    
    // 2. 測試 ai-editor-manager.ts 中的 createDefaultDockerContext
    console.log('\n2️⃣ 測試 ai-editor-manager.ts 中的 createDefaultDockerContext');
    const managerContext = createDefaultDockerContext(containerId, `ai-dev-${projectName}`);
    console.log('⚠️ Manager Docker Context:', {
      containerId: managerContext.containerId,
      containerName: managerContext.containerName,
      workingDirectory: managerContext.workingDirectory,
      status: managerContext.status
    });
    
    // 3. 測試 DockerAIEditorManager 的初始化
    console.log('\n3️⃣ 測試 DockerAIEditorManager 初始化');
    const manager = createDockerAIEditorManager({
      dockerContext: toolsContext, // 使用正確的工作目錄
      enableUserConfirmation: false,
      enableActionLogging: true
    });
    
    const initialContext = manager.getDockerContext();
    console.log('✅ 初始 Docker Context:', {
      containerId: initialContext.containerId,
      containerName: initialContext.containerName,
      workingDirectory: initialContext.workingDirectory,
      status: initialContext.status
    });
    
    // 4. 測試安全驗證器
    console.log('\n4️⃣ 測試安全驗證器');
    const securityValidator = DockerSecurityValidator.getInstance();
    securityValidator.setProjectName(projectName);
    
    // 測試不同的路徑
    const testPaths = [
      '.',
      './src',
      'package.json',
      'src/app/page.tsx',
      '/app/workspace/new-testing',
      '/app/workspace/new-testing/package.json',
      '/app/workspace/new-testing/src/app/page.tsx',
      '/app', // 應該被拒絕
      '../', // 應該被拒絕
      '/etc/passwd' // 應該被拒絕
    ];
    
    for (const testPath of testPaths) {
      try {
        const result = securityValidator.validateFilePath(testPath, toolsContext, projectName);
        if (result.isValid) {
          console.log(`✅ 路徑 "${testPath}": 通過驗證`);
        } else {
          console.log(`❌ 路徑 "${testPath}": 驗證失敗 -> ${result.reason}`);
        }
      } catch (error) {
        console.log(`❌ 路徑 "${testPath}": 驗證失敗 -> ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 5. 測試工具執行（模擬）
    console.log('\n5️⃣ 測試工具執行');
    try {
      const listResult = await manager.executeDockerAITool('docker_list_directory', { dirPath: '.' });
      console.log('✅ 列出目錄結果:', {
        success: listResult.success,
        message: listResult.message,
        hasData: !!listResult.data,
        error: listResult.error
      });
    } catch (error) {
      console.log('❌ 工具執行失敗:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    console.log('\n🎉 路徑驗證修復測試完成！');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    process.exit(1);
  }
}

// 執行測試
testPathValidationFix().catch(console.error); 