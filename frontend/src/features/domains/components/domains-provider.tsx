import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Domain } from '../data/schema'

type DomainsDialogType = 'add' | 'edit' | 'delete'

type DomainsContextType = {
  open: DomainsDialogType | null
  setOpen: (str: DomainsDialogType | null) => void
  currentRow: Domain | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Domain | null>>
}

const DomainsContext = React.createContext<DomainsContextType | null>(null)

export function DomainsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<DomainsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Domain | null>(null)

  return (
    <DomainsContext.Provider value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </DomainsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDomains = () => {
  const domainsContext = React.useContext(DomainsContext)

  if (!domainsContext) {
    throw new Error('useDomains has to be used within <DomainsContext>')
  }

  return domainsContext
}
