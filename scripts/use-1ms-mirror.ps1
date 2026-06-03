# 将 .env 中的基础镜像改为 docker.1ms.run 前缀（Hub 慢或 daocloud DNS 失败时使用）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$envPath = ".env"
if (-not (Test-Path $envPath)) {
    Copy-Item ".env.example" $envPath
}

$content = Get-Content $envPath -Raw
$content = $content -replace '(?m)^#?\s*POSTGRES_IMAGE=.*$', 'POSTGRES_IMAGE=docker.1ms.run/library/postgres:16-alpine'
$content = $content -replace '(?m)^#?\s*REDIS_IMAGE=.*$', 'REDIS_IMAGE=docker.1ms.run/library/redis:7-alpine'
$content = $content -replace '(?m)^#?\s*PYTHON_IMAGE=.*$', 'PYTHON_IMAGE=docker.1ms.run/library/python:3.11-slim'
$content = $content -replace '(?m)^#?\s*NODE_IMAGE=.*$', 'NODE_IMAGE=docker.1ms.run/library/node:20-alpine'
$content = $content -replace '(?m)^#?\s*NGINX_IMAGE=.*$', 'NGINX_IMAGE=docker.1ms.run/library/nginx:alpine'
Set-Content -Path $envPath -Value $content.TrimEnd() -Encoding utf8

Write-Host "已写入 docker.1ms.run 镜像地址到 .env" -ForegroundColor Green
Write-Host "下一步: docker compose -p offer-hunter up -d --build" -ForegroundColor Cyan
