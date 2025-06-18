/**
 * 網路相關 OpenAI Function Call 定義
 */

import { 
  FunctionDefinition, 
  ToolCategory, 
  FunctionAccessLevel 
} from '../types';
import type { OpenAIFunctionSchema } from '../categories';

// HTTP 請求
export const networkHttpRequest: FunctionDefinition = {
  id: 'network_http_request',
  schema: {
    name: 'network_http_request',
    description: '發送 HTTP 請求',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '請求的 URL'
        },
        method: {
          type: 'string',
          description: 'HTTP 方法',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          default: 'GET'
        },
        headers: {
          type: 'string',
          description: '請求標頭（JSON 格式）'
        },
        body: {
          type: 'string',
          description: '請求主體'
        },
        timeout: {
          type: 'number',
          description: '超時時間（毫秒）',
          default: 10000
        }
      },
      required: ['url']
    }
  },
  metadata: {
    category: ToolCategory.NETWORK,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['network', 'http', 'request'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { 
    url: string; 
    method?: string; 
    headers?: string; 
    body?: string; 
    timeout?: number;
  }) => {
    try {
      // 實現 HTTP 請求邏輯
      return {
        success: true,
        data: {
          url: parameters.url,
          method: parameters.method || 'GET',
          status: 200,
          response: 'Mock response'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `HTTP 請求失敗: ${error}`
      };
    }
  }
};

// 網域解析
export const networkDnsLookup: FunctionDefinition = {
  id: 'network_dns_lookup',
  schema: {
    name: 'network_dns_lookup',
    description: '執行 DNS 查詢',
    parameters: {
      type: 'object',
      properties: {
        hostname: {
          type: 'string',
          description: '要查詢的主機名稱'
        },
        recordType: {
          type: 'string',
          description: 'DNS 記錄類型',
          enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'],
          default: 'A'
        }
      },
      required: ['hostname']
    }
  },
  metadata: {
    category: ToolCategory.NETWORK,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['network', 'dns', 'lookup'],
    rateLimited: true,
    maxCallsPerMinute: 60
  },
  handler: async (parameters: { hostname: string; recordType?: string }) => {
    try {
      // 實現 DNS 查詢邏輯
      return {
        success: true,
        data: {
          hostname: parameters.hostname,
          recordType: parameters.recordType || 'A',
          records: ['127.0.0.1'] // Mock data
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `DNS 查詢失敗: ${error}`
      };
    }
  }
};

// 網路連線測試
export const networkPing: FunctionDefinition = {
  id: 'network_ping',
  schema: {
    name: 'network_ping',
    description: '測試網路連線',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: '要測試的主機地址'
        },
        count: {
          type: 'number',
          description: 'Ping 次數',
          default: 4
        },
        timeout: {
          type: 'number',
          description: '超時時間（毫秒）',
          default: 5000
        }
      },
      required: ['host']
    }
  },
  metadata: {
    category: ToolCategory.NETWORK,
    accessLevel: FunctionAccessLevel.PUBLIC,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['network', 'ping', 'connectivity'],
    rateLimited: true,
    maxCallsPerMinute: 30
  },
  handler: async (parameters: { host: string; count?: number; timeout?: number }) => {
    try {
      // 實現 Ping 邏輯
      return {
        success: true,
        data: {
          host: parameters.host,
          count: parameters.count || 4,
          packetsTransmitted: 4,
          packetsReceived: 4,
          packetLoss: 0,
          averageTime: 25.5
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Ping 測試失敗: ${error}`
      };
    }
  }
};

// 埠號掃描
export const networkPortScan: FunctionDefinition = {
  id: 'network_port_scan',
  schema: {
    name: 'network_port_scan',
    description: '掃描主機的開放埠號',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: '要掃描的主機地址'
        },
        ports: {
          type: 'string',
          description: '要掃描的埠號範圍（如: 80,443,8080-8090）'
        },
        timeout: {
          type: 'number',
          description: '每個埠號的超時時間（毫秒）',
          default: 3000
        }
      },
      required: ['host', 'ports']
    }
  },
  metadata: {
    category: ToolCategory.NETWORK,
    accessLevel: FunctionAccessLevel.RESTRICTED,
    version: '1.0.0',
    author: 'AI Creator Team',
    tags: ['network', 'port', 'scan', 'security'],
    requiresAuth: true,
    rateLimited: true,
    maxCallsPerMinute: 10
  },
  handler: async (parameters: { host: string; ports: string; timeout?: number }) => {
    try {
      // 實現埠號掃描邏輯
      return {
        success: true,
        data: {
          host: parameters.host,
          portsScanned: parameters.ports,
          openPorts: [80, 443], // Mock data
          closedPorts: [8080, 8090],
          scanTime: 1500
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `埠號掃描失敗: ${error}`
      };
    }
  }
};

// 導出所有網路工具
export const networkFunctions: FunctionDefinition[] = [
  networkHttpRequest,
  networkDnsLookup,
  networkPing,
  networkPortScan
];

// 獲取網路工具的 OpenAI Function Schema
export function getNetworkFunctionSchemas(): OpenAIFunctionSchema[] {
  return networkFunctions.map(func => func.schema);
}

// 獲取網路工具名稱列表
export function getNetworkFunctionNames(): string[] {
  return networkFunctions.map(func => func.id);
} 