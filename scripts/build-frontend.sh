#!/usr/bin/env bash
# 构建前端 dist → dist/www(ipk/apk 内置 UI 的来源)。
#
# 来源(2026-10-09 拆仓:web 自包含在本仓 web/):
#   1. FRONTEND_DIR 环境变量指定的现成 dist 目录(直接拷贝,跳过构建)
#   2. 本仓 web/(neutral 构建:core 自带入口+默认无宿主适配器——OpenWrt 为
#      独立端口部署;frontend-core tgz 钉版在 web/package.json)
# 不再克隆 frontend 仓——ipk/apk web 内容随本仓提交可复现;
# 类型检查由本仓 CI 把守。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/www"
rm -rf "$OUT"

if [ -n "${FRONTEND_DIR:-}" ]; then
	cp -R "$FRONTEND_DIR/." "$OUT"
	echo "→ 使用现成 dist: $FRONTEND_DIR"
else
	cd "$ROOT/web"
	[ -d node_modules ] || npm ci --no-audit --no-fund
	# APP_VERSION=页脚「前端版本」(缺省=web/package.json version,前端列车号)
	APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}" \
		npx vite build --outDir "$OUT" --emptyOutDir
fi

echo "✓ 前端构建完成: $OUT ($(du -sh "$OUT" | cut -f1))"
