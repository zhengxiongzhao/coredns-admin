# Multi-stage build for unified CoreDNS Admin image
# This builds frontend and backend in a single image

# Stage 1: Frontend Build
FROM node:25-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci && npm cache clean --force

COPY frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
COPY frontend/public ./public

# Build frontend
RUN NODE_ENV=production npm run build

# Verify build
RUN ls -lah dist/

# Stage 2: Backend Build
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend
RUN mkdir -p /app/data

# Install build dependencies (including cmake and Rust for libsql-experimental)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    cmake \
    pkg-config \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain (required by libsql-experimental/maturin)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --user -r requirements.txt

# Stage 3: Production Image
FROM python:3.11-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    ca-certificates \
    gcc \
    g++ \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    cmake \
    make \
    && rm -rf /var/lib/apt/lists/*


# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Setup working directories
WORKDIR /app

# Copy installed Python packages from backend-builder to system site-packages
COPY --from=backend-builder /root/.local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /root/.local/bin /usr/local/bin

# Copy backend application
COPY --chown=appuser:appuser backend/ ./backend/

# Copy frontend from frontend-builder
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist /var/www/html

# Copy configuration files
COPY --chown=appuser:appuser nginx.conf /etc/nginx/nginx.conf
COPY --chown=appuser:appuser supervisord.conf /app/supervisord.conf

# Create necessary directories with proper permissions
RUN mkdir -p /var/lib/nginx/tmp /var/log/nginx /var/log/supervisord /var/log/backend /app/backend /app/data /tmp && \
    chown -R appuser:appuser /var/www/html /var/lib/nginx /var/log/nginx /var/log/supervisord /var/log/backend /app /etc/nginx 

# Switch to non-root user
USER appuser

# Expose both frontend and backend ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start both services with supervisor

# CMD ["nginx", "-g", "daemon off;"]
# WORKDIR /app/backend
# CMD ["python", "run.py"]

CMD ["supervisord", "-c", "/app/supervisord.conf"]


