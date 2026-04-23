import { useState } from 'react'
import { EtcdInstance } from '../types/etcd.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import {
  Server,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  Star,
  StarOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TestTube
} from 'lucide-react'
import { deleteEtcdInstance, setDefaultEtcdInstance, testEtcdConnection } from '../hooks/use-etcd-instances'
import useDialogState from '@/hooks/use-dialog-state'
import { EtcdInstanceForm } from './etcd-instance-form'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface EtcdInstanceListProps {
  instances: EtcdInstance[]
  onRefresh: () => void
  loading?: boolean
}

export function EtcdInstanceList({ instances, onRefresh, loading = false }: EtcdInstanceListProps) {
  const [selectedInstance, setSelectedInstance] = useState<EtcdInstance | null>(null)
  const [deleteInstance, setDeleteInstance] = useState<EtcdInstance | null>(null)
  const [open, setOpen] = useDialogState<boolean>()

  const handleEdit = (instance: EtcdInstance) => {
    setSelectedInstance(instance)
    setOpen(true)
  }

  const handleDelete = (instance: EtcdInstance) => {
    setDeleteInstance(instance)
  }

  const confirmDelete = async () => {
    if (!deleteInstance) return

    try {
      const result = await deleteEtcdInstance(deleteInstance.id)
      if (result.success) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete instance:', error)
    } finally {
      setDeleteInstance(null)
    }
  }

  const handleSetDefault = async (instance: EtcdInstance) => {
    try {
      const result = await setDefaultEtcdInstance(instance.id)
      if (result.success) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to set default instance:', error)
    }
  }

  const handleTestConnection = async (instance: EtcdInstance) => {
    try {
      const result = await testEtcdConnection(instance.id)
      if (result.success) {
        alert(`Connection test successful: ${result.data?.status || 'Connected'}`)
      } else {
        alert(`Connection test failed: ${result.error || 'Unknown error'}`)
      }
      onRefresh()
    } catch (error) {
      console.error('Connection test failed:', error)
      alert('Connection test error')
    }
  }

  const handleToggleStatus = async (instance: EtcdInstance) => {
    try {
      // 这里需要实现状态切换的API调用
      console.log('Toggle instance status:', instance.id, !instance.is_active)
      onRefresh()
    } catch (error) {
      console.error('Failed to toggle instance status:', error)
    }
  }

  const getStatusBadge = (instance: EtcdInstance) => {
    if (!instance.is_active) {
      return <Badge variant="secondary" className="flex items-center gap-1"><Pause className="h-3 w-3" />Disabled</Badge>
    }
    
    switch (instance.connection_status) {
      case 'connected':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Connected</Badge>
      case 'disconnected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Disconnected</Badge>
      case 'connecting' as any:
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Connecting</Badge>
      default:
        return <Badge variant="outline" className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Unknown</Badge>
    }
  }

  const getConnectionInfo = (instance: EtcdInstance) => {
    return `${instance.host}:${instance.port}${instance.base_path}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            ETCD Instance List
          </CardTitle>
          <CardDescription>Manage your ETCD instance connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (instances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            ETCD Instance List
          </CardTitle>
          <CardDescription>Manage your ETCD instance connections</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              No ETCD instances found. Please add an ETCD instance to start managing your domains and DNS records.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            ETCD Instance List
          </CardTitle>
          <CardDescription>Manage your ETCD instance connections</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Connection Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Last Connected</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {instance.is_default && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                      <div>
                        <div className="font-medium">{instance.name}</div>
                        {instance.description && (
                          <div className="text-sm text-gray-500">{instance.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="font-mono text-sm">
                      {getConnectionInfo(instance)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getStatusBadge(instance)}
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline">{instance.domain_count ?? 0}</Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Badge variant="outline">{instance.record_count ?? 0}</Badge>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {instance.last_check_time
                        ? new Date(instance.last_check_time).toLocaleString('en-US')
                        : 'Never connected'
                      }
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(instance)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => handleTestConnection(instance)}>
                          <TestTube className="mr-2 h-4 w-4" />
                          Test Connection
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => handleToggleStatus(instance)}>
                          {instance.is_active ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        
                        {!instance.is_default && (
                          <DropdownMenuItem onClick={() => handleSetDefault(instance)}>
                            <Star className="mr-2 h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        
                        {instance.is_default && (
                          <DropdownMenuItem disabled>
                            <StarOff className="mr-2 h-4 w-4" />
                            Current Default
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuItem 
                          onClick={() => handleDelete(instance)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 编辑表单对话框 */}
      {open && selectedInstance && (
        <EtcdInstanceForm
          instance={selectedInstance}
          onClose={() => {
            setOpen(false)
            setSelectedInstance(null)
          }}
          onSave={onRefresh}
        />
      )}

      {/* 删除确认对话框 */}
      {deleteInstance && (
        <ConfirmDialog
          open={!!deleteInstance}
          onOpenChange={() => setDeleteInstance(null)}
          title="Delete ETCD Instance"
          desc={`Are you sure you want to delete ETCD instance "${deleteInstance.name}"? This will delete all configurations for this instance, but will not delete data in ETCD.`}
          handleConfirm={confirmDelete}
          confirmText="Delete"
          cancelBtnText="Cancel"
          destructive={true}
        />
      )}
    </>
  )
}