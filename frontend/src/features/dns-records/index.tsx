import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { DnsRecordsTable } from './components/dns-records-table'
import { DnsRecordsProvider } from './components/dns-records-provider'
import { DnsRecordsDialogs } from './components/dns-records-dialogs'
import { DnsRecordsPrimaryButtons } from './components/dns-records-primary-buttons'

const route = getRouteApi('/_authenticated/dns-records/')

interface DnsRecordsProps {
  domain?: string
  instanceId?: number
}

export function DnsRecords({ domain, instanceId }: DnsRecordsProps) {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // 确保domain参数正确传递
  // 确保domain参数正确传递，优先使用props传入的domain
  const tableSearch = { ...search, domain: domain, instance_id: instanceId }

  return (
    <DnsRecordsProvider domain={domain} instanceId={instanceId}>
      <Header fixed>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/domains' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Domain List
          </Button>
          {domain && (
            <Badge variant="secondary" className="text-sm">
              Current Domain: {domain}
            </Badge>
          )}
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>DNS Records</h2>
            <p className='text-muted-foreground'>
              {domain
                ? `Manage DNS records for domain "${domain}"`
                : 'Browse all DNS records. Select a domain to manage its DNS records'}
            </p>
            {!domain && (
              <p className='text-sm text-muted-foreground mt-1'>
                Choose a domain to manage its DNS records
              </p>
            )}
          </div>
          <DnsRecordsPrimaryButtons />
        </div>
        <DnsRecordsTable search={tableSearch} navigate={navigate} />
      </Main>

      <DnsRecordsDialogs />
    </DnsRecordsProvider>
  )
}
