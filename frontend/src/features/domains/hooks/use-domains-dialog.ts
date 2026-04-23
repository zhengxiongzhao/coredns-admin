import { create } from 'zustand'
import { type Domain } from '../data/schema'

type DialogType = 'add' | 'edit' | 'delete' | 'delete-many'

interface UseDomainsDialog {
  type: DialogType | null
  data: Domain | null
  isOpen: boolean
  onOpen: (type: DialogType, data?: Domain) => void
  onClose: () => void
}

export const useDomainsDialog = create<UseDomainsDialog>((set) => ({
  type: null,
  data: null,
  isOpen: false,
  onOpen: (type, data) => set({ isOpen: true, type, data }),
  onClose: () => set({ type: null, isOpen: false, data: null }),
}))