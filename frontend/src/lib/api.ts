import { getCookie, removeCookie } from '@/lib/cookies'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// 获取存储的访问令牌
function getAccessToken(): string | null {
  return getCookie('coredns_admin_access_token') || null
}

// 处理需要认证的API响应
async function handleAuthResponse(response: Response): Promise<Response> {
  if (response.status === 401) {
    // 清除本地认证状态
    removeCookie('coredns_admin_access_token')
    // 重定向到登录页
    window.location.href = '/sign-in'
    return Promise.reject(new Error('Authentication required'))
  }
  return response
}

export const api = {
 config: {
   getEtcdBasePath: () => {
     const token = getAccessToken()
     return fetch(`${API_BASE_URL}/api/config/etcd-base-path`, {
       headers: token ? { 'Authorization': `Bearer ${token}` } : {}
     }).then(handleAuthResponse)
   },
   setEtcdBasePath: (data: any) => {
     const token = getAccessToken()
     return fetch(`${API_BASE_URL}/api/config/etcd-base-path`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': token ? `Bearer ${token}` : ''
       },
       body: JSON.stringify(data)
     }).then(handleAuthResponse)
   }
 },
  domains: {
    getAll: (domain?: string, basePath?: string, showVirtual?: boolean) => {
      const token = getAccessToken()
      const url = new URL(`${API_BASE_URL}/api/domains`, window.location.origin)
      if (domain) url.searchParams.append('domain', domain)
      if (basePath) url.searchParams.append('base_path', basePath)
      if (showVirtual) url.searchParams.append('show_virtual', 'true')
      return fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(handleAuthResponse)
    },
    create: (data: any) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      }).then(handleAuthResponse)
    },
    update: (data: any) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/domains`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      }).then(handleAuthResponse)
    },
    delete: (path: string) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/domains?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(handleAuthResponse)
    },
    mark: (data: { path: string; domain: string; space: string; mark: boolean }) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/domains/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      })
    }
  },
  dnsRecords: {
    getAll: (domain?: string, basePath?: string, instanceId?: number) => {
      const token = getAccessToken()
      const url = new URL(`${API_BASE_URL}/api/dns-records`, window.location.origin)
      if (domain) url.searchParams.append('domain', domain)
      if (basePath) url.searchParams.append('base_path', basePath)
      if (instanceId) url.searchParams.append('instance_id', String(instanceId))
      return fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(handleAuthResponse)
    },
    create: (data: any) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/dns-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      }).then(handleAuthResponse)
    },
    createBatch: (data: any[]) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/dns-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      }).then(handleAuthResponse)
    },
    update: (data: any) => {
      const token = getAccessToken()
      return fetch(`${API_BASE_URL}/api/dns-records`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      }).then(handleAuthResponse)
    },
    delete: (keys: string[]) => {
      const token = getAccessToken()
      const url = new URL(`${API_BASE_URL}/api/dns-records`, window.location.origin)
      keys.forEach(key => url.searchParams.append('keys', key))
      return fetch(url.toString(), {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      }).then(handleAuthResponse)
    }
  },
  auth: {
    login: (username: string, password: string) => {
      return fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
    },
    getCurrentUser: (token: string) => {
      return fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    },
    changePassword: (oldPassword: string, newPassword: string, token: string) => {
      return fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      })
    },
    verifyToken: (token: string) => {
      return fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    }
  }
}

export function handleApiError(error: any): string {
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  if (error.message) {
    return error.message
  }
  return 'An unexpected error occurred'
}