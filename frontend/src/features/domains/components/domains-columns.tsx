import { type ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { type Domain } from '../data/schema'
import { DomainsRowActions } from './domains-row-actions'
import { Tag, Bookmark, BookmarkMinus } from 'lucide-react'
import { api } from '@/lib/api'

export const columns: ColumnDef<Domain>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'domain-type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="" />
    ),
    cell: ({ row }) => {
      const domain = row.original
      const isVirtual = domain.is_virtual
      const isMarked = domain.is_marked_as_domain
      
      return (
        <div className="flex items-center justify-center gap-1">
          {isMarked && isVirtual && (
            <div className="flex items-center gap-1" title="虚拟标记Domain（系统分支节点+用户标记）">
              <Tag className="h-4 w-4 text-purple-500" />
              <Badge variant="default" className="text-xs">
                Virtual Mark
              </Badge>
            </div>
          )}
          {isMarked && !isVirtual && (
            <div className="flex items-center gap-1" title="已标记为Domain">
              <Tag className="h-4 w-4 text-primary" />
              <Badge variant="default" className="text-xs">
                Marked
              </Badge>
            </div>
          )}
          {!isMarked && isVirtual && (
            <div className="flex items-center gap-1" title="虚拟域名（系统分支节点）">
              <Tag className="h-4 w-4 text-blue-500" />
              <Badge variant="outline" className="text-xs">
                Virtual
              </Badge>
            </div>
          )}
          {!isMarked && !isVirtual && (
            <div className="flex items-center gap-1" title="默认第二级域名">
              <Tag className="h-4 w-4 text-gray-400" />
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            </div>
          )}
        </div>
      )
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: 'domain',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Domain" />
    ),
    cell: ({ row }) => {
      const domain = row.getValue('domain') as string
      const recordCount = row.original.record_count || 0
      return (
        <div className="flex flex-col">
          <Link
            to="/dns-records"
            search={{ domain, instance_id: row.original.instance_id }}
            className="hover:underline font-medium"
          >
            {domain}
          </Link>
          <span className="text-xs text-muted-foreground">
            {recordCount} records
          </span>
        </div>
      )
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: 'space',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Space" />
    ),
    cell: ({ row }) => <div>{row.getValue('space')}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: 'path',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Path" />
    ),
    cell: ({ row }) => {
      const path = row.getValue('path') as string
      return (
        <div className="max-w-[200px] truncate" title={path}>
          {path}
        </div>
      )
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: 'instance_name',
    header: ({ column }) => (
      <div className="text-center">
        <DataTableColumnHeader column={column} title="ETCD Instance" />
      </div>
    ),
    cell: ({ row }) => {
      const instanceName = row.getValue('instance_name') as string
      const instanceHost = row.original.instance_host
      const instancePort = row.original.instance_port
      return (
        <div className="flex flex-col items-center text-center">
          <span className="font-medium">{instanceName || 'Default Instance'}</span>
          <span className="text-xs text-muted-foreground">
            {instanceHost}:{instancePort}
          </span>
        </div>
      )
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: 'mark-actions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Mark Actions" />
    ),
    cell: ({ row, table }) => {
      const domain = row.original
      const isMarked = domain.is_marked_as_domain
      
      const handleMarkToggle = async () => {
        try {
          const response = await api.domains.mark({
            path: domain.path,
            domain: domain.domain,
            space: domain.space,
            mark: !isMarked
          })
          
          if (response.ok) {
            // 使用React Query的refetch来更新数据，而不是强制刷新页面
            // 这样可以保持当前的显示模式状态
            // 从table的meta中获取refetch函数
            const tableMeta = table?.options?.meta as any
            if (tableMeta?.refetch) {
              await tableMeta.refetch()
            } else {
              // 如果没有refetch方法，使用window.location.reload作为后备
              window.location.reload()
            }
          } else {
            const error = await response.json()
            console.error('Failed to toggle mark:', error)
            alert(`Operation failed: ${error.error || 'Unknown error'}`)
          }
        } catch (error) {
          console.error('Error toggling mark:', error)
          alert('Operation failed: Network error')
        }
      }
      
      return (
        <Button
          variant={isMarked ? "outline" : "default"}
          size="sm"
          onClick={handleMarkToggle}
          className="h-8"
        >
          {isMarked ? (
            <>
              <BookmarkMinus className="mr-2 h-4 w-4" />
              Unmark
            </>
          ) : (
            <>
              <Bookmark className="mr-2 h-4 w-4" />
              Mark
            </>
          )}
        </Button>
      )
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    id: 'actions',
    cell: ({ row }) => <DomainsRowActions row={row} />,
  },
]
