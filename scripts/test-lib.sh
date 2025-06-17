#!/bin/bash

# @/lib 模組測試執行腳本
# 用於獨立測試所有工具功能

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 輸出函數
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# 檢查依賴
check_dependencies() {
    print_header "檢查測試依賴"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安裝"
        exit 1
    fi
    
    if ! npm list jest &> /dev/null; then
        print_warning "Jest 未安裝，正在安裝測試依賴..."
        npm install --save-dev jest @types/jest ts-jest jest-environment-node
    fi
    
    print_success "依賴檢查完成"
}

# 執行特定模組測試
run_module_test() {
    local module=$1
    local description=$2
    
    print_info "測試 $description..."
    
    if npm run test:$module; then
        print_success "$description 測試通過"
        return 0
    else
        print_error "$description 測試失敗"
        return 1
    fi
}

# 執行覆蓋率測試
run_coverage_test() {
    print_header "執行覆蓋率測試"
    
    if npm run test:coverage; then
        print_success "覆蓋率測試完成"
        print_info "查看詳細報告: open coverage/lcov-report/index.html"
    else
        print_error "覆蓋率測試失敗"
        return 1
    fi
}

# 主要測試函數
run_all_tests() {
    print_header "開始執行 @/lib 模組完整測試"
    
    local failed_tests=()
    
    # 測試核心模組
    if ! run_module_test "core" "核心模組 (Logger, DiffProcessor, ToolManager)"; then
        failed_tests+=("core")
    fi
    
    # 測試 Docker 模組
    if ! run_module_test "docker" "Docker 模組 (Tools, AI Editor, Config)"; then
        failed_tests+=("docker")
    fi
    
    # 測試 AI 模組
    if ! run_module_test "ai" "AI 模組 (Context Manager, Prompt Builder, OpenAI)"; then
        failed_tests+=("ai")
    fi
    
    # 執行整合測試
    if ! run_module_test "integration" "整合測試"; then
        failed_tests+=("integration")
    fi
    
    # 生成報告
    print_header "測試結果報告"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "🎉 所有測試都通過了！"
        print_info "您的 @/lib 模組功能正常"
    else
        print_error "以下模組測試失敗:"
        for module in "${failed_tests[@]}"; do
            echo -e "   ${RED}• $module${NC}"
        done
        print_info "請檢查失敗的測試並修復相關問題"
    fi
    
    return ${#failed_tests[@]}
}

# 顯示幫助信息
show_help() {
    echo "用法: $0 [選項]"
    echo ""
    echo "選項:"
    echo "  -h, --help      顯示此幫助信息"
    echo "  -c, --core      只測試核心模組"
    echo "  -d, --docker    只測試 Docker 模組"
    echo "  -a, --ai        只測試 AI 模組"
    echo "  -i, --integration 只測試整合模組"
    echo "  --coverage      執行覆蓋率測試"
    echo "  --watch         監視模式"
    echo ""
    echo "範例:"
    echo "  $0              # 執行所有測試"
    echo "  $0 -c           # 只測試核心模組"
    echo "  $0 --coverage   # 執行覆蓋率測試"
}

# 主程序
main() {
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--core)
            check_dependencies
            run_module_test "core" "核心模組"
            ;;
        -d|--docker)
            check_dependencies
            run_module_test "docker" "Docker 模組"
            ;;
        -a|--ai)
            check_dependencies
            run_module_test "ai" "AI 模組"
            ;;
        -i|--integration)
            check_dependencies
            run_module_test "integration" "整合測試"
            ;;
        --coverage)
            check_dependencies
            run_coverage_test
            ;;
        --watch)
            check_dependencies
            print_info "啟動監視模式..."
            npm run test:watch
            ;;
        "")
            check_dependencies
            run_all_tests
            exit $?
            ;;
        *)
            print_error "未知選項: $1"
            show_help
            exit 1
            ;;
    esac
}

# 執行主程序
main "$@" 