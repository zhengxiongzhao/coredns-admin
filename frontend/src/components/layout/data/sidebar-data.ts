import {
  LayoutDashboard,
  Command,
  Globe,
  Database,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'admin@example.com',
    avatar: '/avatars/default.jpg',
  },
  teams: [
    {
      name: 'DNS Admin',
      logo: Command,
      plan: 'DNS Management',
    },
  ],
  navGroups: [
    {
      title: 'Main',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Domains',
          url: '/domains',
          icon: Globe,
        },
        {
          title: 'DNS Records',
          url: '/dns-records',
          icon: Database,
        },
      ],
    }
    // {
    //   title: 'Settings',
    //   items: [
    //     {
    //       title: 'Settings',
    //       url: '/settings',
    //       icon: Settings,
    //     },
    //   ],
    // }
  ],
}
