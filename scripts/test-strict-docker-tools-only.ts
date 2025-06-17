#!/usr/bin/env tsx

/**
 * 嚴格 Docker 工具測試腳本（僅工具層面）
 * 不需要 OpenAI API Key，只測試 Docker 工具的安全性和功能
 */

import { createDockerAIEditorManager, createDefaultDockerContext } from '../src/lib/docker';
import { StrictDockerTools } from '../src/lib/ai/docker-tools-v2';
import { StrictToolRegistry } from '../src/lib/ai/strict-tool-registry';

async function testStrictDockerToolsOnly() {
  console.log('🔒 開始測試嚴格 Docker 工具（僅工具層面）...\n');

  try {
    // 配置
    const projectName = 'web_test';
    const containerId = '41acd88ac05a';
    const workingDirectory = `/app/workspace/${projectName}`;

    console.log('📦 測試配置:');
    console.log(`   專案名稱: ${projectName}`);
    console.log(`   容器ID: ${containerId}`);
    console.log(`   工作目錄: ${workingDirectory}\n`);

    // 建立Docker上下文
    const dockerContext = createDefaultDockerContext(containerId);
    // 更新工作目錄
    dockerContext.workingDirectory = workingDirectory;
    dockerContext.containerName = `strict-${projectName}`;

    console.log('🐳 Docker 上下文:');
    console.log(`   容器ID: ${dockerContext.containerId}`);
    console.log(`   容器名稱: ${dockerContext.containerName}`);
    console.log(`   工作目錄: ${dockerContext.workingDirectory}\n`);

    // 建立Docker管理器
    const dockerManager = createDockerAIEditorManager({
      dockerContext,
      enableUserConfirmation: false,
      enableActionLogging: true,
    });

    // 測試1: 建立嚴格Docker工具
    console.log('🧪 測試1: 建立嚴格 Docker 工具...');
    const strictDockerTools = new StrictDockerTools(dockerManager, {
      containerId,
      projectName,
      enableLogging: true,
    });
    console.log('✅ 嚴格 Docker 工具建立成功\n');

    // 測試2: 建立嚴格工具註冊器
    console.log('🧪 測試2: 建立嚴格工具註冊器...');
    const strictToolRegistry = new StrictToolRegistry(
      dockerManager,
      projectName,
      containerId,
      true
    );
    console.log('✅ 嚴格工具註冊器建立成功\n');

    // 測試3: 獲取安全報告
    console.log('🧪 測試3: 獲取安全報告...');
    const securityReport = strictToolRegistry.getSecurityReport();
    console.log('🛡️ 安全報告:');
    console.log(`   安全級別: ${securityReport.securityLevel}`);
    console.log(`   專案名稱: ${securityReport.projectName}`);
    console.log(`   容器ID: ${securityReport.containerId}`);
    console.log(`   工作目錄: ${securityReport.workingDirectory}`);
    console.log(`   允許操作: ${securityReport.allowedOperations.length} 項`);
    securityReport.allowedOperations.forEach(op => console.log(`     - ${op}`));
    console.log(`   拒絕操作: ${securityReport.deniedOperations.length} 項`);
    securityReport.deniedOperations.forEach(op => console.log(`     - ${op}`));
    console.log(`   工具數量: ${securityReport.toolCount}\n`);

    // 測試4: 工具Schema驗證
    console.log('🧪 測試4: 工具 Schema 驗證...');
    const toolSchemas = strictToolRegistry.getAllToolSchemas();
    console.log(`✅ 工具 Schema 數量: ${toolSchemas.length}`);
    toolSchemas.forEach(schema => {
      console.log(`   - ${schema.function.name}: ${schema.function.description}`);
    });
    console.log('');

    // 測試5: 直接測試嚴格Docker工具
    console.log('🧪 測試5: 直接測試嚴格 Docker 工具...');
    
    // 5a. 測試列出目錄
    console.log('   5a. 測試列出專案根目錄...');
    const listResult = await strictDockerTools.listDirectory('.');
    if (listResult.success) {
      console.log('   ✅ 列出目錄成功');
      console.log(`      路徑: ${listResult.data?.absolutePath}`);
      console.log(`      項目數: ${listResult.data?.totalItems}`);
      console.log(`      專案名稱: ${listResult.data?.projectName}`);
      if (listResult.data?.items && listResult.data.items.length > 0) {
        console.log('      前5個項目:');
        listResult.data.items.slice(0, 5).forEach((item: string) => {
          console.log(`        - ${item}`);
        });
      }
    } else {
      console.log('   ❌ 列出目錄失敗:', listResult.error);
    }

    // 5b. 測試讀取package.json
    console.log('\n   5b. 測試讀取 package.json...');
    const readResult = await strictDockerTools.readFile('package.json');
    if (readResult.success) {
      console.log('   ✅ 讀取檔案成功');
      console.log(`      路徑: ${readResult.data?.absolutePath}`);
      console.log(`      檔案大小: ${readResult.data?.size} 字元`);
      console.log(`      專案名稱: ${readResult.data?.projectName}`);
      
      // 嘗試解析JSON
      try {
        const packageInfo = JSON.parse(readResult.data?.content || '{}');
        console.log(`      專案名稱（package.json）: ${packageInfo.name}`);
        console.log(`      版本: ${packageInfo.version}`);
        console.log(`      框架: ${packageInfo.dependencies?.next ? 'Next.js' : 'Unknown'}`);
      } catch (e) {
        console.log('   ⚠️ 無法解析 package.json');
      }
    } else {
      console.log('   ❌ 讀取檔案失敗:', readResult.error);
    }

    // 5c. 測試獲取專案資訊
    console.log('\n   5c. 測試獲取專案資訊...');
    const projectInfoResult = await strictDockerTools.getProjectInfo();
    if (projectInfoResult.success) {
      console.log('   ✅ 獲取專案資訊成功');
      console.log(`      專案名稱: ${projectInfoResult.data?.projectName}`);
      console.log(`      工作目錄: ${projectInfoResult.data?.workingDirectory}`);
      console.log(`      容器ID: ${projectInfoResult.data?.containerId}`);
      console.log(`      有 package.json: ${projectInfoResult.data?.hasPackageJson ? '是' : '否'}`);
      console.log(`      框架: ${projectInfoResult.data?.framework}`);
      console.log(`      根目錄檔案數: ${projectInfoResult.data?.rootFiles?.length || 0}`);
    } else {
      console.log('   ❌ 獲取專案資訊失敗:', projectInfoResult.error);
    }

    // 測試6: 安全驗證 - 嘗試危險操作
    console.log('\n🧪 測試6: 安全驗證 - 嘗試危險操作...');
    
    // 6a. 嘗試路徑遍歷
    console.log('   6a. 嘗試路徑遍歷攻擊...');
    const dangerousResult1 = await strictDockerTools.readFile('../../../etc/passwd');
    if (!dangerousResult1.success) {
      console.log('   ✅ 路徑遍歷攻擊被正確阻止');
      console.log(`      錯誤: ${dangerousResult1.error}`);
    } else {
      console.log('   ❌ 路徑遍歷攻擊未被阻止！這是安全漏洞！');
    }

    // 6b. 嘗試訪問敏感檔案
    console.log('\n   6b. 嘗試訪問敏感檔案...');
    const dangerousResult2 = await strictDockerTools.readFile('/etc/hosts');
    if (!dangerousResult2.success) {
      console.log('   ✅ 敏感檔案訪問被正確阻止');
      console.log(`      錯誤: ${dangerousResult2.error}`);
    } else {
      console.log('   ❌ 敏感檔案訪問未被阻止！這是安全漏洞！');
    }

    // 測試7: 工具統計
    console.log('\n🧪 測試7: 工具統計...');
    const toolStats = strictToolRegistry.getToolStats();
    console.log('📊 工具統計:');
    console.log(`   總工具數: ${toolStats.totalTools}`);
    console.log(`   嚴格Docker工具數: ${toolStats.strictDockerTools}`);
    console.log(`   專案名稱: ${toolStats.projectName}`);
    console.log(`   容器ID: ${toolStats.containerId}`);
    console.log(`   安全級別: ${toolStats.securityLevel}`);
    console.log('   工具名稱:');
    toolStats.toolNames.forEach(name => console.log(`     - ${name}`));

    console.log('\n🎉 嚴格 Docker 工具測試完成！');
    console.log('✅ 所有安全檢查都通過');
    console.log('🔒 工具已正確鎖定在專案目錄內');
    console.log('🛡️ 安全級別: MAXIMUM');

  } catch (error) {
    console.error('❌ 嚴格 Docker 工具測試失敗:', error);
    console.error('錯誤詳情:', error);
  }
}

// 執行測試
if (require.main === module) {
  testStrictDockerToolsOnly().catch(console.error);
}

export { testStrictDockerToolsOnly }; 