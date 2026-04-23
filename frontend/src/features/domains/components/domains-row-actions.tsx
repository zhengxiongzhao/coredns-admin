import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Row } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDomains } from './domains-provider'
import { type Domain } from '../data/schema'
import { api, handleApiError } from '@/lib/api'

interface DomainsRowActionsProps {
  row: Row<Domain>
}

export function DomainsRowActions({ row }: DomainsRowActionsProps) {
  const queryClient = useQueryClient()
  const { setOpen, setCurrentRow } = useDomains()
  const domain = row.original

  const { isPending } = useMutation({
    mutationFn: async () => {
      const response = await api.domains.delete(domain.path)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete domain')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Domain deleted successfully.')
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
    onError: (error) => {
      toast.error(handleApiError(error))
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onClick={() => {
          setCurrentRow(domain)
          setOpen('edit')
        }}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(domain)
            setOpen('delete')
          }}
          disabled={isPending}
          className="text-red-500"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}