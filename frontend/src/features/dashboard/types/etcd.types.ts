export interface EtcdInstance {
  id: number
  name: string
  host: string
  port: number
  base_path: string
  username?: string
  is_active: boolean
  is_default: boolean
  description?: string
  connection_status: 'connected' | 'disconnected' | 'unknown' | 'error'
  domain_count: number
  record_count: number
  last_check_time?: string
  created_at: string
  updated_at: string
}

export interface EtcdInstanceFormData {
  name: string
  host: string
  port: number
  base_path: string
  username?: string
  password?: string
  is_active: boolean
  is_default: boolean
  description?: string
}

export interface EtcdConnectionTestResult {
  instance_id: number
  status: 'connected' | 'disconnected'
  host: string
  port: number
  base_path: string
  last_check_time: string
}

export interface EtcdInstanceStats {
  total: number
  active: number
  inactive: number
  connected: number
  disconnected: number
}

export interface EtcdHealthStatus {
  instance_id: number
  name: string
  host: string
  port: number
  base_path: string
  status: 'healthy' | 'unhealthy' | 'error'
  connection_status: string
  error?: string
  last_check_time?: string
  checked_at: string
}

export interface EtcdHealthCheckAllResult {
  instances: EtcdHealthStatus[]
  statistics: {
    total: number
    healthy: number
    unhealthy: number
    error: number
  }
  checked_at: string
}