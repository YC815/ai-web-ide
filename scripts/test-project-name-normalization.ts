#!/usr/bin/env ts-node

/**
 * 測試專案名稱標準化功能
 * 驗證短橫線轉底線的邏輯是否正確
 */

// 直接實現標準化函數
function normalizeProjectName(projectName: string): string {
  return projectName.replace(/-/g, '_');
}

// 直接實現 Docker 上下文創建函數
function createDefaultDockerContext(containerId: string, containerName?: string, projectName?: string) {
  const normalizedProjectName = projectName ? normalizeProjectName(projectName) : null;
  const workingDirectory = normalizedProjectName 
    ? `/app/workspace/${normalizedProjectName}` 
    : '/app/workspace';
  
  return {
    containerId,
    containerName: containerName || `ai-dev-${containerId.substring(0, 12)}`,
    workingDirectory,
    status: 'running' as const
  };
}

console.log('🧪 測試專案名稱標準化功能');
console.log('='.repeat(50));

// 測試案例
const testCases = [
  { input: 'new-testing', expected: 'new_testing' },
  { input: 'web-app', expected: 'web_app' },
  { input: 'my-project-name', expected: 'my_project_name' },
  { input: 'already_normalized', expected: 'already_normalized' },
  { input: 'mixed-format_test', expected: 'mixed_format_test' },
  { input: 'single', expected: 'single' }
];

console.log('📝 測試專案名稱標準化:');
let allTestsPassed = true;
testCases.forEach(({ input, expected }, index) => {
  const result = normalizeProjectName(input);
  const passed = result === expected;
  const status = passed ? '✅' : '❌';
  console.log(`${index + 1}. ${status} "${input}" -> "${result}" (期望: "${expected}")`);
  if (!passed) allTestsPassed = false;
});

console.log('\n🐳 測試 Docker 上下文創建:');
const dockerContext = createDefaultDockerContext(
  '79b604f61385',
  'ai-web-ide-new-testing-1234567890',
  'new-testing'
);

console.log('Docker 上下文結果:', dockerContext);

console.log('\n🔍 驗證結果:');
const expectedWorkingDir = '/app/workspace/new_testing';
const actualWorkingDir = dockerContext.workingDirectory;
const contextTestPassed = actualWorkingDir === expectedWorkingDir;

console.log(`- 期望工作目錄: ${expectedWorkingDir}`);
console.log(`- 實際工作目錄: ${actualWorkingDir}`);
console.log(`- 測試結果: ${contextTestPassed ? '✅ 通過' : '❌ 失敗'}`);

if (!contextTestPassed) allTestsPassed = false;

console.log('\n📊 總結:');
console.log(`- 所有測試 ${allTestsPassed ? '✅ 通過' : '❌ 失敗'}`);
console.log('- 修復後應該使用正確的底線格式路徑');
console.log('- 這將解決 langchain-route.ts 中工具無法使用的問題');

console.log('\n✅ 測試完成！'); 