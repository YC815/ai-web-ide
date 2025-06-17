/** @type {import('jest').Config} */
const config = {
  // 測試環境
  testEnvironment: "node",

  // TypeScript 支援
  preset: "ts-jest",

  // 根目錄
  rootDir: ".",

  // 測試檔案匹配模式
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.spec.ts"],

  // 模組路徑映射 (修正屬性名稱)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // 設置檔案
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // 覆蓋率配置
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/**/*.d.ts",
    "!src/lib/**/index.ts",
    "!src/lib/**/*.test.ts",
    "!src/lib/**/*.spec.ts",
  ],

  // 覆蓋率閾值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "src/lib/core/": {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // 覆蓋率報告格式
  coverageReporters: ["text", "lcov", "html"],

  // 測試超時
  testTimeout: 30000,

  // 詳細輸出
  verbose: true,

  // 清除模擬
  clearMocks: true,

  // 模擬檔案路徑
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // 轉換配置 (更新 ts-jest 配置方式)
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },

  // 忽略轉換的模組
  transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))"],
};

module.exports = config;
