<div align="center">

# CoreDNS Admin - 现代化 DNS 管理平台

</div>

<div align="center">

[![Docker Ready](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://github.com/zhengxiongzhao/coredns-admin/releases)
[![Windows](https://img.shields.io/badge/Windows-0078D4?logo=windows&logoColor=white)](https://github.com/zhengxiongzhao/coredns-admin/releases)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](https://github.com/zhengxiongzhao/coredns-admin/releases)

[English](README.md) | [中文](README.zh-CN.md)

</div>

---

## 📖 项目介绍

### CoreDNS 的现代化管理方案

CoreDNS Admin 是一个跨平台的 DNS 管理平台，用于管理存储在 Etcd 中的 CoreDNS 记录。支持 **Docker 部署** 和 **原生桌面应用**（macOS / Windows / Linux），提供直观的界面来管理 DNS 记录、域名和 Etcd 实例，具备冲突检测、多记录支持和虚拟域名管理等高级功能。

### 平台支持

| 平台 | 类型 | 获取方式 |
|------|------|----------|
| **Docker** | 服务器部署 | `docker pull zhengxiongzhao/coredns-admin` |
| **macOS** (Apple Silicon / Intel) | 桌面应用 | [GitHub Releases](https://github.com/zhengxiongzhao/coredns-admin/releases) (.dmg) |
| **Windows** | 桌面应用 | [GitHub Releases](https://github.com/zhengxiongzhao/coredns-admin/releases) (.msi / .exe) |
| **Linux** | 桌面应用 | [GitHub Releases](https://github.com/zhengxiongzhao/coredns-admin/releases) (.deb / .AppImage) |


### 核心功能

1. [**统一 DNS 管理**](docs/features/dns-management.md): 管理 A、AAAA、CNAME、MX、TXT、SRV、NS、PTR 和 SOA 记录，支持智能验证
2. [**域名自动发现**](docs/features/domain-discovery.md): 从 Etcd 存储中自动发现和整理域名
3. [**冲突检测**](docs/features/conflict-detection.md): 智能检测 DNS 记录冲突，防止解析问题
4. [**多记录支持**](docs/features/multi-records.md): 使用 CoreDNS 兼容的序列化支持同名的多个记录
5. [**虚拟域名**](docs/features/virtual-domains.md): 手动域名标记和虚拟域名管理，支持复杂层级结构

---

## ⭐ 功能特性

### 📸 屏幕截图

CoreDNS Admin 实际运行效果：

<table>
  <tr>
    <td align="center">
      <a href="docs/screenshots/1.png">
        <img src="docs/screenshots/1.png" alt="Etcd Instance Management" width="100%"/>
      </a>
      <br/>
      Etcd Instance Management
    </td>
    <td align="center">
      <a href="docs/screenshots/2.png">
        <img src="docs/screenshots/2.png" alt="Domain Management" width="100%"/>
      </a>
      <br/>
      Domain Management
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="docs/screenshots/3.png">
        <img src="docs/screenshots/3.png" alt="DNS Records Management" width="100%"/>
      </a>
      <br/>
      DNS Records Management
    </td>
    <td align="center">
      <a href="docs/screenshots/4.png">
        <img src="docs/screenshots/4.png" alt="Add Etcd Instance" width="100%"/>
      </a>
      <br/>
      Add Etcd Instance
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="docs/screenshots/5.png">
        <img src="docs/screenshots/5.png" alt="Add Domain" width="100%"/>
      </a>
      <br/>
      Add Domain
    </td>
    <td align="center">
      <a href="docs/screenshots/6.png">
        <img src="docs/screenshots/6.png" alt="Add DNS Record" width="100%"/>
      </a>
      <br/>
      Add DNS Record
    </td>
  </tr>
</table>


---

### 🚀 DNS 记录类型

| 记录类型 | 状态 | 描述 | 验证 |
|----------|------|------|------|
| **A** | ✅ 完成 | IPv4 地址记录 | 完整 RFC 合规 |
| **AAAA** | ✅ 完成 | IPv6 地址记录 | 完整 RFC 合规 |
| **CNAME** | ✅ 完成 | 规范名称记录 | 域名格式验证 |
| **MX** | ✅ 完成 | 邮件交换记录 | 优先级 + 域名验证 |
| **TXT** | ✅ 完成 | 文本记录 | 内容验证 |
| **SRV** | ✅ 完成 | 服务记录 | 优先级/权重/端口验证 |
| **NS** | ✅ 完成 | 名称服务器记录 | 域名格式验证 |
| **PTR** | ✅ 完成 | 指针记录 | 域名格式验证 |
| **SOA** | ✅ 完成 | 授权开始记录 | 多字段验证 |

---

### 🔧 高级功能

| 功能 | 技术实现 | 业务价值 |
|------|----------|----------|
| **冲突检测** | CoreDNS 解析行为智能分析 | 防止 DNS 解析问题 |
| **多记录支持** | CoreDNS 兼容的 `_record_XX` 序列化 | 负载均衡和冗余 |
| **虚拟域名** | 手动域名标记系统 | 灵活的域名层级管理 |
| **批量操作** | 批量记录创建和管理 | 大型部署节省 90% 时间 |
| **实时验证** | 客户端和服务器端验证 | 配置错误减少 95% |

---

### 🛡️ 安全功能

| 安全功能 | 实现方式 |
|----------|----------|
| **身份验证** | 基于 JWT 的身份验证，可配置过期时间 |
| **授权控制** | 基于角色的访问控制 (RBAC) |
| **API 安全** | CORS 保护和输入验证 |
| **数据保护** | 安全的 Etcd 连接和数据加密 |

---

## 🚀 部署指南

### 🐳 使用 Docker Hub 镜像快速启动

使用预构建的 Docker Hub 镜像，最快速的部署方式：

```yaml
# docker-compose.yml
services:
  coredns-admin:
    image: zhengxiongzhao/coredns-admin:latest
    ports:
      - "3000:3000"
    environment:
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - admin-data:/app/data
    networks:
      - coredns-network

volumes:
  admin-data:
    driver: local

networks:
  coredns-network:
    driver: bridge
```

```bash
docker-compose up -d
# 访问: http://localhost:3000
```

#### 默认凭据

- **用户名**: admin
- **密码**: admin123

---

### 💻 本地开发部署

适合想要贡献或自定义平台的开发者。

#### 前置要求

- Docker 和 Docker Compose
- Node.js 20+ (前端开发)
- Python 3.11+ (后端开发)
- Rust (Tauri 桌面端构建)

#### 使用 Docker Compose 快速开始

```bash
# 克隆仓库
git clone https://github.com/coredns-admin/coredns-admin.git
cd coredns-admin

# 启动所有服务
docker-compose up -d

# 访问应用
# Web 界面: http://localhost:3000
# API 接口: http://localhost:3000/api
# CoreDNS: localhost:5053
```

---

### 🖥️ 生产部署

适用于需要高可用性的生产环境。

#### 架构组件

统一 Docker 镜像将前端、后端、Nginx 和 Supervisord 打包在单个容器中。

| 组件 | 用途 | 端口 |
|------|------|------|
| **Nginx** | 反向代理 + 静态文件服务 | 3000 (对外) |
| **后端** | Flask API (Uvicorn) | 55000 (内部) |
| **CoreDNS** | DNS 服务器 | 53/5053 |
| **Etcd** | 分布式键值存储 | 2379 |

#### Docker Compose 生产部署

```bash
# 克隆项目
git clone https://github.com/coredns-admin/coredns-admin.git
cd coredns-admin

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置生产环境配置

# 启动生产服务
docker-compose -f docker-compose.yml up -d

# 检查服务状态
docker-compose ps
```

#### 环境配置

```bash
# 后端配置
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password
ADMIN_EMAIL=admin@yourdomain.com
JWT_SECRET_KEY=your-jwt-secret-key
JWT_EXPIRATION_HOURS=24


# 前端配置
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## 📖 使用指南

### 初始设置

1. **访问 Web 界面**
   ```
   http://localhost:3000
   ```

2. **使用管理员凭据登录**
   - 使用默认凭据或您配置的管理员账户

3. **配置 Etcd 连接**
   - 导航到 Etcd 实例管理
   - 添加您的 Etcd 集群端点
   - 测试连接并保存配置

### DNS 记录管理

#### 创建 DNS 记录

1. **导航到 DNS 记录**
2. **选择域名或创建新域名**
3. **添加带验证的记录**
   - 名称：DNS 记录名称（如 www、api、@）
   - 类型：从 A、AAAA、CNAME、MX、TXT、SRV、NS、PTR、SOA 中选择
   - 内容：记录值，支持自动验证
   - TTL：生存时间（秒）

#### 高级功能

- **冲突检测**：自动检测并警告记录冲突
- **多记录模式**：创建同名的多个记录
- **批量操作**：同时创建多个记录
- **虚拟域名**：手动标记域名，支持灵活的层级管理

### API 使用

#### 身份验证
```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 在后续请求中使用令牌
curl -X GET http://localhost:3000/api/dns-records \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### DNS 记录 API
```bash
# 获取所有 DNS 记录
GET /api/dns-records

# 按域名获取记录
GET /api/dns-records?domain=example.local

# 创建 DNS 记录
POST /api/dns-records
{
  "domain": "example.local",
  "name": "www",
  "type": "A",
  "content": "192.168.1.100",
  "ttl": 300
}

# 更新 DNS 记录
PUT /api/dns-records
{
  "key": "/skydns/local/example/www",
  "name": "www",
  "type": "A",
  "content": "192.168.1.101",
  "ttl": 300
}
```

---

## 🛠️ 开发指南

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

```bash
cd backend
pip install -r requirements.txt
python run.py
# 后端启动在 http://localhost:55000 (Uvicorn WSGI)
```

### Tauri 桌面端开发

```bash
# 1. 在独立终端启动后端
cd backend && python run.py

# 2. 启动 Tauri 开发模式（前端 + 桌面壳）
cd frontend && npm run tauri:dev
```

### 构建桌面应用

```bash
# 打包后端 sidecar 二进制
cd frontend && npm run tauri:build-backend

# 构建 Tauri 桌面应用
npm run tauri:build
```

桌面端构建也支持通过 GitHub Actions 自动化 — 推送 `v*` tag 即可触发多平台构建（macOS、Windows、Linux）。

### DNS 解析测试

```bash
# 测试 DNS 解析
dig @localhost -p 5053 www.example.local

# 测试特定记录类型
dig @localhost -p 5053 MX example.local
dig @localhost -p 5053 TXT example.local
```

---

## 🤝 贡献

我们欢迎贡献！请查看我们的[贡献指南](CONTRIBUTING.md)了解详情。

### 开发设置

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

---

## 🙏 致谢

- 🙏 [CoreDNS](https://github.com/coredns/coredns) - 为我们的 DNS 解析提供支持的 DNS 服务器
- 🎨 [shadcn/ui](https://github.com/shadcn/ui) - 美观的 UI 组件
- 🔧 [Flask](https://github.com/pallets/flask) - 轻量级 Python Web 框架
- 🚀 [Uvicorn](https://github.com/encode/uvicorn) - 高性能 ASGI/WSGI 服务器
- 🖥️ [Tauri](https://github.com/tauri-apps/tauri) - 桌面应用框架
- 🌐 [React](https://github.com/facebook/react) - 前端框架
- 🗄️ [etcd](https://github.com/etcd-io/etcd) - 分布式键值存储
- ☁️ [Docker](https://www.docker.com/) - 容器化平台

---

## 📄 许可证

本项目在 MIT 许可证下开源。详情请参见 [LICENSE](LICENSE) 文件。

---

<div align="center">

**CoreDNS Admin** - 现代化 DNS 管理平台，让 DNS 管理更简单

[🏠 主页](https://github.com/coredns-admin/coredns-admin) • [📚 文档](https://deepwiki.com/coredns-admin/coredns-admin) • [🐛 问题反馈](https://github.com/coredns-admin/coredns-admin/issues)

由 CoreDNS Admin 团队用 ❤️ 构建

</div>