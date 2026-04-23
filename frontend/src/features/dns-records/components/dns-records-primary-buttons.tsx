import { PlusCircle, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDnsRecords } from './dns-records-provider'
import { useNavigate } from '@tanstack/react-router'

export function DnsRecordsPrimaryButtons() {
  const { domain, setOpen } = useDnsRecords()
  const navigate = useNavigate()
  
  // 如果没有指定域名，显示选择域名的按钮
  if (!domain) {
    return (
      <div className='flex gap-2'>
        <Button
          className='space-x-2'
          onClick={() => navigate({ to: '/domains' })}
          variant="outline"
        >
          <Globe className="h-4 w-4" />
          <span>Select Domain</span>
        </Button>
      </div>
    )
  }
  
  // 如果有域名，显示正常的添加记录按钮
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add Record</span> <PlusCircle size={18} />
      </Button>
    </div>
  )
}
