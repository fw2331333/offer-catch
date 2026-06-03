# compose 可通过 PYTHON_IMAGE 覆盖；默认 Docker Hub 官方名
ARG PYTHON_IMAGE=python:3.11-slim
FROM ${PYTHON_IMAGE}

# compose / .env 可覆盖；国内服务器务必设 PIP_INDEX_URL（见 DEPLOY.md）
ARG DEBIAN_MIRROR=
ARG PIP_INDEX_URL=

WORKDIR /app

RUN if [ -n "$DEBIAN_MIRROR" ]; then \
      find /etc/apt -type f \( -name '*.sources' -o -name '*.list' \) \
        -exec sed -i "s|deb.debian.org|${DEBIAN_MIRROR}|g" {} + ; \
    fi \
    && apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
ENV PIP_DEFAULT_TIMEOUT=300 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
# 使用国内 PyPI 镜像，避免连 registry-1 / pypi.org 超时导致 exit code 2
RUN pip install --upgrade pip setuptools wheel \
    && if [ -n "$PIP_INDEX_URL" ]; then \
      pip install --no-cache-dir --retries 10 \
        -i "$PIP_INDEX_URL" \
        --trusted-host mirrors.aliyun.com \
        --trusted-host mirrors.cloud.tencent.com \
        --trusted-host pypi.org \
        --trusted-host files.pythonhosted.org \
        -r requirements.txt; \
    else \
      pip install --no-cache-dir --retries 10 -r requirements.txt; \
    fi

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["sh", "-c", "python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
