import { DomainsActionDialog } from './domains-action-dialog'
import { DomainsDeleteDialog } from './domains-delete-dialog'
import { useDomains } from './domains-provider'

export function DomainsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useDomains()

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOpen(null)
      setCurrentRow(null)
    }
  }

  return (
    <>
      <DomainsActionDialog
        key='domain-add'
        open={open === 'add'}
        onOpenChange={handleOpenChange}
      />

      {currentRow && (
        <>
          <DomainsActionDialog
            key={`domain-edit-${currentRow.path}`}
            open={open === 'edit'}
            onOpenChange={handleOpenChange}
            currentRow={currentRow}
          />

          <DomainsDeleteDialog
            key={`domain-delete-${currentRow.path}`}
            open={open === 'delete'}
            onOpenChange={handleOpenChange}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
