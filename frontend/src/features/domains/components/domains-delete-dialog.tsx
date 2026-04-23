'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Domain } from '../data/schema'
import { api } from '@/lib/api'

type DomainDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Domain
}

export function DomainsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: DomainDeleteDialogProps) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')

  const handleDelete = async () => {
    if (value.trim() !== currentRow.path) return

    try {
      const response = await api.domains.delete(currentRow.path)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete domain')
      }

      toast.success(`Domain "${currentRow.domain}" has been deleted.`)
      await queryClient.invalidateQueries({ queryKey: ['domains'] })
      onOpenChange(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      toast.error(errorMessage)
      console.error('Delete error:', error)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== currentRow.path}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='stroke-destructive me-1 inline-block'
            size={18}
          />{' '}
          Delete Domain
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Are you sure you want to delete{' '}
            <span className='font-bold'>{currentRow.domain}</span>?
            <br />
            This action will permanently remove the domain. This cannot be
            undone.
          </p>

          <Label className='my-2'>
            Path:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Enter path to confirm deletion.'
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
    />
  )
}
