# CoreDNS Admin

Modern web-based management platform for CoreDNS DNS records stored in Etcd.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Manage A, AAAA, CNAME, MX, TXT, SRV, NS, PTR, SOA records
- Domain auto-discovery from Etcd
- DNS record conflict detection
- Multi-record support with CoreDNS-compatible sequencing
- Virtual domain management
- JWT authentication & RBAC

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/1.png" alt="Etcd Instance Management" width="100%"/>
      <br/>Etcd Instance Management
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/2.png" alt="Domain Management" width="100%"/>
      <br/>Domain Management
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/3.png" alt="DNS Records Management" width="100%"/>
      <br/>DNS Records Management
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/4.png" alt="Add Etcd Instance" width="100%"/>
      <br/>Add Etcd Instance
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/5.png" alt="Add Domain" width="100%"/>
      <br/>Add Domain
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/zhengxiongzhao/coredns-admin/master/docs/screenshots/6.png" alt="Add DNS Record" width="100%"/>
      <br/>Add DNS Record
    </td>
  </tr>
</table>

## Quick Start

### Standalone (CoreDNS Admin only)

```yaml
# docker-compose.yml
services:
  coredns-admin:
    image: zhengxiongzhao/coredns-admin:latest
    ports:
      - "3000:3000"
    environment:
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=admin123
    volumes:
      - admin-data:/app/data

volumes:
  admin-data:
    driver: local
```

```bash
docker-compose up -d
```

Access: **http://localhost:3000**

- **UserName**: admin
- **Password**: admin123

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `ADMIN_PASSWORD` | `admin123` | Admin login password |
| `ADMIN_EMAIL` | `admin@example.com` | Admin email |
| `JWT_SECRET_KEY` | auto-generated | JWT signing key |
| `JWT_EXPIRATION_HOURS` | `24` | JWT token expiry |

## Architecture

The image bundles all components in a single container:

```
┌───────────────────────────────┐
│     CoreDNS Admin Container   │
├───────────────────────────────┤
│  Nginx (port 3000)            │
│  ├─ Static frontend files     │
│  └─ Reverse proxy → Backend   │
│                                │
│  Uvicorn + Flask (port 55000) │
│  └─ REST API                  │
│                                │
│  Supervisord                   │
│  └─ Process manager           │
└───────────────────────────────┘
```

## Volumes

| Path | Description |
|------|-------------|
| `/app/data` | SQLite database (persistent data) |

## Supported Architectures

| Architecture | Tag |
|--------------|-----|
| `linux/amd64` | `latest` |
| `linux/arm64` | `latest` |

## Tags

- `latest` — latest stable release
- `x.y.z` — specific version (e.g. `0.1.0`)

## Source Code

GitHub: [https://github.com/zhengxiongzhao/coredns-admin](https://github.com/zhengxiongzhao/coredns-admin)

## License

MIT
