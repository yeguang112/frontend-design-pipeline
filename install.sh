#!/usr/bin/env bash
# 安装「前端设计链路」skill 到 agent 技能目录（macOS / Linux）。
# 用法:
#   ./install.sh                 # 默认 ~/.agents/skills/frontend-design-pipeline
#   ./install.sh /path/to/skills # 自定义目标
#   FORCE=1 ./install.sh         # 覆盖已有安装（先备份）
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HOME/.agents/skills}"
DEST="$TARGET/frontend-design-pipeline"

[ -f "$SRC/SKILL.md" ] || { echo "找不到 SKILL.md，请在仓库根目录运行" >&2; exit 2; }

if [ -e "$DEST" ]; then
  if [ "${FORCE:-0}" != "1" ]; then
    echo "目标已存在：$DEST" >&2
    echo "加 FORCE=1 覆盖（会先备份）" >&2
    exit 2
  fi
  BACKUP="$DEST.bak-$(date +%Y%m%d%H%M%S)"
  mv "$DEST" "$BACKUP"
  echo "已备份到 $BACKUP"
fi

mkdir -p "$DEST"
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude '_work' --exclude '_review' --exclude '.git' \
    --exclude 'examples' --exclude '__fixtures__/out-*' \
    "$SRC/" "$DEST/"
else
  cp -R "$SRC"/. "$DEST"/
  rm -rf "$DEST/_work" "$DEST/_review" "$DEST/examples" "$DEST"/scripts/__fixtures__/out-*
fi

COUNT=$(find "$DEST" -type f | wc -l | tr -d ' ')
echo "已安装 $COUNT 个文件到 $DEST"
echo "重启 agent 会话后生效；也可让 agent 直接读取 $DEST/SKILL.md"
