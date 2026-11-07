#requires -Version 5.1
<#
.SYNOPSIS
  安装「前端设计链路」skill 到 agent 技能目录。
.DESCRIPTION
  默认目标：$env:USERPROFILE\.agents\skills\frontend-design-pipeline
  也支持 DSH / Claude Code / Codex 共用同一目录。
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target "D:\myproject\.agents\skills" -Force
#>
param(
  [string]$Target = "$env:USERPROFILE\.agents\skills",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $Target 'frontend-design-pipeline'

Write-Host "源目录: $src"
Write-Host "目标:   $dest"

if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
  throw "找不到 SKILL.md，请从 design-pipeline 根目录运行本脚本。"
}

if (Test-Path $dest) {
  if (-not $Force) {
    Write-Host "目标已存在。加 -Force 覆盖（会先备份为 .bak）。" -ForegroundColor Yellow
    exit 2
  }
  $bak = "$dest.bak-$(Get-Date -Format 'yyyyMMddHHmmss')"
  Move-Item $dest $bak
  Write-Host "已备份到 $bak"
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
# 排除开发期产物：草稿、自测输出、演示、评审
$xd = @('_work', '_review', 'examples', '__fixtures__\out-*', '.git')
$rcArgs = @($src, $dest, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
foreach ($d in $xd) { $rcArgs += '/XD'; $rcArgs += (Join-Path $src $d) }
& robocopy @rcArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "复制失败（robocopy exit $LASTEXITCODE）" }

$skill = Join-Path $dest 'SKILL.md'
$count = (Get-ChildItem $dest -Recurse -File | Measure-Object).Count
$size  = [math]::Round(((Get-ChildItem $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)

# 基本校验
$ok = $true
foreach ($f in @('SKILL.md','README.md','references\00-intent-router.md','templates\frontend-guidelines.md','data\brand-index.json')) {
  if (-not (Test-Path (Join-Path $dest $f))) { Write-Host "缺少: $f" -ForegroundColor Red; $ok = $false }
}
if (Test-Path (Join-Path $dest 'data\brand-index.json')) {
  try { $null = Get-Content (Join-Path $dest 'data\brand-index.json') -Raw | ConvertFrom-Json }
  catch { Write-Host "brand-index.json 不是合法 JSON" -ForegroundColor Red; $ok = $false }
}

Write-Host ""
Write-Host "已安装 $count 个文件，$size MB" -ForegroundColor Green
Write-Host "SKILL.md 头部：" -ForegroundColor Cyan
Get-Content $skill -TotalCount 6 | ForEach-Object { Write-Host "  $_" }
if (-not $ok) { exit 1 }
Write-Host ""
Write-Host "完成。重启 agent 会话后生效；或让 agent 直接读取 $dest\SKILL.md" -ForegroundColor Green
