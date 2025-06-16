# 專案計劃

## Note

- 專案的細節可以在 `doc/pj_info.md` 看到
- **容器標記方案**：使用 `ai-web-ide-` 前綴命名格式來標記 AI Web IDE 專案容器
- **容器命名規則**：`ai-web-ide-{project-name}-{timestamp}`，例如：`ai-web-ide-my-blog-20231201`
- **Docker Labels**：同時使用 Docker labels 添加 `ai.web.ide.project=true` 標籤便於查詢過濾

## TODO

- [ ] 1. 創建 ProjectDashboard 組件 - 主頁面專案卡片展示
- [ ] 2. 實作 Docker 容器列表查詢功能 - 只顯示有 AI Web IDE 標記的容器
- [ ] 3. 創建新專案模態框 - 包含專案名稱、描述等基本資訊輸入
- [ ] 4. 實作 Docker 容器創建功能 - 基於 Node.js 鏡像創建標記容器
- [ ] 5. 實作容器狀態監控 - 顯示運行中/停止/錯誤狀態
- [ ] 6. 實作容器基本操作 - 啟動/停止/刪除按鈕功能
- [ ] 7. 添加搜尋與過濾功能 - 按專案名稱或狀態過濾
- [ ] 8. 創建容器控制 API 端點 - 後端 Docker 操作接口
- [ ] 9. 實作專案卡片點擊功能 - 進入專案工作區
