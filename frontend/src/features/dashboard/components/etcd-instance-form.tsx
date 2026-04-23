import { useState, useEffect } from 'react'
import { EtcdInstance } from '../types/etcd.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createEtcdInstance, updateEtcdInstance } from '../hooks/use-etcd-instances'
import { getCookie } from '@/lib/cookies'
import { Server, Save, X, TestTube, Loader2 } from 'lucide-react'


interface EtcdInstanceFormProps {
  instance: EtcdInstance | null
  onClose: () => void
  onSave?: () => void
}

export function EtcdInstanceForm({ instance, onClose, onSave }: EtcdInstanceFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 2379,
    base_path: '/skydns',
    username: '',
    password: '',
    is_active: true,
    is_default: false,
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    if (instance) {
      setFormData({
        name: instance.name,
        host: instance.host,
        port: instance.port,
        base_path: instance.base_path,
        username: instance.username || '',
        password: '',
        is_active: instance.is_active,
        is_default: instance.is_default,
        description: instance.description || ''
      })
    }
  }, [instance])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleTestConnection = async () => {
    if (!formData.host || !formData.port) {
      setError('Host address and port are required')
      return
    }

    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const token = getCookie('coredns_admin_access_token') || null
      
      // Test connection - use instance ID or test parameters
      let response
      if (instance) {
        // If editing existing instance, use instance ID to test
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/etcd-instances/${instance.id}/test-connection`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        })
      } else {
        // If new instance, use test parameters
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/etcd-instances/test-connection`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            host: formData.host,
            port: formData.port,
            username: formData.username,
            password: formData.password,
            base_path: formData.base_path
          })
        })
      }

      if (response.ok) {
        const result = await response.json()
        setTestResult(`Connection test successful: ${result.status}`)
      } else {
        const error = await response.json()
        setTestResult(`Connection test failed: ${error.error}`)
      }
    } catch (err) {
      setTestResult('Connection test error')
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 验证必填字段
    if (!formData.name || !formData.host || !formData.port) {
      setError('Name, host address and port are required fields')
      setLoading(false)
      return
    }

    // 验证端口范围
    if (formData.port < 1 || formData.port > 65535) {
      setError('Port must be between 1-65535')
      setLoading(false)
      return
    }

    // 验证base_path格式
    if (!formData.base_path.startsWith('/')) {
      setError('Base Path must start with /')
      setLoading(false)
      return
    }

    try {
      let result
      if (instance) {
        // Update instance
        result = await updateEtcdInstance(instance.id, formData)
      } else {
        // Create new instance
        result = await createEtcdInstance(formData)
      }

      if (result.success) {
        onSave?.()
        onClose()
      } else {
        setError(result.error || 'Operation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {instance ? 'Edit ETCD Instance' : 'Add ETCD Instance'}
          </DialogTitle>
          <DialogDescription>
            {instance ? 'Update ETCD instance configuration' : 'Configure new ETCD instance connection'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Basic configuration information for ETCD instance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Instance Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., production-etcd"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="host">Host Address *</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => handleInputChange('host', e.target.value)}
                    placeholder="e.g., 127.0.0.1 or etcd.example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port">Port *</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                    placeholder="2379"
                    min="1"
                    max="65535"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="base_path">Base Path *</Label>
                  <Input
                    id="base_path"
                    value={formData.base_path}
                    onChange={(e) => handleInputChange('base_path', e.target.value)}
                    placeholder="/skydns"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username (Optional)</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Authentication username"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password (Optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Authentication password"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Configuration</CardTitle>
              <CardDescription>Instance enable status and default settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Enable Instance</Label>
                  <p className="text-sm text-gray-500">Enable this ETCD instance</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_default">Set as Default</Label>
                  <p className="text-sm text-gray-500">Set this instance as the default ETCD instance</p>
                </div>
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => handleInputChange('is_default', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
              <CardDescription>Detailed description information for the instance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the purpose and characteristics of this ETCD instance"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {testResult && (
            <Alert>
              <AlertDescription>{testResult}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          
          <Button
            type="submit"
            form="etcd-instance-form"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {instance ? 'Update' : 'Create'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}