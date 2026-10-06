#!/usr/bin/env bash
# 构建前端 dist → dist/www(ipk 内置 UI 的来源)。
#
# 来源优先级:
#   1. FRONTEND_DIR 环境变量指定的目录
#   2. 工作区已检出的 frontend 仓(../../frontend,hub make setup 布局)
#   3. 临时克隆 filescodebox/frontend <FRONTEND_REF,默认 main>
#
# 说明:打包只跑 vite build(跳过 vue-tsc——类型检查由 frontend 仓 CI 独立把守);
# wire 类型依赖 @filescodebox/contracts 的 Release tgz 资产(匿名可下)。
set -euo pipefail

FRONTEND_REF=${FRONTEND_REF:-main}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/www"
rm -rf "$OUT"

SRC="${FRONTEND_DIR:-}"
CLEANUP_SRC=""
if [ -z "$SRC" ]; then
	if [ -f "$ROOT/../../frontend/package.json" ]; then
		SRC="$(cd "$ROOT/../../frontend" && pwd)"
		echo "→ 使用工作区 frontend: $SRC"
	else
		SRC="$(mktemp -d)/frontend"
		CLEANUP_SRC="$SRC"
		echo "→ 克隆 frontend@$FRONTEND_REF"
		git clone -q --depth 1 -b "$FRONTEND_REF" \
			"https://github.com/filescodebox/frontend.git" "$SRC"
	fi
fi
trap '[ -n "$CLEANUP_SRC" ] && rm -rf "$(dirname "$CLEANUP_SRC")"' EXIT

cd "$SRC"
[ -d node_modules ] || npm ci --no-audit --no-fund
npx vite build --outDir "$OUT" --emptyOutDir

echo "✓ 前端构建完成: $OUT ($(du -sh "$OUT" | cut -f1))"
