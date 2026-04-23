import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type DnsRecord } from '../data/schema'

type DnsRecordsDialogType = 'add' | 'edit' | 'delete'

type DnsRecordsContextType = {
  open: DnsRecordsDialogType | null
  setOpen: (str: DnsRecordsDialogType | null) => void
  currentRow: DnsRecord | null
  setCurrentRow: React.Dispatch<React.SetStateAction<DnsRecord | null>>
  domain?: string
  instanceId?: number
}

const DnsRecordsContext = React.createContext<DnsRecordsContextType | null>(null)

export function DnsRecordsProvider({
  children,
  domain,
  instanceId,
}: {
  children: React.ReactNode
  domain?: string
  instanceId?: number
}) {
  const [open, setOpen] = useDialogState<DnsRecordsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<DnsRecord | null>(null)

  return (
    <DnsRecordsContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow, domain, instanceId }}
    >
      {children}
    </DnsRecordsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDnsRecords = () => {
  const dnsRecordsContext = React.useContext(DnsRecordsContext)

  if (!dnsRecordsContext) {
    throw new Error('useDnsRecords has to be used within <DnsRecordsContext>')
  }

  return dnsRecordsContext
}
