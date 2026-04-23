import { type ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type DnsRecord } from '../data/schema'
import { DnsRecordsRowActions } from './dns-records-row-actions'
import { AlertTriangle, GitBranch } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const dnsRecordsColumns: ColumnDef<DnsRecord>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'record-type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='' />
    ),
    cell: () => {
      return (
        <div className="flex items-center gap-2">
          {/* <span>{row.getValue('type')}</span> */}
        </div>
      )
    },
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      const record = row.original
      const hasConflict = Boolean(record.has_conflict) // 确保转换为布尔值
      const conflictMessage = record.conflict_message || ''
      const conflictDetails = record.conflict_details || ''
      const name = row.getValue('name') as string
      
      // 调试日志
      if (hasConflict) {
        console.log(`[DNS Column Debug] Conflict record detected:`, {
          name: name,
          hasConflict: hasConflict,
          conflictMessage: conflictMessage,
          key: record.key
        })
      }
      
      // 检测多级子域名（包含多个点号）
      const isMultiLevel = name && name.split('.').length > 2
      const levelCount = name ? name.split('.').length - 1 : 0
      
      return (
        <div className='w-fit max-w-xs truncate ps-2 font-medium flex items-center gap-2'>
          {row.getValue('name')}
          {isMultiLevel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <GitBranch className='h-4 w-4 text-green-600 cursor-help' />
                </TooltipTrigger>
                <TooltipContent>
                  <div className='space-y-1'>
                    <p className='font-medium text-green-600'>Multi-level Subdomain</p>
                    <p className='text-sm text-muted-foreground'>
                      {levelCount} level subdomain structure
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasConflict && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className='h-4 w-4 text-yellow-500 cursor-help' />
                </TooltipTrigger>
                <TooltipContent className='max-w-xs'>
                  <div className='space-y-1'>
                    <p className='font-medium text-yellow-600'>{conflictMessage}</p>
                    {conflictDetails && (
                      <p className='text-sm text-muted-foreground'>{conflictDetails}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <div className="text-center">
        <DataTableColumnHeader column={column} title='Type' />
      </div>
    ),
    cell: ({ row }) => <div className="text-center">{row.getValue('type')}</div>,
  },
  {
    accessorKey: 'content',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Content' />
    ),
    cell: ({ row }) => <div>{row.getValue('content')}</div>,
  },
  {
    accessorKey: 'ttl',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='TTL' />
    ),
    cell: ({ row }) => <div>{row.getValue('ttl')}</div>,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Priority' />
    ),
    cell: ({ row }) => <div>{row.getValue('priority') || 100}</div>,
  },
  {
    accessorKey: 'key',
    id: 'path',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Path' />
    ),
    cell: ({ row }) => {
      // 显示完整的etcd路径
      const key = row.original.key
      
      return (
        <div className="flex items-center gap-2">
          <div className="font-mono text-xs max-w-xs truncate" title={key}>{key}</div>
        </div>
      )
    },
  },
  {
    accessorKey: 'domain',
    id: 'domain',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Domain' />
    ),
    cell: ({ row }) => {
      // 使用后端返回的domain字段，实现基于Domain标记的统一显示
      const domain = row.original.domain
      return <div className="font-medium">{domain || '-'}</div>
    },
  },
  {
    accessorKey: 'instance_name',
    header: ({ column }) => (
      <div className="text-center">
        <DataTableColumnHeader column={column} title='ETCD Instance' />
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
    id: 'actions',
    cell: DnsRecordsRowActions,
  },
]
