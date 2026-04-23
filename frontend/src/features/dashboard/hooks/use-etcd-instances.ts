import { useState, useEffect } from 'react'
import { EtcdInstance } from '../types/etcd.types'
import { getCookie } from '@/lib/cookies'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getAccessToken(): string | null {
  return getCookie('coredns_admin_access_token') || null
}


interface UseEtcdInstancesResult {
  instances: EtcdInstance[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useEtcdInstances(includeInactive: boolean = false): UseEtcdInstancesResult {
  const [instances, setInstances] = useState<EtcdInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstances = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = getAccessToken()
      if (!token) {
        throw new Error('Not logged in')
      }

      const response = await fetch(`${API_BASE_URL}/api/etcd-instances?include_inactive=${includeInactive}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get ETCD instances: ${response.status}`)
      }

      const data = await response.json()
      setInstances(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get ETCD instances')
      setInstances([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
  }, [includeInactive])

  return {
    instances,
    loading,
    error,
    refetch: fetchInstances
  }
}

export function useEtcdInstance(instanceId: number) {
  const [instance, setInstance] = useState<EtcdInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstance = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = getAccessToken()
      if (!token) {
        throw new Error('Not logged in')
      }

      const response = await fetch(`${API_BASE_URL}/api/etcd-instances/${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get ETCD instance: ${response.status}`)
      }

      const data = await response.json()
      setInstance(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get ETCD instance')
      setInstance(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (instanceId) {
      fetchInstance()
    }
  }, [instanceId])

  return {
    instance,
    loading,
    error,
    refetch: fetchInstance
  }
}

export function useEtcdInstanceStats() {
  const [stats, setStats] = useState<{
    total: number
    active: number
    inactive: number
    connected: number
    disconnected: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = getAccessToken()
      if (!token) {
        throw new Error('Not logged in')
      }

      const response = await fetch(`${API_BASE_URL}/api/etcd-instances/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get statistics: ${response.status}`)
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get statistics')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  }
}

export async function testEtcdConnection(instanceId: number): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${API_BASE_URL}/api/etcd-instances/${instanceId}/test-connection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Connection test failed')
    }

    const data = await response.json()
    return { success: true, data }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Connection test failed'
    }
  }
}

export async function setDefaultEtcdInstance(instanceId: number): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${API_BASE_URL}/api/etcd-instances/${instanceId}/set-default`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to set default instance')
    }

    const data = await response.json()
    return { success: true, data }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to set default instance'
    }
  }
}

export async function createEtcdInstance(data: any): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${API_BASE_URL}/api/etcd-instances`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create ETCD instance')
    }

    const result = await response.json()
    return { success: true, data: result }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to create ETCD instance'
    }
  }
}

export async function updateEtcdInstance(instanceId: number, data: any): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${API_BASE_URL}/api/etcd-instances/${instanceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update ETCD instance')
    }

    const result = await response.json()
    return { success: true, data: result }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to update ETCD instance'
    }
  }
}

export async function deleteEtcdInstance(instanceId: number): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${API_BASE_URL}/api/etcd-instances/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete ETCD instance')
    }

    const result = await response.json()
    return { success: true, data: result }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to delete ETCD instance'
    }
  }
}