'use client'

import { AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type DnsRecord } from '../data/schema'
import { api, handleApiError } from '@/lib/api'

type DnsRecordDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: DnsRecord
}

export function DnsRecordsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: DnsRecordDeleteDialogProps) {
  const queryClient = useQueryClient()

  const handleDelete = async () => {
    try {
      const response = await api.dnsRecords.delete([currentRow.key])

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete DNS record')
      }

      toast.success(`DNS record "${currentRow.name}" has been deleted.`)
      await queryClient.invalidateQueries({ queryKey: ['dns-records'] })
      onOpenChange(false)
    } catch (error) {
      toast.error(handleApiError(error))
      console.error('Delete error:', error)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='stroke-destructive me-1 inline-block'
            size={18}
          />{' '}
          Delete DNS Record
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Are you sure you want to delete{' '}
            <span className='font-bold'>{currentRow.name}</span>?
            <br />
            This action will permanently remove the DNS record. This cannot be
            undone.
          </p>

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
  )
}
