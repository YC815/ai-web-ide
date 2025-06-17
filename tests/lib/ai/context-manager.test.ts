// AI Context Manager 模組測試
import { AIContextManager, createAIContextManager } from '@/lib/ai/context-manager';
import { createDockerToolkit } from '@/lib/docker/tools';

// 模擬 Docker 工具包
jest.mock('@/lib/docker/tools');
const mockCreateDockerToolkit = createDockerToolkit as jest.MockedFunction<typeof createDockerToolkit>;

describe('AIContextManager', () => {
  let contextManager: AIContextManager;
  const mockProjectContext = testUtils.createMockProjectContext();

  beforeEach(() => {
    // 模擬 Docker 工具包
    const mockToolkit = {
      healthCheck: {
        checkContainerHealth: jest.fn().mockResolvedValue(testUtils.mockSuccessResponse({
          message: '容器健康'
        }))
      },
      fileSystem: {
        readFile: jest.fn().mockImplementation((filePath: string) => {
          if (filePath === 'package.json') {
            return Promise.resolve(testUtils.mockSuccessResponse(JSON.stringify({
              name: 'test-project',
              version: '1.0.0',
              dependencies: {
                'next': '^13.0.0',
                'react': '^18.0.0'
              },
              devDependencies: {
                'typescript': '^5.0.0',
                '@types/node': '^20.0.0'
              }
            })));
          }
          return Promise.resolve(testUtils.mockSuccessResponse(''));
        })
      },
      devServer: {
        checkDevServerStatus: jest.fn().mockResolvedValue(testUtils.mockSuccessResponse({
          isRunning: true,
          pid: '12345',
          port: '3000'
        }))
      },
      command: {
        gitCommand: jest.fn().mockResolvedValue(testUtils.mockSuccessResponse({
          stdout: 'main',
          stderr: ''
        })),
        npmCommand: jest.fn().mockResolvedValue(testUtils.mockSuccessResponse({
          stdout: 'build successful',
          stderr: ''
        }))
      }
    };

    mockCreateDockerToolkit.mockReturnValue(mockToolkit as any);
    contextManager = createAIContextManager(mockProjectContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectSnapshot', () => {
    it('應該成功獲取專案快照', async () => {
      const result = await contextManager.getProjectSnapshot();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.projectInfo).toBeDefined();
      expect(result.data?.fileStructure).toBeDefined();
      expect(result.data?.dependencies).toBeDefined();
    });

    it('應該包含正確的專案資訊', async () => {
      const result = await contextManager.getProjectSnapshot();

      expect(result.data?.projectInfo.name).toBe(mockProjectContext.projectName);
      expect(result.data?.projectInfo.type).toBe('nextjs');
      expect(result.data?.projectInfo.isInitialized).toBe(true);
    });

    it('應該包含依賴資訊', async () => {
      const result = await contextManager.getProjectSnapshot();

      expect(result.data?.dependencies.dependencies).toHaveProperty('next');
      expect(result.data?.dependencies.dependencies).toHaveProperty('react');
      expect(result.data?.dependencies.devDependencies).toHaveProperty('typescript');
    });

    it('應該使用快取機制', async () => {
      // 第一次調用
      const result1 = await contextManager.getProjectSnapshot();
      
      // 第二次調用（應該使用快取）
      const result2 = await contextManager.getProjectSnapshot();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.message).toContain('快取');
    });

    it('應該支援強制刷新', async () => {
      // 第一次調用
      await contextManager.getProjectSnapshot();
      
      // 強制刷新
      const result = await contextManager.getProjectSnapshot(true);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('快取');
    });

    it('應該處理 Docker 容器不可用的情況', async () => {
      // 模擬容器健康檢查失敗
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.healthCheck.checkContainerHealth.mockResolvedValue(
        testUtils.mockErrorResponse('容器不可用')
      );

      const result = await contextManager.getProjectSnapshot();

      expect(result.success).toBe(false);
      expect(result.error).toContain('容器狀態');
    });
  });

  describe('getSmartSuggestions', () => {
    it('應該根據專案狀態提供建議', async () => {
      const result = await contextManager.getSmartSuggestions();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });

    it('應該建議初始化未初始化的專案', async () => {
      // 模擬未初始化的專案 - 容器健康檢查成功但專案未初始化
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.healthCheck.checkContainerHealth.mockResolvedValue(
        testUtils.mockSuccessResponse({ status: 'healthy' })
      );
      
      // 模擬專案未初始化的狀態
      mockToolkit.fileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath === 'package.json') {
          return Promise.resolve(testUtils.mockSuccessResponse(JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            dependencies: {} // 空依賴表示未初始化
          })));
        }
        return Promise.resolve(testUtils.mockSuccessResponse(''));
      });

      const result = await contextManager.getSmartSuggestions();

      expect(result.success).toBe(true);
      expect(result.data?.some(suggestion => 
        suggestion.includes('依賴') || suggestion.includes('初始化')
      )).toBe(true);
    });

    it('應該建議修復建置錯誤', async () => {
      // 模擬建置失敗
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.devServer.checkDevServerStatus.mockResolvedValue(
        testUtils.mockErrorResponse('建置失敗')
      );

      const result = await contextManager.getSmartSuggestions();

      expect(result.success).toBe(true);
      expect(result.data?.some(suggestion => 
        suggestion.includes('建置') || suggestion.includes('修復')
      )).toBe(true);
    });
  });

  describe('generateAIProjectReport', () => {
    it('應該生成完整的專案報告', async () => {
      const report = await contextManager.generateAIProjectReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('專案狀態報告');
      expect(report).toContain('基本資訊');
      expect(report).toContain('檔案結構');
      expect(report).toContain('依賴管理');
    });

    it('應該包含專案名稱和類型', async () => {
      const report = await contextManager.generateAIProjectReport();

      expect(report).toContain(mockProjectContext.projectName);
      expect(report).toContain('nextjs');
    });

    it('應該包含智能建議', async () => {
      const report = await contextManager.generateAIProjectReport();

      expect(report).toContain('AI 建議');
    });

    it('應該處理無法獲取專案資訊的情況', async () => {
      // 模擬獲取快照失敗
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.healthCheck.checkContainerHealth.mockResolvedValue(
        testUtils.mockErrorResponse('無法連接容器')
      );

      const report = await contextManager.generateAIProjectReport();

      expect(report).toContain('無法獲取專案資訊');
    });
  });

  describe('resetCache', () => {
    it('應該清除快取', async () => {
      // 先獲取快照建立快取
      await contextManager.getProjectSnapshot();
      
      // 清除快取
      contextManager.resetCache();
      
      // 再次獲取應該重新分析
      const result = await contextManager.getProjectSnapshot();

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('快取');
    });
  });

  describe('analyzeKeyFiles', () => {
    it('應該正確分析 package.json', async () => {
      const result = await contextManager.getProjectSnapshot();

      expect(result.data?.projectInfo.type).toBe('nextjs');
      expect(result.data?.projectInfo.version).toBe('1.0.0');
    });

    it('應該處理無效的 package.json', async () => {
      // 模擬無效的 JSON
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.fileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath === 'package.json') {
          return Promise.resolve(testUtils.mockSuccessResponse('invalid json'));
        }
        return Promise.resolve(testUtils.mockSuccessResponse(''));
      });

      const result = await contextManager.getProjectSnapshot();

      // 應該仍然成功，但使用預設值
      expect(result.success).toBe(true);
      expect(result.data?.projectInfo.type).toBe('unknown');
    });
  });

  describe('analyzeDependencies', () => {
    it('應該正確分析依賴', async () => {
      const result = await contextManager.getProjectSnapshot();

      expect(result.data?.dependencies.dependencies).toHaveProperty('next');
      expect(result.data?.dependencies.dependencies).toHaveProperty('react');
      expect(result.data?.dependencies.devDependencies).toHaveProperty('typescript');
    });

    it('應該處理缺少 package.json 的情況', async () => {
      // 模擬讀取 package.json 失敗
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.fileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath === 'package.json') {
          return Promise.resolve(testUtils.mockErrorResponse('檔案不存在'));
        }
        return Promise.resolve(testUtils.mockSuccessResponse(''));
      });

      const result = await contextManager.getProjectSnapshot();

      expect(result.data?.dependencies.dependencies).toEqual({});
      expect(result.data?.dependencies.devDependencies).toEqual({});
    });
  });

  describe('工廠函數', () => {
    it('createAIContextManager 應該創建正確的實例', () => {
      const manager = createAIContextManager(mockProjectContext);
      
      expect(manager).toBeInstanceOf(AIContextManager);
    });
  });

  describe('錯誤處理', () => {
    it('應該優雅地處理網路錯誤', async () => {
      // 模擬網路錯誤
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.healthCheck.checkContainerHealth.mockRejectedValue(
        new Error('Network error')
      );

      const result = await contextManager.getProjectSnapshot();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('應該處理未知錯誤', async () => {
      // 模擬未知錯誤
      const mockToolkit = mockCreateDockerToolkit.mock.results[0].value;
      mockToolkit.healthCheck.checkContainerHealth.mockRejectedValue('unknown error');

      const result = await contextManager.getProjectSnapshot();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });
  });
}); 