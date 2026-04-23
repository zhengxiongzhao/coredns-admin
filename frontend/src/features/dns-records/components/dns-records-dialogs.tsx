import { DnsRecordsActionDialog } from './dns-records-action-dialog'
import { DnsRecordsDeleteDialog } from './dns-records-delete-dialog'
import { useDnsRecords } from './dns-records-provider'

export function DnsRecordsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useDnsRecords()

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOpen(null)
      setCurrentRow(null)
    }
  }

  return (
    <>
      <DnsRecordsActionDialog
        key='dns-record-add'
        open={open === 'add'}
        onOpenChange={handleOpenChange}
      />

      {currentRow && (
        <>
          <DnsRecordsActionDialog
            key={`dns-record-edit-${currentRow.key}`}
            open={open === 'edit'}
            onOpenChange={handleOpenChange}
            currentRow={currentRow}
          />

          <DnsRecordsDeleteDialog
            key={`dns-record-delete-${currentRow.key}`}
            open={open === 'delete'}
            onOpenChange={handleOpenChange}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
