# 聊天上下文系統使用指南

## 概述

本系統實現了完整的聊天上下文管理功能，解決了 AI 失憶問題。系統使用 SQLite 資料庫持久化儲存聊天記錄，並提供智能的上下文管理。

## 主要特性

### ✅ 已實現功能

1. **SQLite 持久化儲存**

   - 聊天室管理
   - 訊息歷史儲存
   - 專案上下文保存
   - 工具使用記錄

2. **智能上下文管理**

   - 自動構建對話上下文
   - 專案資訊維護
   - 工具調用歷史追蹤
   - 上下文長度控制

3. **完整的 API 整合**

   - 增強的聊天 API (`/api/chat-enhanced`)
   - 支援 CRUD 操作
   - 自動清理過期資料

4. **前端組件更新**
   - 自動載入聊天歷史
   - 持久化聊天視窗
   - 上下文感知的對話

## 系統架構

```
┌─────────────────────────────────────────────────┐
│                前端組件                          │
│  (ChatInterface.tsx)                            │
├─────────────────────────────────────────────────┤
│                API 層                           │
│  /api/chat-enhanced                             │
├─────────────────────────────────────────────────┤
│              業務邏輯層                          │
│  ChatContextManager                             │
├─────────────────────────────────────────────────┤
│              資料儲存層                          │
│  ChatStorageManager (SQLite)                   │
└─────────────────────────────────────────────────┘
```

## 使用方法

### 1. 前端使用

更新後的 `ChatInterface` 組件會自動：

- 載入現有聊天記錄
- 保存新的對話內容
- 維護上下文連續性

```typescript
// 組件會自動處理上下文，無需額外配置
<ChatInterface
  projectName="我的專案"
  projectId="my-project-id"
  containerId="container-123"
/>
```

### 2. API 使用

#### 發送聊天訊息

```javascript
const response = await fetch("/api/chat-enhanced", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "你好，請繼續之前的故事",
    roomId: "existing-room-id", // 可選，不提供則創建新房間
    projectId: "my-project",
    projectName: "My Project",
    apiToken: "sk-...",
    contextLength: 15, // 使用的上下文長度
  }),
});
```

#### 獲取聊天記錄

```javascript
// 獲取特定聊天室
const response = await fetch("/api/chat-enhanced?roomId=room-123");

// 獲取專案的所有聊天室
const response = await fetch("/api/chat-enhanced?projectId=my-project");
```

#### 刪除聊天室

```javascript
const response = await fetch("/api/chat-enhanced?roomId=room-123", {
  method: "DELETE",
});
```

### 3. 程式化使用

```typescript
import { chatContextManager } from "@/lib/chat/chat-context-manager";

// 創建聊天室
const room = await chatContextManager.getOrCreateChatRoom(
  "room-id",
  "project-id",
  "Project Name",
  "container-id"
);

// 添加訊息
const userMsg = await chatContextManager.addUserMessage(
  "room-id",
  "用戶訊息內容"
);

// 構建上下文
const context = await chatContextManager.buildContextString("room-id", 10);

// 設置專案上下文
await chatContextManager.setProjectContext(
  "room-id",
  "tech_stack",
  "Next.js, TypeScript",
  24 // 24小時後過期
);
```

## 資料庫結構

### 聊天室表 (chat_rooms)

- `id`: 聊天室 ID
- `title`: 聊天室標題
- `project_id`: 專案 ID
- `project_name`: 專案名稱
- `container_id`: 容器 ID
- `created_at`: 創建時間
- `last_activity`: 最後活動時間
- `is_active`: 是否活躍
- `total_messages`: 總訊息數
- `total_tokens`: 總 Token 數
- `total_cost`: 總成本

### 聊天訊息表 (chat_messages)

- `id`: 訊息 ID
- `room_id`: 聊天室 ID
- `role`: 角色 (user/assistant/system)
- `content`: 訊息內容
- `timestamp`: 時間戳
- `tokens`: Token 數量
- `cost`: 成本
- `tool_calls_executed`: 執行的工具數量

### 聊天上下文表 (chat_contexts)

- `id`: 上下文 ID
- `room_id`: 聊天室 ID
- `context_type`: 上下文類型
- `context_key`: 上下文鍵
- `context_value`: 上下文值
- `created_at`: 創建時間
- `updated_at`: 更新時間
- `expires_at`: 過期時間

## 上下文管理機制

### 1. 對話歷史

系統會自動保存所有對話記錄，並在 AI 處理新訊息時提供相關的歷史上下文。

### 2. 專案上下文

- 專案基本資訊
- 技術堆疊
- 容器配置
- 用戶偏好設定

### 3. 工具使用記錄

- 記錄所有工具調用
- 成功/失敗狀態
- 執行時間和結果

### 4. 智能上下文構建

```
=== 對話歷史 ===
[時間] 用戶: 訊息內容
[時間] AI助手: 回應內容
  └─ 執行了 N 個工具操作

=== 專案上下文 ===
技術堆疊: Next.js, TypeScript, SQLite
容器ID: container-123
```

## 清理和維護

### 自動清理

- 過期的上下文資料會自動清理
- 30 天前的非活躍聊天室會被清理
- 前端每 30 分鐘執行一次清理操作

### 手動清理

```typescript
// 執行清理操作
await chatContextManager.cleanup();

// 獲取儲存統計
const stats = chatStorage.getStorageStats();
console.log("資料庫大小:", stats.dbSizeKB, "KB");
```

## 測試

運行測試腳本驗證系統功能：

```bash
npx tsx scripts/test-chat-context-system.ts
```

測試內容包括：

- SQLite 儲存功能
- 訊息儲存和讀取
- 上下文構建
- 專案上下文管理
- 工具使用記錄
- 清理功能

## 故障排除

### 常見問題

1. **資料庫初始化失敗**

   - 確保 `data` 目錄有寫入權限
   - 檢查 better-sqlite3 是否正確安裝

2. **上下文不連續**

   - 檢查聊天室 ID 是否正確傳遞
   - 確認 API Token 設置正確

3. **記憶體使用過高**
   - 調整上下文長度參數
   - 執行清理操作

### 調試技巧

1. 開啟控制台查看上下文構建日誌
2. 檢查資料庫檔案 `data/chat.db`
3. 使用測試腳本驗證功能

## 效能優化

1. **索引優化**：資料庫已建立適當索引
2. **上下文長度控制**：避免過長的上下文
3. **定期清理**：自動清理過期資料
4. **連接池**：SQLite 使用單例模式

## 安全考量

1. **資料隔離**：不同專案的資料完全隔離
2. **API Token 保護**：Token 不會儲存在資料庫中
3. **輸入驗證**：所有輸入都經過驗證
4. **過期清理**：敏感上下文會自動過期

## 未來擴展

1. **多用戶支援**：添加用戶識別機制
2. **雲端同步**：支援多設備同步
3. **更智能的上下文**：基於相似性的上下文選擇
4. **效能監控**：添加詳細的效能指標
