import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDomains } from './domains-provider'

export function DomainsPrimaryButtons() {
  const { setOpen } = useDomains()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add Domain</span> <PlusCircle size={18} />
      </Button>
    </div>
  )
}
