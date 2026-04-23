import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DomainsTable } from '@/features/domains/components/domains-table'
import { DomainsProvider } from '@/features/domains/components/domains-provider'
import { DomainsDialogs } from '@/features/domains/components/domains-dialogs'
import { DomainsPrimaryButtons } from '@/features/domains/components/domains-primary-buttons'

const route = getRouteApi('/_authenticated/domains/')

interface DomainsProps {
  domain?: string
  showVirtual?: boolean
}

export function Domains({ domain, showVirtual }: DomainsProps) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  
  console.log('Domains组件接收参数:', { domain, showVirtual, search })

  // 确保 showVirtual 参数正确传递到表格组件
  const tableSearch = { ...search, domain, showVirtual }
  console.log('传递给表格组件的search参数:', tableSearch)

  return (
    <DomainsProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Domains</h2>
            <p className='text-muted-foreground'>
              Manage your domains here.
            </p>
          </div>
          <DomainsPrimaryButtons />
        </div>
        <DomainsTable search={tableSearch} navigate={navigate} />
      </Main>

      <DomainsDialogs />
    </DomainsProvider>
  )
}
