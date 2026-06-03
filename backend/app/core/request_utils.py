"""从请求中解析客户端 IP（限流、审计用）。"""
from fastapi import Request


def client_ip(request: Request) -> str:
    # 经 Nginx/Caddy 反代时，真实 IP 在 X-Forwarded-For 最左侧
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
