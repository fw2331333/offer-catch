ARG NODE_IMAGE=node:20-alpine
ARG NGINX_IMAGE=nginx:alpine

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=
WORKDIR /app

# 国内构建慢：在 .env 设置 NPM_REGISTRY=https://registry.npmmirror.com
RUN if [ -n "$NPM_REGISTRY" ]; then \
      npm config set registry "$NPM_REGISTRY"; \
    fi \
    && npm config set fetch-timeout 300000 \
    && npm config set fetch-retries 5 \
    && npm config set progress true \
    && npm config set loglevel info

COPY package.json package-lock.json ./
# 使用 lock + ci：更快、可复现；BuildKit 缓存加速重复构建
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
