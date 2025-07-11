# 專案計劃

把 call tool 紀錄以及 call tool 思考過程也記錄在 db

## Note

- 專案的細節可以在 `doc/pj_info.md` 看到
- **容器標記方案**：使用 `ai-web-ide-` 前綴命名格式來標記 AI Web IDE 專案容器
- **容器命名規則**：`ai-web-ide-{project-name}-{timestamp}`，例如：`ai-web-ide-my-blog-20231201`
- **Docker Labels**：同時使用 Docker labels 添加 `ai.web.ide.project=true` 標籤便於查詢過濾
- **開發模式支援**：API 支援模擬數據模式，如果 Docker 環境不可用則自動使用模擬數據
- **錯誤處理**：完善的 Docker 命令超時和錯誤處理機制
- **容器刪除重試機制**：三階段刪除策略 - 優雅停止 → 強制停止 → 強制刪除，解決運行中容器刪除失敗問題
- **動態 Prompt 構建系統**：每次對話重新構建完整系統提示詞，確保 AI 獲得最新專案狀態和完整上下文
- **AI 邏輯問題分析**：目前 AI 助理的意圖分析過於簡化，導致所有請求都被歸類為專案探索，需要重新設計意圖分析邏輯和工具調用機制
- **AI 編輯器工具架構**：基於 diff 驅動的安全 AI 編輯器，包含給 AI 使用的 function 和系統內部執行的工具
- **會話管理架構修復**：創建全域 OpenAIIntegrationManager 單例模式，解決每次 API 請求重新創建實例導致會話遺失的問題，實現會話持久化和實例用
- **一切 AI 改動都要在 Docker 內部**：不要污染到外部環境。
- **Docker 工具安裝解決方案**：
  - 修改 Dockerfile 添加 tree、wget、nano、vim、htop 等常用工具
  - 容器創建 API 自動安裝工具，確保新容器包含所有必要工具
  - 現有容器可透過手動命令安裝：`docker exec <container-name> sh -c "apk update && apk add --no-cache tree wget nano vim htop"`
- **用戶體驗優化**：
  - 簡化工具調用確認機制，減少洗版問題
  - 添加 5 分鐘超時機制和倒數計時顯示
  - 移除重複 API 請求，避免循環調用
- **React Hydration 錯誤修復**：
  - 使用固定值替代 Math.random() 避免服務端客戶端不一致
  - 使用 useEffect 設置時間避免 Date 相關 hydration 錯誤
  - 創建 ID 計數器替代 Date.now() 生成唯一 ID
  - 修復 project.stats 可能為 undefined 的問題
- **實時日誌顯示系統**：
  - 使用 Server-Sent Events (SSE) 實現實時日誌流
  - 終端風格的實時日誌顯示彈窗
  - 支持流式回應和傳統回應兩種模式

## TODO

- [x] 1. 創建 ProjectDashboard 組件 - 主頁面專案卡片展示
- [x] 2. 實作 Docker 容器列表查詢功能 - 只顯示有 AI Web IDE 標記的容器
- [x] 3. 創建新專案模態框 - 包含專案名稱、描述等基本資訊輸入
- [x] 4. 實作 Docker 容器創建功能 - 基於 Node.js 鏡像創建標記容器
- [x] 5. 實作容器狀態監控 - 顯示運行中/停止/錯誤狀態
- [x] 6. 實作容器基本操作 - 啟動/停止/刪除按鈕功能
- [x] 7. 添加搜尋與過濾功能 - 按專案名稱或狀態過濾
- [x] 8. 創建容器控制 API 端點 - 後端 Docker 操作接口
- [x] 9. 實作專案卡片點擊功能 - 進入專案工作區
- [x] 10. 實作容器刪除重試機制 - 解決偶發性刪除失敗問題
- [x] 11. 實作聊天頁面功能 - 支援 token 輸入、多視窗聊天、上下文處理
- [ ] 12. 完善聊天功能細節 - 訊息格式化、代碼高亮、複製功能
- [ ] 13. 實作 TODO 列表管理 - 顯示和更新專案任務
- [ ] 14. 集成 Next.js 實時預覽 - 在右側面板顯示專案預覽
- [ ] 15. 實作錯誤監控與自動修復 - 收集容器錯誤並觸發修復
- [ ] 16. 添加環境變數管理 - .env 文件編輯和管理
- [x] 17. 設計專案初始化邏輯 - 新專案自動 init 為 Next.js 專案
- [x] 18. 設計 AI 檔案系統管理架構 - 讓 AI 掌握專案目錄結構
- [x] 19. 設計 Call Tool 介面架構 - MCP vs 專用接口的技術選型
- [x] 20. 實作專案檔案操作 API - AI 編輯檔案、執行指令的統一接口
- [x] 21. 實作容器內 Next.js 自動初始化流程 - package.json、基礎結構建立
- [x] 22. 設計 AI 工具鏈整合架構 - DiffApplierTool、ScriptExecutorTool 等
- [ ] 23. 實作檔案變更監控與同步機制 - 容器內外檔案即時同步
- [ ] 24. 設計安全權限控制 - AI 操作範圍限制與沙箱保護
- [x] 25. 實作動態 Prompt 構建系統 - 每次對話重新構建完整系統提示詞
- [x] 26. 修復所有 TypeScript 和 ESLint 錯誤 - 提升代碼品質和類型安全
- [x] 27. 修復 Tailwind CSS v4 配置問題 - 更新為正確的 v4 語法和配置
- [x] 28. 修復進入開發按鈕跳轉問題 - 統一 ProjectCard 和 ProjectDashboard 的動作名稱
- [x] 29. 修復專案狀態 API URL 編碼問題 - 使用 URL 構造器正確編碼查詢參數
- [x] 30. 添加 Token 輸入功能 - 在聊天介面中添加 OpenAI API Token 設定功能
- [ ] 31. 修復 AI 邏輯問題 - 重新設計意圖分析邏輯，讓 AI 能夠執行實際動作而非只回傳專案報告
- [ ] 32. 優化 AI 工具調用機制 - 改善工具選擇邏輯，確保 AI 能根據用戶請求執行相應的操作
- [ ] 33. 實作真正的專案初始化功能 - 讓 AI 能夠實際創建 Next.js 專案結構和檔案
- [x] 34. 實作 AI 編輯器核心工具 - read_file, list_files, ask_user, propose_diff, run_command, search_code
- [x] 35. 實作系統內部執行工具 - apply_diff, write_file, run_command_safe, log_ai_action
- [x] 36. 實作進階 AI 工具 - get_project_context, get_git_diff, get_terminal_output, test_file
- [x] 37. 設計 unified diff 處理系統 - 使用 diff-match-patch 或 jsdiff 套用變更
- [x] 38. 實作安全命令執行白名單 - 限制 AI 可執行的命令範圍
- [x] 39. 實作用戶確認機制 - AI 操作前的用戶確認界面
- [x] 40. 實作 AI 操作日誌系統 - 記錄所有 AI 編輯和執行操作
- [ ] 41. 整合 AST 分析工具 - 使用 Babel/ts-morph/tree-sitter 提供代碼結構分析
- [x] 42. 實作 OpenAI Function Calling 整合 - 完整的 Node.js + gpt-4o function calling 流程
- [x] 43. 創建 OpenAI 整合管理器 - 會話管理、工具調用統計、安全機制
- [x] 44. 實作工具調用可視化 - 詳細的工具執行日誌和統計分析
- [x] 45. 創建完整使用範例 - 基本使用、代碼修改、會話管理、安全確認等範例
- [x] 46. 撰寫 OpenAI 整合快速指南 - 詳細的使用說明和最佳實踐
- [x] 47. 整合 ChatInterface 與 Function Calling - 讓聊天介面支援 AI 工具調用
- [x] 48. 實作用戶確認機制 - 重要操作的確認界面和處理流程
- [x] 49. 添加工具調用可視化 - 顯示工具執行統計和狀態
- [x] 50. 創建 Function Calling API 端點 - 處理 OpenAI function calling 的後端接口
- [x] 51. 修復會話管理問題 - 解決 "會話不存在" 錯誤，改善會話持久化和實例管理
- [x] 52. 修復健康檢查 API ESLint 錯誤 - 處理未使用的 request 參數和 error 變數，使用下劃線前綴避免 linting 警告
- [x] 53. 修復用戶確認 UI 流程 - 實作完整的前端確認界面，解決後台等待確認但前端無 UI 的問題
- [ ] 54. 實作 Docker 容器自動初始化 Next.js 專案 - 創建新容器後自動執行 npx create-next-app 並設定好參數
- [x] 55. 修復 Docker 容器缺少常用工具問題 - 在 Dockerfile 中安裝 tree、curl、wget 等常用命令行工具
- [x] 56. 優化工具調用用戶體驗 - 改善確認機制，減少洗版問題，實作 5 分鐘超時機制
- [x] 57. 修復 ai-editor-tools.ts 的 TypeScript 錯誤 - 移除未使用的泛型參數
- [x] 58. 修復 React hydration 錯誤 - 解決服務端和客戶端渲染不一致的問題，修復 Math.random、Date.now 等導致的錯誤
- [x] 59. 實作 Docker 容器工具自動安裝 - 在容器創建時自動安裝 tree、wget、nano、vim 等常用工具
- [x] 60. 實作容器創建實時日誌顯示 - 使用 Server-Sent Events 讓用戶能看到完整的安裝過程
- [x] 61. 修復 ProjectCard 狀態顯示錯誤 - 解決 getStatusDisplay 函數可能返回 undefined 的問題，添加 default 情況和數據驗證

### 下一階段任務

- [ ] 31. 修復 AI 邏輯問題 - 重新設計意圖分析邏輯，讓 AI 能夠執行實際動作而非只回傳專案報告
- [ ] 32. 優化 AI 工具調用機制 - 改善工具選擇邏輯，確保 AI 能根據用戶請求執行相應的操作
- [ ] 33. 實作真正的專案初始化功能 - 讓 AI 能夠實際創建 Next.js 專案結構和檔案
- [ ] 12. 完善聊天功能細節 - 訊息格式化、代碼高亮、複製功能
- [ ] 13. 實作 TODO 列表管理 - 顯示和更新專案任務
- [ ] 14. 集成 Next.js 實時預覽 - 在右側面板顯示專案預覽
- [ ] 15. 實作錯誤監控與自動修復 - 收集容器錯誤並觸發修復
- [ ] 16. 添加環境變數管理 - .env 文件編輯和管理
