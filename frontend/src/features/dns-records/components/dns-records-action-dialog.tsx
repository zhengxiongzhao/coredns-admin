'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { type DnsRecord } from '../data/schema'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDnsRecords } from './dns-records-provider'
import { api, handleApiError } from '@/lib/api'

const formSchema = z.object({
  name: z.string()
    .min(1, 'Name is required.')
    .max(253, 'Name too long (max 253 characters).')
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, 'Invalid name format. Support multi-level subdomains like "sub.sub".')
    .refine((value) => {
      if (value === '@') return true
      // 检查每个标签长度
      const labels = value.split('.')
      return labels.every(label => label.length <= 63 && label.length > 0)
    }, {
      message: 'Each label must be 1-63 characters long'
    }),
  type: z.enum(['A', 'CNAME', 'TXT', 'MX', 'SRV', 'AAAA', 'NS', 'PTR', 'SOA']),
  content: z.string(),
  ttl: z.number()
    .min(1, 'TTL must be a positive integer.')
    .max(2147483647, 'TTL too large (max 2147483647).'),
  priority: z.number()
    .min(0, 'Priority must be a non-negative integer.')
    .max(65535, 'Priority too large (max 65535).'),
  // 多条记录相关字段 - 简化为文本区域
  allowMultipleRecords: z.boolean(),
  multipleRecordContents: z.string(),
}).refine((data) => {
  // 多条记录模式下的验证
  if (data.allowMultipleRecords) {
    if (!data.multipleRecordContents.trim()) {
      return false;
    }
    // 验证多条记录内容
    const lines = data.multipleRecordContents.split('\n')
    const validContents = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    
    if (validContents.length === 0) {
      return false;
    }
  } else {
    // 单条记录模式下的验证
    if (!data.content.trim()) {
      return false;
    }
  }
  return true;
}, {
  message: "Content is required",
  path: ["multipleRecordContents"]
}).refine((data) => {
  // 只有在单条记录模式下才验证content格式
  if (data.allowMultipleRecords) {
    return true; // 多条记录模式已在前面验证过内容存在性
  }
  
  if (data.type === 'A') {
    // 更严格的IPv4验证
    const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipPattern.test(data.content)
  }
  if (data.type === 'AAAA') {
    // 更严格的IPv6验证
    try {
      new URL(`http://[${data.content}]`);
      return true;
    } catch {
      return false;
    }
  }
  if (data.type === 'CNAME' || data.type === 'NS' || data.type === 'PTR') {
    // RFC 1035域名格式验证
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/
    if (!domainPattern.test(data.content)) {
      return false;
    }
    // 检查总长度和每个标签长度
    if (data.content.length > 253) return false;
    return data.content.split('.').every(label => label.length <= 63);
  }
  if (data.type === 'MX') {
    // MX记录格式: priority domain
    const mxPattern = /^\d+\s+[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/
    if (!mxPattern.test(data.content)) {
      return false;
    }
    // 验证域名部分
    const parts = data.content.split(' ');
    if (parts.length < 2) return false;
    const domain = parts.slice(1).join(' ');
    if (domain.length > 253) return false;
    return domain.split('.').every(label => label.length <= 63);
  }
  if (data.type === 'SRV') {
    // SRV记录格式: priority weight port target
    const srvPattern = /^\d+\s+\d+\s+\d+\s+[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/
    if (!srvPattern.test(data.content)) {
      return false;
    }
    // 验证域名部分
    const parts = data.content.split(' ');
    if (parts.length < 4) return false;
    const target = parts[3];
    if (target.length > 253) return false;
    return target.split('.').every(label => label.length <= 63);
  }
  if (data.type === 'SOA') {
    // SOA记录格式: ns responsible ttl refresh retry expire minttl
    const parts = data.content.split(' ');
    if (parts.length < 7) return false;
    
    // 验证域名部分
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/
    if (!domainPattern.test(parts[0]) || !domainPattern.test(parts[1])) {
      return false;
    }
    
    // 验证数值部分
    try {
      for (let i = 2; i < 7; i++) {
        const num = parseInt(parts[i], 10);
        if (isNaN(num) || num < 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  if (data.type === 'TXT') {
    // TXT记录长度限制
    return data.content.length <= 255;
  }
  return true;
}, {
  message: "Invalid content format for the selected record type",
  path: ["content"]
})

type DnsRecordForm = z.infer<typeof formSchema>

type DnsRecordActionDialogProps = {
  currentRow?: DnsRecord
 open: boolean
 onOpenChange: (open: boolean) => void
}

export function DnsRecordsActionDialog({
  currentRow,
  open,
  onOpenChange,
}: DnsRecordActionDialogProps) {
  const queryClient = useQueryClient()
  const { domain, instanceId } = useDnsRecords()
  const isEdit = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<DnsRecordForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          name: currentRow.name,
          type: currentRow.type as 'A' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'AAAA' | 'NS' | 'PTR' | 'SOA',
          content: currentRow.content,
          ttl: currentRow.ttl,
          priority: currentRow.priority || 100,
          allowMultipleRecords: false,
          multipleRecordContents: '',
        }
      : {
          name: '',
          type: 'A',
          content: '',
          ttl: 60,
          priority: 100,
          allowMultipleRecords: false,
          multipleRecordContents: '',
        },
  })

  // 监听多条记录开关变化
  const allowMultipleRecords = form.watch('allowMultipleRecords')
  const recordName = form.watch('name')
  
  // 自动识别多级子域名
  const isMultiLevelSubdomain = recordName && recordName.includes('.') && recordName !== '@'

  // 计算完整FQDN预览
  const getFullFQDN = () => {
    const name = form.getValues('name')
    if (!name || !domain) return ''
    if (name === '@') return domain
    return `${name}.${domain}`
  }

  useEffect(() => {
    if (allowMultipleRecords && !isEdit) {
      // 当开启多条记录时，如果内容为空，提供示例
      const contents = form.getValues('multipleRecordContents')
      if (!contents.trim()) {
        // 不再设置默认值，让placeholder显示示例
        form.setValue('multipleRecordContents', '')
      }
    }
  }, [allowMultipleRecords, form, isEdit])

  const onSubmit = async (values: DnsRecordForm) => {
    setIsSubmitting(true)
    try {
      if (isEdit && currentRow) {
        // 编辑模式：更新现有记录
        const payload = { ...values, key: currentRow.key }
        const response = await api.dnsRecords.update(payload)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update DNS record')
        }
        
        toast.success(`DNS record "${values.name}" has been updated.`)
      } else {
        // 创建模式：处理多条记录
        if (values.allowMultipleRecords && values.multipleRecordContents.trim()) {
          // 解析文本区域内容，按行分割
          const lines = values.multipleRecordContents.split('\n')
          const validContents = lines
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')) // 过滤空行和注释行
          
          if (validContents.length === 0) {
            throw new Error('没有有效的记录内容，请检查输入')
          }
          
          // 构建批量创建数据
          const batchPayload = validContents.map(content => ({
            domain,
            name: values.name,
            type: values.type,
            content: content,
            ttl: values.ttl,
            priority: values.priority,
            instance_id: instanceId,
          }))
          
          const response = await api.dnsRecords.createBatch(batchPayload)
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create multiple DNS records')
          }
          
          const result = await response.json()
          
          if (result.created && result.created.length > 0) {
            toast.success(`Successfully created ${result.created.length} DNS records for "${values.name}.${domain}"`)
          }
          
          if (result.failed && result.failed.length > 0) {
            const failedCount = result.failed.length
            toast.error(`Failed to create ${failedCount} records. Check the details in the console.`)
            console.error('Failed records:', result.failed)
          }
        } else if (!values.allowMultipleRecords) {
          // 单条记录创建
          const payload = { ...values, domain, instance_id: instanceId }
          const response = await api.dnsRecords.create(payload)

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to save DNS record')
          }

          toast.success(`DNS record for "${values.name}.${domain}" has been saved.`)
        } else {
          // 多条记录模式但没有输入内容 - 这种情况应该由表单验证拦截
          throw new Error('请输入多条记录内容')
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['dns-records', domain] })
      onOpenChange(false)
      form.reset()
    } catch (error) {
      toast.error(handleApiError(error))
      console.error('Submit error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit DNS Record' : 'Add New DNS Record'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the DNS record here. ' : 'Create new DNS record here. '}
            Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className='py-1'>
          <Form {...form}>
            <form
              id='dns-record-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Name</FormLabel>
                    <FormControl>
                      <div className="col-span-4 space-y-2">
                        <Input
                          placeholder='e.g., www, api.v1.mobile, or @ for root'
                          className='w-full'
                          autoComplete='off'
                          {...field}
                          disabled={isEdit}
                        />
                        {field.value && field.value !== '@' && (
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            Full FQDN: <span className="font-mono">{getFullFQDN()}</span>
                          </div>
                        )}
                        {isMultiLevelSubdomain && (
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            多级子域名已识别
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className='col-span-4'>
                          <SelectValue placeholder="Select a record type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="CNAME">CNAME</SelectItem>
                        <SelectItem value="TXT">TXT</SelectItem>
                        <SelectItem value="MX">MX</SelectItem>
                        <SelectItem value="SRV">SRV</SelectItem>
                        <SelectItem value="AAAA">AAAA</SelectItem>
                        <SelectItem value="NS">NS</SelectItem>
                        <SelectItem value="PTR">PTR</SelectItem>
                        <SelectItem value="SOA">SOA</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              {/* Content内容区域 - 根据模式动态显示 */}
              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end pt-2'>Content</FormLabel>
                    <FormControl>
                      <div className="col-span-4 space-y-3">
                        {/* 多条记录切换 - 仅在创建模式下显示 */}
                        {!isEdit && (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={allowMultipleRecords}
                              onCheckedChange={(checked) => {
                                form.setValue('allowMultipleRecords', checked)
                                if (checked) {
                                  // 切换到多条记录模式时，清空内容让placeholder显示示例
                                  form.setValue('multipleRecordContents', '')
                                } else {
                                  // 切换到单条记录模式时，清空多条记录内容
                                  form.setValue('multipleRecordContents', '')
                                }
                              }}
                            />
                            <span className="text-sm text-muted-foreground">
                              {allowMultipleRecords ? '多条记录模式' : '单条记录模式'}
                            </span>
                          </div>
                        )}

                        {/* 单条记录输入框 */}
                        {!allowMultipleRecords && (
                          <Input
                            placeholder='e.g., 192.168.1.1 or another.domain.com'
                            autoComplete='off'
                            {...field}
                          />
                        )}

                        {/* 多条记录文本区域 */}
                        {allowMultipleRecords && (
                          <>
                            <Textarea
                              placeholder={'# 每行输入一个记录内容\n# 示例：\n192.168.1.1\n192.168.1.2\n192.168.1.3'}
                              className="min-h-[120px] font-mono text-sm"
                              value={form.watch('multipleRecordContents')}
                              onChange={(e) => form.setValue('multipleRecordContents', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              每行输入一个记录内容，以#开头的行为注释，空行将被忽略
                            </p>
                          </>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3'>
                      {form.formState.errors.multipleRecordContents && (
                        <span>{form.formState.errors.multipleRecordContents.message}</span>
                      )}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='ttl'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>TTL</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='e.g., 60'
                        className='col-span-4'
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Priority</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='e.g., 100'
                        className='col-span-4'
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='dns-record-form' disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}