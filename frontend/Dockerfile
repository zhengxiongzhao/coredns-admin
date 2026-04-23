# Build stage
FROM node:25-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and essential config
COPY package*.json pnpm-lock.yaml ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./

# Install dependencies with retry logic and fallback
RUN if [ -f "pnpm-lock.yaml" ]; then \
        echo "Using pnpm with lockfile..." && \
        (pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile) || \
        (echo "pnpm install failed, trying npm..." && npm install); \
    else \
        echo "No lockfile found, using npm..." && \
        npm install; \
    fi

# Copy source code
COPY . .

# Build the application
RUN if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then \
        pnpm run build; \
    else \
        npm run build; \
    fi

# Production stage
FROM nginx:1.30-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Use existing nginx user (already created in nginx:alpine image)
# Just ensure proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d &&\
    touch /run/nginx.pid && chown nginx:nginx /run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]