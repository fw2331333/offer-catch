# 将 .env 中 APP_PUBLIC_URL 设为本机局域网 IP（避免 QQ 邮箱 Invalid url）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$ip = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -ExpandProperty IPAddress -First 1
)

if (-not $ip) {
    Write-Host "未找到可用 IPv4，请手动编辑 .env 中的 APP_PUBLIC_URL" -ForegroundColor Red
    exit 1
}

$url = "http://${ip}:8080"
$content = Get-Content ".env" -Raw -Encoding UTF8
if ($content -match "(?m)^APP_PUBLIC_URL=.*$") {
    $content = $content -replace "(?m)^APP_PUBLIC_URL=.*$", "APP_PUBLIC_URL=$url"
} else {
    $content += "`nAPP_PUBLIC_URL=$url`n"
}
Set-Content -Path ".env" -Value $content.TrimEnd() -Encoding UTF8

Write-Host "已设置 APP_PUBLIC_URL=$url" -ForegroundColor Green
Write-Host "请执行: docker compose -p offer-hunter up -d --force-recreate api" -ForegroundColor Cyan
Write-Host "然后重新「忘记密码」发一封新邮件（旧邮件里的链接仍是旧地址）" -ForegroundColor Yellow
