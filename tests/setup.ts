// 測試環境設置
import { jest } from '@jest/globals';

// 設置測試環境變數
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';

// 全域模擬設置
global.console = {
  ...console,
  // 在測試中靜音某些日誌
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 模擬 Docker 命令
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));

// 模擬檔案系統操作
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

// 設置測試超時
jest.setTimeout(30000);

// 測試前後的清理
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// 全域測試工具
global.testUtils = {
  // 創建模擬的 Docker 上下文
  createMockDockerContext: () => ({
    containerId: 'test-container-id',
    containerName: 'test-container',
    workingDirectory: '/app',
    status: 'running' as const,
  }),
  
  // 創建模擬的專案上下文
  createMockProjectContext: () => ({
    projectId: 'test-project',
    projectName: 'Test Project',
    containerStatus: 'running' as const,
  }),
  
  // 等待異步操作
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 模擬成功回應
  mockSuccessResponse: <T>(data: T) => ({
    success: true,
    data,
    timestamp: new Date(),
    toolName: 'test-tool',
  }),
  
  // 模擬錯誤回應
  mockErrorResponse: (error: string) => ({
    success: false,
    error,
    timestamp: new Date(),
    toolName: 'test-tool',
  }),
};

// TypeScript 類型聲明
declare global {
  var testUtils: {
    createMockDockerContext: () => any;
    createMockProjectContext: () => any;
    waitFor: (ms: number) => Promise<void>;
    mockSuccessResponse: <T>(data: T) => any;
    mockErrorResponse: (error: string) => any;
  };
} 