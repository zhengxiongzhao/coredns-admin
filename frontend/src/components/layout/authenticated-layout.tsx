import { Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { useAuthStore } from '@/stores/auth-store'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  // 验证用户认证状态
  useEffect(() => {
    const verifyAuth = async () => {
      if (!auth.accessToken) {
        navigate({ to: '/sign-in', replace: true })
        return
      }

      try {
        const response = await api.auth.verifyToken(auth.accessToken)
        if (!response.ok) {
          // 令牌无效，清除认证状态并重定向到登录页
          auth.reset()
          navigate({ to: '/sign-in', replace: true })
        }
      } catch (error) {
        // 网络错误，清除认证状态并重定向到登录页
        auth.reset()
        navigate({ to: '/sign-in', replace: true })
      }
    }

    verifyAuth()
  }, [auth.accessToken, navigate, auth])

  // 如果没有访问令牌，不渲染内容（正在重定向）
  if (!auth.accessToken) {
    return null
  }

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
