# 显式传入构建镜像地址，避免 Docker Desktop 全局镜像把 python:3.11-slim 转到 xuanyuan 导致 429
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

function Get-EnvValue($name, $default) {
    $line = Get-Content ".env" | Where-Object { $_ -match "^\s*$name=" } | Select-Object -First 1
    if ($line -match "=\s*(.+)$") { return $matches[1].Trim() }
    return $default
}

$env:PYTHON_IMAGE = Get-EnvValue "PYTHON_IMAGE" "python:3.11-slim"
$env:NODE_IMAGE = Get-EnvValue "NODE_IMAGE" "node:20-alpine"
$env:NGINX_IMAGE = Get-EnvValue "NGINX_IMAGE" "nginx:alpine"
$env:POSTGRES_IMAGE = Get-EnvValue "POSTGRES_IMAGE" "postgres:16-alpine"
$env:REDIS_IMAGE = Get-EnvValue "REDIS_IMAGE" "redis:7-alpine"

Write-Host "PYTHON_IMAGE=$env:PYTHON_IMAGE" -ForegroundColor Cyan
Write-Host "NODE_IMAGE=$env:NODE_IMAGE" -ForegroundColor Cyan

docker compose -p offer-hunter build --no-cache api web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker compose -p offer-hunter up -d
Write-Host "`n完成: http://localhost:8080" -ForegroundColor Green
