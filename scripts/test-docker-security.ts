#!/usr/bin/env tsx

/**
 * Docker 安全測試腳本
 * 驗證安全驗證器是否能正確阻止不當的檔案操作
 */

import { dockerSecurityValidator } from '../src/lib/ai/docker-security-validator';
import { createDockerAIEditorManager, createDefaultDockerContext } from '../src/lib/docker';

async function testDockerSecurity() {
  console.log('🔒 開始測試 Docker 安全機制...\n');

  try {
    // 設定測試用的Docker上下文
    const containerId = '41acd88ac05a';
    const dockerContext = createDefaultDockerContext(containerId);
    
    console.log('📦 測試Docker上下文:');
    console.log(`   容器ID: ${dockerContext.containerId}`);
    console.log(`   工作目錄: ${dockerContext.workingDirectory}\n`);

    // 測試1：合法的檔案讀取
    console.log('✅ 測試1：合法的檔案讀取...');
    const legitimateTest = dockerSecurityValidator.validateToolCall(
      'docker_read_file',
      { filePath: 'src/app/page.tsx' },
      dockerContext
    );
    console.log(`   結果: ${legitimateTest.isValid ? '通過' : '失敗'}`);
    if (!legitimateTest.isValid) {
      console.log(`   原因: ${legitimateTest.reason}`);
    }
    console.log('');

    // 測試2：嘗試讀取宿主機檔案
    console.log('🚨 測試2：嘗試讀取宿主機檔案...');
    const hostFileTest = dockerSecurityValidator.validateToolCall(
      'docker_read_file',
      { filePath: '/Users/yushunchen/.z/pr/ai_creator/package.json' },
      dockerContext
    );
    console.log(`   結果: ${hostFileTest.isValid ? '❌ 未被阻止（安全漏洞）' : '✅ 已被阻止'}`);
    if (!hostFileTest.isValid) {
      console.log(`   原因: ${hostFileTest.reason}`);
    }
    console.log('');

    // 測試3：路徑遍歷攻擊
    console.log('🚨 測試3：路徑遍歷攻擊...');
    const pathTraversalTest = dockerSecurityValidator.validateToolCall(
      'docker_read_file',
      { filePath: '../../../etc/passwd' },
      dockerContext
    );
    console.log(`   結果: ${pathTraversalTest.isValid ? '❌ 未被阻止（安全漏洞）' : '✅ 已被阻止'}`);
    if (!pathTraversalTest.isValid) {
      console.log(`   原因: ${pathTraversalTest.reason}`);
    }
    console.log('');

    // 測試4：嘗試訪問敏感系統檔案
    console.log('🚨 測試4：嘗試訪問敏感系統檔案...');
    const sensitiveFileTest = dockerSecurityValidator.validateToolCall(
      'docker_read_file',
      { filePath: '/etc/shadow' },
      dockerContext
    );
    console.log(`   結果: ${sensitiveFileTest.isValid ? '❌ 未被阻止（安全漏洞）' : '✅ 已被阻止'}`);
    if (!sensitiveFileTest.isValid) {
      console.log(`   原因: ${sensitiveFileTest.reason}`);
    }
    console.log('');

    // 測試5：非Docker工具
    console.log('🚨 測試5：非Docker工具...');
    const nonDockerToolTest = dockerSecurityValidator.validateToolCall(
      'read_file',  // 沒有docker_前綴
      { filePath: 'package.json' },
      dockerContext
    );
    console.log(`   結果: ${nonDockerToolTest.isValid ? '❌ 未被阻止（安全漏洞）' : '✅ 已被阻止'}`);
    if (!nonDockerToolTest.isValid) {
      console.log(`   原因: ${nonDockerToolTest.reason}`);
    }
    console.log('');

    // 測試6：未授權的容器ID
    console.log('🚨 測試6：未授權的容器ID...');
    const unauthorizedContext = {
      containerId: 'unauthorized123',
      containerName: 'fake-container',
      workingDirectory: '/app',
      status: 'running' as const,
    };
    const unauthorizedTest = dockerSecurityValidator.validateToolCall(
      'docker_read_file',
      { filePath: 'package.json' },
      unauthorizedContext
    );
    console.log(`   結果: ${unauthorizedTest.isValid ? '❌ 未被阻止（安全漏洞）' : '✅ 已被阻止'}`);
    if (!unauthorizedTest.isValid) {
      console.log(`   原因: ${unauthorizedTest.reason}`);
    }
    console.log('');

    // 獲取安全報告
    console.log('📊 安全報告:');
    const securityReport = dockerSecurityValidator.getSecurityReport();
    console.log(`   允許的容器: ${securityReport.allowedContainers.length} 個`);
    console.log(`   安全級別: ${securityReport.securityLevel}`);
    console.log(`   允許的容器ID: ${securityReport.allowedContainers.join(', ')}`);
    console.log('');

    // 實際測試Docker工具（應該被安全機制保護）
    console.log('🧪 實際測試Docker工具安全機制...');
    const dockerManager = createDockerAIEditorManager({
      dockerContext,
      enableUserConfirmation: false,
      enableActionLogging: true,
    });

    // 嘗試讀取一個可能危險的路徑
    console.log('   嘗試讀取 ../../../package.json...');
    const actualTest = await dockerManager.executeDockerAITool('docker_read_file', {
      filePath: '../../../package.json'
    });
    
    console.log(`   結果: ${actualTest.success ? '❌ 讀取成功（可能的安全問題）' : '✅ 讀取失敗（安全機制生效）'}`);
    if (!actualTest.success) {
      console.log(`   錯誤: ${actualTest.error}`);
    }
    console.log('');

    console.log('🎉 Docker 安全測試完成!');
    console.log('');
    console.log('📝 總結:');
    console.log('   - 所有危險操作都應該被阻止');
    console.log('   - 只有合法的Docker容器內操作應該被允許');
    console.log('   - 安全驗證器正在監控所有工具調用');

  } catch (error) {
    console.error('❌ 安全測試過程中發生錯誤:', error);
  }
}

// 執行測試
if (require.main === module) {
  testDockerSecurity().catch(console.error);
}

export { testDockerSecurity }; 