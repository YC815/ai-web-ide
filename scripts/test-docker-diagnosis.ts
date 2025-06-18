#!/usr/bin/env tsx

/**
 * Docker 容器診斷測試腳本
 * 用於深入診斷容器內部結構和權限問題
 */

import { execSync } from 'child_process';

const CONTAINER_ID = 'ai-web-ide-test-docker-and-web-1750149771879';

interface TestResult {
  name: string;
  success: boolean;
  output: string;
  error?: string;
}

function runTest(name: string, command: string): TestResult {
  console.log(`\n🔍 執行測試: ${name}`);
  console.log(`📝 命令: ${command}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      timeout: 10000,
      stdio: 'pipe'
    });
    
    console.log(`✅ 成功`);
    console.log(`📄 輸出:\n${output}`);
    
    return {
      name,
      success: true,
      output: output.trim()
    };
  } catch (error: any) {
    console.log(`❌ 失敗`);
    console.log(`🚨 錯誤: ${error.message}`);
    if (error.stdout) console.log(`📄 stdout: ${error.stdout}`);
    if (error.stderr) console.log(`📄 stderr: ${error.stderr}`);
    
    return {
      name,
      success: false,
      output: error.stdout || '',
      error: error.message
    };
  }
}

async function main() {
  console.log('🐳 Docker 容器診斷測試開始');
  console.log(`🎯 目標容器: ${CONTAINER_ID}`);
  
  const tests: TestResult[] = [];
  
  // 基本容器信息
  tests.push(runTest(
    '容器狀態檢查',
    `docker inspect ${CONTAINER_ID} --format="{{.State.Status}}"`
  ));
  
  tests.push(runTest(
    '容器基本信息',
    `docker inspect ${CONTAINER_ID} --format="Name: {{.Name}}, Image: {{.Config.Image}}, Created: {{.Created}}"`
  ));
  
  // 掛載點檢查
  tests.push(runTest(
    '掛載點信息',
    `docker inspect ${CONTAINER_ID} --format="{{range .Mounts}}Source: {{.Source}}, Destination: {{.Destination}}, Type: {{.Type}}{{end}}"`
  ));
  
  // 工作目錄檢查
  tests.push(runTest(
    '當前工作目錄',
    `docker exec ${CONTAINER_ID} pwd`
  ));
  
  tests.push(runTest(
    '用戶信息',
    `docker exec ${CONTAINER_ID} whoami`
  ));
  
  tests.push(runTest(
    '用戶 ID 信息',
    `docker exec ${CONTAINER_ID} id`
  ));
  
  // 目錄結構檢查 - 使用多種方式
  tests.push(runTest(
    '根目錄列表 (ls)',
    `docker exec ${CONTAINER_ID} ls -la /`
  ));
  
  tests.push(runTest(
    '根目錄列表 (ls 簡單)',
    `docker exec ${CONTAINER_ID} ls /`
  ));
  
  tests.push(runTest(
    'app 目錄檢查 (絕對路徑)',
    `docker exec ${CONTAINER_ID} ls -la /app`
  ));
  
  tests.push(runTest(
    'app 目錄檢查 (cd 方式)',
    `docker exec ${CONTAINER_ID} sh -c "cd /app && ls -la"`
  ));
  
  tests.push(runTest(
    'app 目錄檢查 (相對路徑)',
    `docker exec ${CONTAINER_ID} sh -c "cd app && ls -la"`
  ));
  
  tests.push(runTest(
    'workspace 目錄檢查 (絕對路徑)',
    `docker exec ${CONTAINER_ID} ls -la /app/workspace`
  ));
  
  tests.push(runTest(
    'workspace 目錄檢查 (cd 方式)',
    `docker exec ${CONTAINER_ID} sh -c "cd /app/workspace && ls -la"`
  ));
  
  tests.push(runTest(
    'workspace 目錄檢查 (雙 cd)',
    `docker exec ${CONTAINER_ID} sh -c "cd app && cd workspace && ls -la"`
  ));
  
  // 權限檢查
  tests.push(runTest(
    'app 目錄權限',
    `docker exec ${CONTAINER_ID} stat /app`
  ));
  
  tests.push(runTest(
    'workspace 目錄權限',
    `docker exec ${CONTAINER_ID} stat /app/workspace`
  ));
  
  // 查找文件
  tests.push(runTest(
    '查找所有目錄',
    `docker exec ${CONTAINER_ID} find /app -type d`
  ));
  
  tests.push(runTest(
    '查找所有文件',
    `docker exec ${CONTAINER_ID} find /app -type f | head -20`
  ));
  
  tests.push(runTest(
    '查找 package.json (全系統)',
    `docker exec ${CONTAINER_ID} find / -name "package.json" -type f 2>/dev/null | head -10`
  ));
  
  tests.push(runTest(
    '查找 Next.js 相關文件',
    `docker exec ${CONTAINER_ID} find /app -name "next.config.*" -o -name ".next" 2>/dev/null`
  ));
  
  // 嘗試不同的 shell
  tests.push(runTest(
    '使用 bash 檢查',
    `docker exec ${CONTAINER_ID} bash -c "cd /app/workspace && ls -la"`
  ));
  
  tests.push(runTest(
    '使用 sh 檢查',
    `docker exec ${CONTAINER_ID} sh -c "cd /app/workspace && ls -la"`
  ));
  
  // 環境變量
  tests.push(runTest(
    '環境變量',
    `docker exec ${CONTAINER_ID} env | sort`
  ));
  
  // 進程檢查
  tests.push(runTest(
    '運行中的進程',
    `docker exec ${CONTAINER_ID} ps aux`
  ));
  
  // 嘗試手動創建測試文件
  tests.push(runTest(
    '創建測試文件',
    `docker exec ${CONTAINER_ID} sh -c "echo 'test' > /app/workspace/test.txt"`
  ));
  
  tests.push(runTest(
    '檢查測試文件',
    `docker exec ${CONTAINER_ID} ls -la /app/workspace/`
  ));
  
  tests.push(runTest(
    '讀取測試文件',
    `docker exec ${CONTAINER_ID} cat /app/workspace/test.txt`
  ));
  
  // 嘗試直接檢查已知的專案目錄
  tests.push(runTest(
    '直接檢查 new_testing (絕對路徑)',
    `docker exec ${CONTAINER_ID} ls -la /app/workspace/new_testing`
  ));
  
  tests.push(runTest(
    '直接檢查 new_testing (相對路徑)',
    `docker exec ${CONTAINER_ID} sh -c "cd /app/workspace && ls -la new_testing"`
  ));
  
  // 總結報告
  console.log('\n' + '='.repeat(80));
  console.log('📊 測試總結報告');
  console.log('='.repeat(80));
  
  const successCount = tests.filter(t => t.success).length;
  const failCount = tests.filter(t => !t.success).length;
  
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失敗: ${failCount}`);
  console.log(`📊 總計: ${tests.length}`);
  
  console.log('\n🔍 關鍵發現:');
  
  // 分析關鍵結果
  const workspaceTests = tests.filter(t => t.name.includes('workspace'));
  const hasWorkspaceContent = workspaceTests.some(t => t.success && t.output.includes('new_testing'));
  
  if (hasWorkspaceContent) {
    console.log('✅ 在某些測試中找到了 workspace 內容');
  } else {
    console.log('❌ 所有測試都沒有找到 workspace 內容');
  }
  
  const mountTest = tests.find(t => t.name === '掛載點信息');
  if (mountTest && mountTest.success) {
    console.log(`🔗 掛載信息: ${mountTest.output}`);
  }
  
  const permissionTests = tests.filter(t => t.name.includes('權限'));
  permissionTests.forEach(test => {
    if (test.success) {
      console.log(`🔐 ${test.name}: ${test.output.split('\n')[0]}`);
    }
  });
  
  console.log('\n💡 建議:');
  if (!hasWorkspaceContent) {
    console.log('1. 檢查 Docker 掛載配置是否正確');
    console.log('2. 確認容器創建時的掛載點設置');
    console.log('3. 檢查主機端的目錄是否存在內容');
    console.log('4. 考慮重新創建容器');
  }
  
  console.log('\n🐳 Docker 容器診斷測試完成');
}

// 直接運行主函數
main().catch(console.error); 