import { Table } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DataTableViewOptions } from '@/components/data-table'
import { X, RotateCcw } from 'lucide-react'
import { type DnsRecord } from '../data/schema'

interface DnsRecordsToolbarProps {
  table: Table<DnsRecord>
  onResetColumns: () => void
}

export function DnsRecordsToolbar({ table, onResetColumns }: DnsRecordsToolbarProps) {
  // 检查是否有过滤器处于活动状态
  const isFiltered = table.getState().columnFilters.length > 0
  
  // 获取名称过滤器值
  const nameFilter = table.getColumn('name')?.getFilterValue() as string
  
  // 多级记录过滤器状态现在由 MultiLevelFilter 组件内部管理
  // 不再需要通过 table.getColumn 获取
  
  // 重置所有过滤器
  const handleResetFilters = () => {
    table.resetColumnFilters()
  }
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {/* 名称搜索 */}
        <Input
          placeholder="Search record name..."
          value={nameFilter ?? ''}
          onChange={(event) => {
            table.getColumn('name')?.setFilterValue(event.target.value)
          }}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        
        {/* 类型过滤器 */}
        {table.getColumn('type') && (
          <Input
            placeholder="Search type..."
            value={(table.getColumn('type')?.getFilterValue() as string) ?? ''}
            onChange={(event) => {
              table.getColumn('type')?.setFilterValue(event.target.value)
            }}
            className="h-8 w-[120px]"
          />
        )}
        
        {/* 内容过滤器 */}
        {table.getColumn('content') && (
          <Input
            placeholder="Search content..."
            value={(table.getColumn('content')?.getFilterValue() as string) ?? ''}
            onChange={(event) => {
              table.getColumn('content')?.setFilterValue(event.target.value)
            }}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        
        {/* 重置过滤器按钮 */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleResetFilters}
            className="h-8 px-2 lg:px-3"
          >
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* 重置列显示 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetColumns}
          className="h-8"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Columns
        </Button>
        
        {/* 列显示选项 */}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}