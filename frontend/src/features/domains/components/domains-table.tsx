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
import { DataTablePagination, DataTableViewOptions } from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Cross2Icon } from '@radix-ui/react-icons'
import { type Domain, domainSchema } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { columns } from './domains-columns'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

async function fetchDomains(domain?: string, showVirtual?: boolean): Promise<Domain[]> {
  const response = await api.domains.getAll(domain, undefined, showVirtual)
  if (!response.ok) {
    throw new Error('Failed to fetch domains')
  }
  const data = await response.json()
  return domainSchema.array().parse(data)
}

type DataTableProps = {
  search: {
    domain?: string
    showVirtual?: boolean
    [key: string]: unknown
  }
  navigate: (update: any) => void
}

export function DomainsTable({ search, navigate }: DataTableProps) {
  const { domain, showVirtual = false } = search
  
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['domains', domain, showVirtual],
    queryFn: () => fetchDomains(domain, showVirtual),
    enabled: true, // 确保查询始终启用
    staleTime: 0,  // 立即认为数据过期，确保重新获取
    refetchOnWindowFocus: true, // 窗口聚焦时重新获取
    refetchOnMount: true, // 组件挂载时重新获取
  })

  const toggleDisplayMode = () => {
    console.log('Toggle display mode, current mode:', showVirtual ? 'Mark Mode' : 'Default Mode')
    const newShowVirtual = !showVirtual
    console.log('New mode:', newShowVirtual ? 'Mark Mode' : 'Default Mode')
    
    // 使用 Tanstack Router 的导航功能
    const newSearch = {
      ...search,
      showVirtual: newShowVirtual
    }
    
    console.log('新搜索参数:', newSearch)
    
    // 使用 navigate 函数更新URL参数
    navigate({
      search: newSearch
    })
  }

  // 提供刷新数据的方法，保持当前显示模式
  const refreshData = async () => {
    console.log('Refresh data, keep current display mode:', showVirtual ? 'Mark Mode' : 'Default Mode')
    await refetch()
  }

  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

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
      { columnId: 'domain', searchKey: 'domain', type: 'string' },
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
    meta: {
      refetch: refreshData
    }
  })

  useEffect(() => {
    ensurePageInRange(data.length)
  }, [pagination.pageIndex, pagination.pageSize, data.length, ensurePageInRange])

  useEffect(() => {
    console.log('DomainsTable search参数变化:', search)
    console.log('showVirtual值:', showVirtual)
    console.log('React Query查询键:', ['domains', domain, showVirtual])
  }, [search, showVirtual, domain])

  // 添加调试效果，监控参数变化
  useEffect(() => {
    console.log('组件挂载或参数变化，当前参数:', { domain, showVirtual })
  }, [])

  return (
    <div className={cn('space-y-4')}>
      <div className="flex items-center justify-between">
        <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
          <Input
            placeholder='Filter domains...'
            value={(table.getColumn('domain')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('domain')?.setFilterValue(event.target.value)
            }
            className='h-8 w-[150px] lg:w-[250px]'
          />
          <div className='flex gap-x-2'>
            {/* 这里可以添加其他过滤器 */}
          </div>
          {table.getState().columnFilters.length > 0 && (
            <Button
              variant='ghost'
              onClick={() => {
                table.resetColumnFilters()
              }}
              className='h-8 px-2 lg:px-3'
            >
              Reset
              <Cross2Icon className='ms-2 h-4 w-4' />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showVirtual ? "default" : "outline"}
            size="sm"
            onClick={toggleDisplayMode}
          >
            {showVirtual ? (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Mark Mode
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Default Mode
              </>
            )}
          </Button>
          <DataTableViewOptions table={table} />
        </div>
      </div>
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