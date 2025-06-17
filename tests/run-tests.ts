#!/usr/bin/env ts-node

// 測試執行腳本 - 獨立測試 @/lib 中的所有工具
import { spawn } from 'child_process';
import path from 'path';

interface TestSuite {
  name: string;
  description: string;
  testPath: string;
  category: 'core' | 'docker' | 'ai' | 'integration';
  priority: 'high' | 'medium' | 'low';
}

// 定義所有測試套件
const testSuites: TestSuite[] = [
  // Core 模組測試
  {
    name: 'Logger',
    description: '日誌系統功能測試',
    testPath: 'tests/lib/core/logger.test.ts',
    category: 'core',
    priority: 'high'
  },
  {
    name: 'DiffProcessor',
    description: 'Diff 處理器功能測試',
    testPath: 'tests/lib/core/diff-processor.test.ts',
    category: 'core',
    priority: 'high'
  },
  {
    name: 'ToolManager',
    description: '工具管理器功能測試',
    testPath: 'tests/lib/core/tool-manager.test.ts',
    category: 'core',
    priority: 'high'
  },
  
  // Docker 模組測試
  {
    name: 'DockerTools',
    description: 'Docker 工具功能測試',
    testPath: 'tests/lib/docker/tools.test.ts',
    category: 'docker',
    priority: 'high'
  },
  {
    name: 'DockerAIEditor',
    description: 'Docker AI 編輯器測試',
    testPath: 'tests/lib/docker/ai-editor-manager.test.ts',
    category: 'docker',
    priority: 'medium'
  },
  {
    name: 'DockerConfig',
    description: 'Docker 配置管理測試',
    testPath: 'tests/lib/docker/config-manager.test.ts',
    category: 'docker',
    priority: 'medium'
  },
  
  // AI 模組測試
  {
    name: 'AIContextManager',
    description: 'AI 上下文管理器測試',
    testPath: 'tests/lib/ai/context-manager.test.ts',
    category: 'ai',
    priority: 'high'
  },
  {
    name: 'PromptBuilder',
    description: '動態提示詞構建器測試',
    testPath: 'tests/lib/ai/prompt-builder.test.ts',
    category: 'ai',
    priority: 'medium'
  },
  {
    name: 'OpenAIIntegration',
    description: 'OpenAI 整合功能測試',
    testPath: 'tests/lib/ai/openai.test.ts',
    category: 'ai',
    priority: 'low'
  },
  
  // 整合測試
  {
    name: 'LibIntegration',
    description: '整個 @/lib 模組整合測試',
    testPath: 'tests/integration/lib-integration.test.ts',
    category: 'integration',
    priority: 'medium'
  }
];

// 顏色輸出工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// 執行單個測試套件
async function runTestSuite(suite: TestSuite): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    console.log(`\n${colorize('🧪 執行測試:', 'cyan')} ${suite.name} - ${suite.description}`);
    
    const jestProcess = spawn('npx', ['jest', suite.testPath, '--verbose'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    jestProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    jestProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    jestProcess.on('close', (code) => {
      const success = code === 0;
      const result = {
        success,
        output: output + errorOutput
      };

      if (success) {
        console.log(colorize(`✅ ${suite.name} 測試通過`, 'green'));
      } else {
        console.log(colorize(`❌ ${suite.name} 測試失敗 (退出碼: ${code})`, 'red'));
      }

      resolve(result);
    });

    jestProcess.on('error', (error) => {
      console.error(colorize(`❌ 執行 ${suite.name} 測試時發生錯誤: ${error.message}`, 'red'));
      resolve({ success: false, output: error.message });
    });
  });
}

// 執行覆蓋率測試
async function runCoverageTest(): Promise<void> {
  console.log(`\n${colorize('📊 執行覆蓋率測試...', 'magenta')}`);
  
  return new Promise((resolve) => {
    const coverageProcess = spawn('npx', ['jest', '--coverage', '--testPathPattern=tests/lib'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    coverageProcess.on('close', (code) => {
      if (code === 0) {
        console.log(colorize('✅ 覆蓋率測試完成', 'green'));
      } else {
        console.log(colorize(`❌ 覆蓋率測試失敗 (退出碼: ${code})`, 'red'));
      }
      resolve();
    });
  });
}

// 主要測試執行函數
async function runAllTests(): Promise<void> {
  console.log(colorize('🚀 開始執行 @/lib 模組完整測試套件', 'bright'));
  console.log(colorize('=' .repeat(60), 'blue'));

  const results: Array<{ suite: TestSuite; success: boolean; output: string }> = [];
  
  // 按優先級排序測試
  const sortedSuites = testSuites.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // 執行所有測試套件
  for (const suite of sortedSuites) {
    const result = await runTestSuite(suite);
    results.push({ suite, ...result });
    
    // 短暫延遲避免資源競爭
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 執行覆蓋率測試
  await runCoverageTest();

  // 生成測試報告
  generateTestReport(results);
}

// 生成測試報告
function generateTestReport(results: Array<{ suite: TestSuite; success: boolean; output: string }>): void {
  console.log(`\n${colorize('📋 測試報告', 'bright')}`);
  console.log(colorize('=' .repeat(60), 'blue'));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  console.log(`\n${colorize('📊 總體統計:', 'cyan')}`);
  console.log(`   總測試套件: ${totalTests}`);
  console.log(`   ${colorize(`通過: ${passedTests}`, 'green')}`);
  console.log(`   ${colorize(`失敗: ${failedTests}`, failedTests > 0 ? 'red' : 'green')}`);
  console.log(`   成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  // 按類別統計
  const categories = ['core', 'docker', 'ai', 'integration'] as const;
  console.log(`\n${colorize('📂 按類別統計:', 'cyan')}`);
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.suite.category === category);
    const categoryPassed = categoryResults.filter(r => r.success).length;
    const categoryTotal = categoryResults.length;
    
    if (categoryTotal > 0) {
      const status = categoryPassed === categoryTotal ? '✅' : '❌';
      console.log(`   ${status} ${category.toUpperCase()}: ${categoryPassed}/${categoryTotal}`);
    }
  });

  // 失敗的測試詳情
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log(`\n${colorize('❌ 失敗的測試:', 'red')}`);
    failedResults.forEach(result => {
      console.log(`   • ${result.suite.name} (${result.suite.category})`);
      console.log(`     ${result.suite.description}`);
    });
  }

  // 建議
  console.log(`\n${colorize('💡 建議:', 'yellow')}`);
  if (failedTests === 0) {
    console.log('   🎉 所有測試都通過了！@/lib 模組功能正常。');
  } else {
    console.log('   🔧 請檢查失敗的測試並修復相關問題。');
    console.log('   📝 可以使用 npm run test:watch 進行即時測試。');
  }

  console.log(`\n${colorize('🔗 有用的命令:', 'cyan')}`);
  console.log('   npm run test:core     - 只測試核心模組');
  console.log('   npm run test:docker   - 只測試 Docker 模組');
  console.log('   npm run test:ai       - 只測試 AI 模組');
  console.log('   npm run test:coverage - 查看測試覆蓋率');
  console.log('   npm run test:watch    - 監視模式測試');

  console.log(`\n${colorize('=' .repeat(60), 'blue')}`);
  console.log(colorize('測試完成！', 'bright'));
}

// 處理命令行參數
function parseArgs(): { category?: string; suite?: string; coverage?: boolean } {
  const args = process.argv.slice(2);
  const options: { category?: string; suite?: string; coverage?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--category' && args[i + 1]) {
      options.category = args[i + 1];
      i++;
    } else if (arg === '--suite' && args[i + 1]) {
      options.suite = args[i + 1];
      i++;
    } else if (arg === '--coverage') {
      options.coverage = true;
    }
  }

  return options;
}

// 主程序
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    if (options.coverage) {
      await runCoverageTest();
    } else if (options.suite) {
      const suite = testSuites.find(s => s.name.toLowerCase() === options.suite.toLowerCase());
      if (suite) {
        await runTestSuite(suite);
      } else {
        console.error(colorize(`❌ 找不到測試套件: ${options.suite}`, 'red'));
        process.exit(1);
      }
    } else if (options.category) {
      const categoryTests = testSuites.filter(s => s.category === options.category);
      if (categoryTests.length > 0) {
        console.log(colorize(`🧪 執行 ${options.category} 類別測試`, 'cyan'));
        for (const suite of categoryTests) {
          await runTestSuite(suite);
        }
      } else {
        console.error(colorize(`❌ 找不到類別: ${options.category}`, 'red'));
        process.exit(1);
      }
    } else {
      await runAllTests();
    }
  } catch (error) {
    console.error(colorize(`❌ 測試執行失敗: ${error}`, 'red'));
    process.exit(1);
  }
}

// 執行主程序
if (require.main === module) {
  main();
}

export { runAllTests, runTestSuite, testSuites }; 