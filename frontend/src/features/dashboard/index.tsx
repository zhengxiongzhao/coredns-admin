import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { useState } from 'react'
import { EtcdInstanceList } from './components/etcd-instance-list'
import { EtcdInstanceForm } from './components/etcd-instance-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Server, Activity } from 'lucide-react'
import { useEtcdInstances } from './hooks/use-etcd-instances'
import { EtcdInstance } from './types/etcd.types'


export function Dashboard() {
  const { instances, loading, error, refetch } = useEtcdInstances()
  const [showForm, setShowForm] = useState(false)
  const [editingInstance, setEditingInstance] = useState<EtcdInstance | null>(null)

  const handleAddInstance = () => {
    setEditingInstance(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingInstance(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Server className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Loading ETCD instances...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <p className="text-red-500">Load failed: {error}</p>
          <Button onClick={refetch} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} />
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>ETCD instance</h2>
            <p className='text-muted-foreground'>
              Manage ETCD instance connections, configure domains and DNS records
            </p>
          </div>
          <Button onClick={handleAddInstance}>
            <Plus className="mr-2 h-4 w-4" />
            Add ETCD Instance
          </Button>
        </div>

        {/* 统计信息 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{instances.length}</div>
              <p className="text-xs text-muted-foreground">
                {instances.filter(i => i.is_active).length} active
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {instances.filter(i => i.connection_status === 'connected').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Connected
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Default Instances</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {instances.filter(i => i.is_default).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Default
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Instances</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {instances.filter(i => i.connection_status === 'error').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Connection Error
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ETCD Instance List */}
        <EtcdInstanceList
          instances={instances}
          onRefresh={refetch}
          loading={loading}
        />

        {/* 添加/编辑表单模态框 */}
        {showForm && (
          <EtcdInstanceForm
            instance={editingInstance}
            onClose={handleFormClose}
          />
        )}
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Dashboard',
    href: '',
    isActive: true,
    disabled: false,
  }
]
