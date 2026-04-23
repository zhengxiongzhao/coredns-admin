import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { Button } from './ui/button'
import { useLocation } from '@tanstack/react-router'

type SearchProps = {
  className?: string
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
}

export function Search({
  className = '',
  placeholder = 'Search',
}: SearchProps) {
  const { setOpen } = useSearch()
  const location = useLocation()
  
  // 处理搜索按钮点击
  const handleSearchClick = () => {
    // 如果在DNS记录页面，尝试聚焦到名称过滤输入框
    if (location.pathname.includes('/dns-records')) {
      // 查找名称过滤输入框并聚焦
      const nameInput = document.querySelector('input[placeholder="搜索记录名称..."]') as HTMLInputElement
      if (nameInput) {
        nameInput.focus()
        return
      }
    }
    
    // 默认行为：打开命令菜单
    setOpen(true)
  }
  
  return (
    <Button
      variant='outline'
      className={cn(
        'bg-muted/25 group text-muted-foreground hover:bg-accent relative h-8 w-full flex-1 justify-start rounded-md text-sm font-normal shadow-none sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64',
        className
      )}
      onClick={handleSearchClick}
    >
      <SearchIcon
        aria-hidden='true'
        className='absolute start-1.5 top-1/2 -translate-y-1/2'
        size={16}
      />
      <span className='ms-4'>{placeholder}</span>
      <kbd className='bg-muted group-hover:bg-accent pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
        <span className='text-xs'>⌘</span>K
      </kbd>
    </Button>
  )
}
