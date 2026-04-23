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
import { type Domain } from '../data/schema'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedDomains = selectedRows.map(
    (row) => row.original as Domain
  )
  
  const handleBulkDelete = async () => {
    // 检查确认文本
    const expectedText = `DELETE ${selectedDomains.length} DOMAINS`
    if (confirmText !== expectedText) {
      toast.error('Please enter the correct confirmation text')
      return
    }
    
    toast.promise(
      Promise.all(
        selectedDomains.map((domain) =>
          api.domains.delete(domain.path)
        )
      )
      ,
      {
        loading: 'Deleting domains...',
        success: () => {
          table.resetRowSelection()
          queryClient.invalidateQueries({ queryKey: ['domains'] })
          setConfirmText('')
          return `Deleted ${selectedDomains.length} domain(s)`
        },
        error: 'Error deleting domains',
      }
    )
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='domain'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected domains'
              title='Delete selected domains'
              disabled={selectedRows.length === 0}
            >
              <Trash2 />
              <span className='sr-only'>Delete selected domains</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected domains</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
          if (!open) {
            setConfirmText('')
          }
        }}
        handleConfirm={handleBulkDelete}
        title={
          <span className='text-destructive'>
            <Trash2 className='stroke-destructive me-1 inline-block' size={18} />{' '}
            Delete Domains
          </span>
        }
        desc={
          <div className='space-y-4'>
            <p className='mb-2'>
              Are you sure you want to delete{' '}
              <span className='font-bold'>{selectedRows.length}</span> domain(s)?
              <br />
              This action will permanently remove the domains and all their DNS records. This cannot be
              undone.
            </p>
            
            <div className='space-y-2'>
              <p className='text-sm'>
                Selected domains:
              </p>
              <ul className='max-h-40 overflow-y-auto border rounded p-2 text-sm'>
                {selectedDomains.map((domain, index) => (
                  <li key={index} className='truncate'>
                    {domain.domain} ({domain.space})
                  </li>
                ))}
              </ul>
            </div>
            
            <Label className='my-2'>
              To confirm, type "DELETE {selectedDomains.length} DOMAINS":
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Enter confirmation text'
              />
            </Label>

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
        disabled={confirmText !== `DELETE ${selectedDomains.length} DOMAINS`}
      />
    </>
  )
}
