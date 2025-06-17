# 🔒 Docker 工具安全遷移指南

## 概述

為了提高系統安全性，我們已經完全重寫了所有 Docker 工具，建立了嚴格的安全機制。新的工具系統確保所有操作都嚴格限制在 Docker 容器內的專案目錄中，完全無法訪問宿主機檔案系統。

## ⚠️ 重要安全升級

### 舊系統問題

- ❌ 可能訪問宿主機檔案
- ❌ 路徑遍歷攻擊風險
- ❌ 敏感檔案訪問風險
- ❌ 缺乏實時安全驗證

### 新系統優勢

- ✅ **工作目錄嚴格鎖定**：`/app/workspace/[project-name]`
- ✅ **路徑遍歷保護**：自動阻止 `../` 攻擊
- ✅ **敏感檔案保護**：禁止訪問 `/etc/`, `/root/` 等
- ✅ **實時安全驗證**：每次操作都進行安全檢查
- ✅ **安全級別**：MAXIMUM

## 🔄 工具對照表

### 檔案系統工具

| 舊工具 (不安全)         | 新工具 (安全)                  | 狀態      |
| ----------------------- | ------------------------------ | --------- |
| `docker_read_file`      | `strict_docker_read_file`      | ✅ 已替換 |
| `docker_list_directory` | `strict_docker_list_directory` | ✅ 已替換 |
| `docker_list_files`     | `strict_docker_list_directory` | ✅ 已替換 |
| `docker_write_file`     | `strict_docker_write_file`     | ✅ 已替換 |
| `docker_create_file`    | `strict_docker_write_file`     | ✅ 已替換 |
| `docker_find_files`     | `strict_docker_find_files`     | ✅ 已替換 |
| `docker_delete_file`    | ❌ 已移除 (安全考量)           | 🚫 不提供 |

### Agent 系統

| 舊系統                 | 新系統                      | 狀態      |
| ---------------------- | --------------------------- | --------- |
| `ChatAgentIntegrator`  | `SecureChatAgentIntegrator` | ✅ 已替換 |
| `EnhancedToolRegistry` | `StrictToolRegistry`        | ✅ 已替換 |
| `AgentFactory`         | `StrictAgentFactory`        | ✅ 已替換 |
| `DockerTools`          | `StrictDockerTools`         | ✅ 已替換 |

## 📝 遷移步驟

### 1. 更新匯入

**舊代碼：**

```typescript
import { ChatAgentIntegrator } from "./lib/ai/chat-agent-integration";
import { AgentFactory } from "./lib/ai/agent-factory";
import { EnhancedToolRegistry } from "./lib/ai/enhanced-tool-registry";
```

**新代碼：**

```typescript
import { SecureChatAgentIntegrator } from "./lib/ai/secure-chat-agent-integration";
import { StrictAgentFactory } from "./lib/ai/strict-agent-factory";
import { StrictToolRegistry } from "./lib/ai/strict-tool-registry";
```

### 2. 更新配置

**舊配置：**

```typescript
const config = {
  projectId: "my-project",
  projectName: "web-app",
  conversationId: "conv-123",
  apiToken: "sk-...",
  dockerContainerId: "optional", // 可選
};
```

**新配置：**

```typescript
const config = {
  projectName: "web-app", // 必要
  dockerContainerId: "41acd88ac05a", // 必要
  conversationId: "conv-123",
  apiToken: "sk-...",
  maxToolCalls: 3, // 降低以提高安全性
  maxRetries: 1, // 降低以提高安全性
  timeoutMs: 20000, // 降低以提高安全性
};
```

### 3. 更新初始化

**舊初始化：**

```typescript
const integrator = new ChatAgentIntegrator(config);
await integrator.initialize();
```

**新初始化：**

```typescript
const secureIntegrator = new SecureChatAgentIntegrator(config);
await secureIntegrator.initialize();
```

### 4. 更新工具調用

**舊工具調用：**

```typescript
// 這些工具現在被禁用
await toolRegistry.executeTool("docker_read_file", { filePath: "/etc/passwd" }); // 危險！
await toolRegistry.executeTool("docker_list_files", { path: "/app/../.." }); // 危險！
```

**新工具調用：**

```typescript
// 這些操作會被安全機制自動阻止
await strictToolRegistry.executeTool("strict_docker_read_file", {
  filePath: "package.json",
}); // 安全
await strictToolRegistry.executeTool("strict_docker_list_directory", {
  dirPath: "src",
}); // 安全
```

## 🛡️ 安全特性

### 路徑安全驗證

```typescript
// ❌ 這些路徑會被自動拒絕
"../../../etc/passwd"; // 路徑遍歷攻擊
"/etc/hosts"; // 系統檔案
"/root/.bashrc"; // 敏感檔案
"~/.ssh/id_rsa"; // 用戶檔案

// ✅ 這些路徑是安全的
"package.json"; // 專案根檔案
"src/app/page.tsx"; // 專案內檔案
"./components/Button.tsx"; // 相對路徑
```

### 工作目錄限制

```typescript
// 所有操作都限制在以下目錄內：
const STRICT_WORKING_DIR = `/app/workspace/${projectName}`;

// 例如：/app/workspace/web_test
// 無法訪問：
// - /app/workspace/other_project
// - /app/
// - /home/
// - /etc/
// - 宿主機的任何檔案
```

## 📊 安全報告

### 獲取安全狀態

```typescript
const securityReport = secureIntegrator.getSecurityReport();
console.log(securityReport);

/*
輸出：
{
  securityLevel: 'MAXIMUM',
  projectName: 'web_test',
  containerId: '41acd88ac05a',
  workingDirectory: '/app/workspace/web_test',
  toolsAvailable: [
    'strict_docker_read_file',
    'strict_docker_list_directory',
    'strict_docker_write_file',
    'strict_docker_find_files',
    'strict_docker_get_project_info'
  ],
  safetyMeasures: [
    'Path traversal protection',
    'Absolute path restriction',
    'System file access prevention',
    'Container isolation',
    'Real-time security validation'
  ]
}
*/
```

## 🧪 測試安全性

### 執行安全測試

```bash
# 測試嚴格 Docker 工具（不需要 OpenAI API Key）
npx tsx scripts/test-strict-docker-tools-only.ts

# 測試完整的嚴格系統（需要 OpenAI API Key）
npx tsx scripts/test-strict-docker-system.ts
```

### 預期測試結果

```
🔒 開始測試嚴格 Docker 工具...

✅ 嚴格 Docker 工具建立成功
✅ 安全級別: MAXIMUM
✅ 路徑遍歷攻擊被正確阻止
✅ 敏感檔案訪問被正確阻止
✅ 成功讀取專案內檔案
✅ 工具已正確鎖定在專案目錄內

🎉 所有安全檢查都通過！
```

## ⚡ 立即行動

### 1. 停用舊工具

```typescript
// 在現有代碼中添加警告
console.warn("⚠️ 使用舊的不安全工具！請立即遷移到 SecureChatAgentIntegrator");
```

### 2. 更新所有引用

搜尋並替換以下內容：

- `ChatAgentIntegrator` → `SecureChatAgentIntegrator`
- `docker_read_file` → `strict_docker_read_file`
- `docker_list_directory` → `strict_docker_list_directory`
- `docker_write_file` → `strict_docker_write_file`

### 3. 驗證安全性

執行測試確保所有操作都在安全沙箱內：

```bash
npm run test:security
```

## 🚨 緊急情況

如果發現任何安全漏洞或不當的檔案訪問：

1. **立即停止使用舊工具**
2. **檢查日誌檔案** (`logs/ai-outputs/ai-output.log`)
3. **執行安全測試** 確認問題範圍
4. **使用新的嚴格工具** 替換所有操作

## 📞 支援

如果在遷移過程中遇到問題：

1. 檢查 [安全測試結果](#🧪-測試安全性)
2. 查看 [工具對照表](#🔄-工具對照表)
3. 執行 `test-strict-docker-tools-only.ts` 驗證系統狀態

---

**重要提醒**：新的安全系統已經完全阻止了所有不安全的操作。所有 AI 工具現在都無法訪問宿主機檔案，確保了最高級別的安全性。
