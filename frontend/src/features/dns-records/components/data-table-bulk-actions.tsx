import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type DnsRecord } from '../data/schema'
import { api } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedRecords = selectedRows.map(
    (row) => row.original as DnsRecord
  )
  
  const handleBulkDelete = async () => {
    // 先关闭模态框
    setShowDeleteConfirm(false)
    
    toast.promise(
      Promise.all(
        selectedRecords.map((record) =>
          api.dnsRecords.delete([record.key])
        )
      )
      ,
      {
        loading: 'Deleting records...',
        success: () => {
          table.resetRowSelection()
          queryClient.invalidateQueries({ queryKey: ['dns-records'] })
          return `Deleted ${selectedRecords.length} record(s)`
        },
        error: 'Error deleting records',
      }
    )
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='record'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected records'
              title='Delete selected records'
              disabled={selectedRows.length === 0}
            >
              <Trash2 />
              <span className='sr-only'>Delete selected records</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected records</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
        }}
        handleConfirm={handleBulkDelete}
        title={
          <span className='text-destructive'>
            <Trash2 className='stroke-destructive me-1 inline-block' size={18} />{' '}
            Delete DNS Records
          </span>
        }
        desc={
          <div className='space-y-4'>
            <p className='mb-2'>
              Are you sure you want to delete{' '}
              <span className='font-bold'>{selectedRows.length}</span> DNS record(s)?
              <br />
              This action will permanently remove the DNS records. This cannot be
              undone.
            </p>
            
            <div className='space-y-2'>
              <p className='text-sm'>
                Selected records:
              </p>
              <ul className='max-h-40 overflow-y-auto border rounded p-2 text-sm'>
                {selectedRecords.map((record, index) => (
                  <li key={index} className='truncate'>
                    {record.name} ({record.type}): {record.content}
                  </li>
                ))}
              </ul>
            </div>

            <Alert variant='destructive'>
              <AlertTitle>Warning!</AlertTitle>
              <AlertDescription>
                Please be careful, this operation can not be rolled back.
              </AlertDescription>
            </Alert>
          </div>
        }
        confirmText='Delete'
        destructive
      />
    </>
  )
}
