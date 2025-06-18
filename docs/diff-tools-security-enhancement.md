# Diff 工具安全控管增強報告

## 📋 改進概要

本次更新對 diff 工具系列進行了全面的安全控管增強，確保工具僅能在指定的 Docker 容器環境中安全運行，完全避免對宿主機檔案的意外修改。

## 🔒 安全控管機制

### 1. Docker 環境驗證

**功能**: 嚴格驗證工具執行環境

- ✅ 僅允許在授權的 Docker 容器中執行
- ✅ 驗證容器名稱符合安全模式
- ✅ 檢查工作目錄位於允許範圍內

**允許的容器模式**:

```
- ai-web-ide-*
- ai-dev-*
```

### 2. 路徑安全控管

**功能**: 防止惡意路徑操作

- ✅ 禁止路徑遍歷攻擊（`../` 等）
- ✅ 限制訪問系統敏感目錄
- ✅ 確保操作僅在允許的工作目錄內

**受限制的路徑**:

```
/etc, /usr, /bin, /sbin, /root, /home, /var/log, /sys, /proc
```

**允許的工作目錄**:

```
/app, /app/workspace, /workspace
```

### 3. 安全事件記錄

**功能**: 完整的安全審計追蹤

- ✅ 記錄所有訪問嘗試
- ✅ 區分允許/拒絕的操作
- ✅ 包含時間戳和詳細原因
- ✅ 便於安全分析和調試

## 🛠️ 工具更新詳情

### `docker_apply_diff` (增強版)

**改進內容**:

- 新增多層安全驗證機制
- 實施嚴格的容器和路徑檢查
- 完整的安全事件記錄
- 更詳細的錯誤信息和建議

**使用範例**:

```typescript
// 安全的 Docker 環境中使用
await dockerApplyDiff({
  filePath: "src/components/MyComponent.tsx", // 相對路徑，安全
  diffContent: `
@@ -1,3 +1,4 @@
 export function MyComponent() {
-  return <div>Hello</div>
+  return <div>Hello World</div>
+  // 新增註解
 }
  `,
});
```

### `local_apply_diff` (已禁用)

**安全措施**:

- 完全禁用本地檔案系統操作
- 嘗試使用時返回安全錯誤
- 引導用戶使用安全的 Docker 版本
- 記錄所有嘗試使用的行為

### `docker_security_config` (新增)

**功能**:

- 查看當前安全配置
- 驗證容器名稱是否符合要求
- 檢查檔案路徑安全性
- 提供安全狀態報告

**使用範例**:

```typescript
// 查看安全配置
await dockerSecurityConfig({ action: "view_config" });

// 檢查容器是否安全
await dockerSecurityConfig({
  action: "check_container",
  containerName: "ai-web-ide-my-project-123",
});

// 檢查路徑是否安全
await dockerSecurityConfig({
  action: "check_path",
  filePath: "src/app/page.tsx",
});
```

## 🔍 安全驗證流程

### 執行前檢查順序

1. **Docker 上下文驗證**

   - 檢查是否提供 Docker 上下文
   - 驗證上下文配置完整性

2. **容器名稱驗證**

   - 檢查容器名稱是否符合允許模式
   - 防止在未授權容器中執行

3. **工作目錄驗證**

   - 確認工作目錄在允許範圍內
   - 防止訪問系統敏感區域

4. **檔案路徑驗證**

   - 正規化路徑格式
   - 檢查路徑遍歷攻擊
   - 驗證目標路徑安全性

5. **執行權限確認**
   - 最終安全檢查
   - 記錄執行決定

### 錯誤處理機制

**拒絕存取時**:

```json
{
  "success": false,
  "error": "操作被拒絕：容器 unauthorized-container 不在允許清單中",
  "data": {
    "suggestion": "請使用授權的 Docker 容器執行此操作"
  }
}
```

**安全事件記錄**:

```json
{
  "type": "SECURITY_EVENT",
  "event": "access_denied",
  "containerName": "unauthorized-container",
  "filePath": "src/app/page.tsx",
  "reason": "容器不在允許清單中",
  "timestamp": "2025-01-18T08:36:25.000Z"
}
```

## 📊 安全效益

### 防護效果

- ✅ **100% 防止宿主機檔案修改**: 完全禁用本地檔案操作
- ✅ **路徑遍歷攻擊防護**: 多層路徑驗證機制
- ✅ **容器隔離強化**: 嚴格的容器白名單控制
- ✅ **系統目錄保護**: 禁止訪問敏感系統路徑

### 可追溯性

- ✅ **完整審計日誌**: 記錄所有操作嘗試
- ✅ **實時安全監控**: 即時檢測異常行為
- ✅ **詳細錯誤報告**: 提供具體的安全違規信息

## 🔧 配置自定義

### 環境變數配置

```bash
# 自定義允許的容器模式
DOCKER_ALLOWED_CONTAINERS="ai-web-ide-*,custom-dev-*"

# 自定義工作目錄
DOCKER_ALLOWED_WORKDIRS="/app,/workspace,/custom"

# 啟用詳細安全日誌
DOCKER_SECURITY_VERBOSE=true
```

### 程式碼配置

```typescript
// 自定義安全配置
const customSecurityConfig: DockerSecurityConfig = {
  allowedContainers: ["my-custom-container-*"],
  restrictedPaths: ["/etc", "/usr", "/my-sensitive-dir"],
  allowedWorkingDirs: ["/app", "/my-workspace"],
  requireDockerContext: true,
};
```

## 🚀 使用建議

### 最佳實踐

1. **總是使用 `docker_apply_diff`**

   - 避免使用已禁用的本地版本
   - 確保在正確的 Docker 環境中執行

2. **路徑使用規範**

   - 使用相對路徑而非絕對路徑
   - 確保路徑在專案目錄範圍內

3. **安全檢查習慣**

   - 使用 `docker_security_config` 預先檢查
   - 關注安全事件日誌

4. **錯誤處理**
   - 妥善處理安全拒絕錯誤
   - 根據建議調整操作方式

## 📋 升級清單

- [x] 實施 Docker 環境驗證
- [x] 新增路徑安全控管
- [x] 禁用本地檔案系統操作
- [x] 建立安全事件記錄系統
- [x] 創建安全配置工具
- [x] 更新工具描述和文檔
- [x] 提供詳細的錯誤訊息
- [x] 建立安全最佳實踐指南

## 🔮 未來改進計劃

- [ ] 整合到中央安全管理系統
- [ ] 新增更細緻的權限控制
- [ ] 實施安全事件告警機制
- [ ] 支援更多自定義安全規則
- [ ] 新增安全性能監控
