import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table'
import { type DnsRecord, dnsRecordSchema } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { dnsRecordsColumns as columns } from './dns-records-columns'
import { DnsRecordsToolbar } from './dns-records-toolbar'
import { api } from '@/lib/api'

// localStorage key for column visibility preferences
const COLUMN_VISIBILITY_STORAGE_KEY = 'dns-records-column-visibility'

// 不持久化的列配置 - Domain列需要根据当前上下文动态决定显示状态
const NON_PERSISTENT_COLUMNS = ['domain']

async function fetchDnsRecords(domain?: string, basePath?: string, instanceId?: number): Promise<DnsRecord[]> {
  const response = await api.dnsRecords.getAll(domain, basePath, instanceId)
  if (!response.ok) {
    throw new Error('Failed to fetch DNS records')
  }
  const data = await response.json()
  
  // 调试：检查冲突数据
  const conflictRecords = data.filter((record: any) => record.has_conflict === true)
  if (conflictRecords.length > 0) {
    console.log(`[DNS Records Debug] Found ${conflictRecords.length} conflict records:`,
      conflictRecords.map((r: any) => ({ key: r.key, name: r.name, has_conflict: r.has_conflict }))
    )
  }
  
  return dnsRecordSchema.array().parse(data)
}

type DataTableProps = {
  search: {
    domain?: string
    [key: string]: unknown
  }
  navigate: any
}

export function DnsRecordsTable({ search, navigate }: DataTableProps) {
  const { domain, instance_id } = search
  const instanceId = instance_id as number | undefined
  const { data = [], isLoading } = useQuery({
    queryKey: ['dns-records', domain, instanceId],
    queryFn: () => fetchDnsRecords(domain, undefined, instanceId),
  })

  const [rowSelection, setRowSelection] = useState({})
  
  // 默认列可见性配置
  const getDefaultColumnVisibility = (): VisibilityState => {
    // 默认配置：当指定了domain参数时，Domain列默认隐藏；否则显示
    // 这样可以避免从域名管理页面跳转时Domain列不显示的问题
    return domain ? { domain: false } : { domain: true }
  }
  
  // 当domain参数变化时，重置列可见性到默认状态
  useEffect(() => {
    // 延迟执行，避免与初始化冲突
    const timer = setTimeout(() => {
      setColumnVisibility(getDefaultColumnVisibility())
    }, 0)
    return () => clearTimeout(timer)
  }, [domain])
  
  // 加载保存的列可见性偏好（排除不持久化的列）
  const loadColumnVisibility = (): VisibilityState => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 过滤掉不持久化的列
        const filtered = Object.keys(parsed).reduce((acc, key) => {
          if (!NON_PERSISTENT_COLUMNS.includes(key)) {
            acc[key] = parsed[key]
          }
          return acc
        }, {} as VisibilityState)
        // 始终使用当前的默认配置作为基础，确保domain列状态正确
        return { ...getDefaultColumnVisibility(), ...filtered }
      }
    } catch (error) {
      console.warn('Failed to load column visibility preferences:', error)
    }
    return getDefaultColumnVisibility()
  }

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  
  // 在组件挂载时初始化列可见性
  useEffect(() => {
    setColumnVisibility(loadColumnVisibility())
  }, [])

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'name', searchKey: 'name', type: 'string' },
      { columnId: 'type', searchKey: 'type', type: 'string' },
      { columnId: 'content', searchKey: 'content', type: 'string' },
    ],
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // 保存列可见性偏好到localStorage（排除不持久化的列）
  useEffect(() => {
    try {
      const persistableVisibility = Object.keys(columnVisibility).reduce((acc, key) => {
        if (!NON_PERSISTENT_COLUMNS.includes(key)) {
          acc[key] = columnVisibility[key]
        }
        return acc
      }, {} as VisibilityState)
      localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(persistableVisibility))
    } catch (error) {
      console.warn('Failed to save column visibility preferences:', error)
    }
  }, [columnVisibility])

  useEffect(() => {
    ensurePageInRange(data.length)
  }, [pagination.pageIndex, pagination.pageSize, data.length, ensurePageInRange])

  // 重置列显示到默认状态
  const handleResetColumns = () => {
    setColumnVisibility(getDefaultColumnVisibility())
  }

  return (
    <div className={cn('space-y-4')}>
      <DnsRecordsToolbar table={table} onResetColumns={handleResetColumns} />
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
      <DataTableBulkActions table={table} />
    </div>
  )
}
