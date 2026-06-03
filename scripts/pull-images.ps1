# 预拉取 compose 所需基础镜像（无 .env 时从 .env.example 复制）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    Write-Host "未找到 .env，正在从 .env.example 复制..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 读取 .env 中的镜像变量
function Get-EnvValue($name, $default) {
    if (Test-Path ".env") {
        $line = Get-Content ".env" | Where-Object { $_ -match "^\s*$name=" } | Select-Object -First 1
        if ($line -match "=\s*(.+)$") { return $matches[1].Trim() }
    }
    return $default
}

$images = @(
    (Get-EnvValue "POSTGRES_IMAGE" "postgres:16-alpine"),
    (Get-EnvValue "REDIS_IMAGE" "redis:7-alpine"),
    (Get-EnvValue "PYTHON_IMAGE" "python:3.11-slim"),
    (Get-EnvValue "NODE_IMAGE" "node:20-alpine"),
    (Get-EnvValue "NGINX_IMAGE" "nginx:alpine")
)

Write-Host "将拉取以下镜像：" -ForegroundColor Cyan
$images | ForEach-Object { Write-Host "  $_" }

foreach ($img in $images) {
    Write-Host "`n>>> docker pull $img" -ForegroundColor Green
    docker pull $img --progress=plain
    if ($LASTEXITCODE -ne 0) {
        Write-Host "拉取失败: $img" -ForegroundColor Red
        Write-Host "请检查 Docker 镜像加速配置，或更换 .env 中的镜像地址。" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n全部基础镜像拉取完成。可执行: docker compose -p offer-hunter up -d --build" -ForegroundColor Green
