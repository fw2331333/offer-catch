# Offer 捕手 - Docker 一键启动
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "已创建 .env，请填写 DEEPSEEK_API_KEY 与 SMTP 后重新运行" -ForegroundColor Yellow
}

Write-Host "预拉取基础镜像..." -ForegroundColor Cyan
& "$PSScriptRoot\pull-images.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n正在构建并启动 Docker 服务（项目名: offer-hunter）..." -ForegroundColor Cyan
docker compose -p offer-hunter up -d --build

Write-Host ""
Write-Host "启动完成！" -ForegroundColor Green
Write-Host "  前端: http://localhost:8080"
Write-Host "  API:  http://localhost:8001/docs"
Write-Host "  演示账号: demo@student.edu / demo1234"
Write-Host ""
Write-Host "查看日志: docker compose -p offer-hunter logs -f api"
Write-Host "停止服务: docker compose -p offer-hunter down"
