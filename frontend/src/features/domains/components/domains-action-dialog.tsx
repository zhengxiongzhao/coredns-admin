'use client'
import { z } from 'zod'
import { useEffect } from 'react'
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
import { type Domain } from '../data/schema'
import { api, handleApiError } from '@/lib/api'
import { useEtcdInstances } from '@/features/dashboard/hooks/use-etcd-instances'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter } from '@tanstack/react-router'


const formSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required.')
    .max(253, 'Domain name too long (max 253 characters).')
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, 'Invalid domain format (RFC 1035).')
    .refine((domain) => {
      // 检查每个标签长度不能超过63个字符
      return domain.split('.').every(label => label.length <= 63);
    }, 'Domain label too long (max 63 characters per label).'),
  space: z.string()
    .min(1, 'Space is required.')
    .regex(/^\/.+/, 'Space must start with "/".'),
  instance_id: z.number().min(1, 'ETCD Instance is required.'),
})

type DomainForm = z.infer<typeof formSchema>

type DomainActionDialogProps = {
  currentRow?: Domain
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DomainsActionDialog({
  currentRow,
  open,
  onOpenChange,
}: DomainActionDialogProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const isEdit = !!currentRow
  const { instances, loading: instancesLoading } = useEtcdInstances(false)

  const form = useForm<DomainForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          domain: currentRow.domain,
          space: currentRow.space,
          instance_id: currentRow.instance_id,
        }
      : {
          domain: '',
          space: '/skydns',
          instance_id: 0,
        },
  })

  // Auto-select default ETCD instance when adding new domain
  useEffect(() => {
    if (!isEdit && !instancesLoading && instances.length > 0 && form.getValues('instance_id') === 0) {
      const defaultInstance = instances.find((inst) => inst.is_default)
      if (defaultInstance) {
        form.setValue('instance_id', defaultInstance.id)
      } else {
        form.setValue('instance_id', instances[0].id)
      }
    }
  }, [isEdit, instances, instancesLoading, form])

  const onSubmit = async (values: DomainForm) => {
    try {
      let response
      if (isEdit) {
        response = await api.domains.update({ ...values, new_space: values.space })
      } else {
        // 创建新域名
        const payload = {
          domain: values.domain,
          base_path: values.space,
          instance_id: values.instance_id,
        }
        response = await api.domains.create(payload)
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save domain');
      }

      toast.success(`Domain "${values.domain}" has been ${isEdit ? 'updated' : 'created'}.`);
      await queryClient.invalidateQueries({ queryKey: ['domains'] });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(handleApiError(error));
      console.error('Submit error:', error);
    }
  };


  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset();
        onOpenChange(state);
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit Domain' : 'Add New Domain'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the domain here. ' : 'Create new domain here. '}
            Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className='py-1'>
          <Form {...form}>
            <form
              id='domain-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >

              <FormField
                control={form.control}
                name='instance_id'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>ETCD Instance</FormLabel>
                    <div className='col-span-4'>
                      {instances.length === 0 && !instancesLoading ? (
                        <div className='flex items-center gap-2'>
                          <span className='text-sm text-muted-foreground'>No instances available</span>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              onOpenChange(false)
                              router.navigate({ to: '/' })
                            }}
                          >
                            Add Instance
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={field.value ? String(field.value) : ''}
                          onValueChange={(val) => field.onChange(Number(val))}
                          disabled={isEdit || instancesLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={instancesLoading ? 'Loading...' : 'Select instance'} />
                          </SelectTrigger>
                          <SelectContent>
                            {instances.map((inst) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name} ({inst.host}:{inst.port})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='domain'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Domain</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., example.com'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                        disabled={isEdit} // 编辑模式下禁用域名输入
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='space'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Space</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., /skydns'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                        disabled={isEdit} // 编辑模式下禁用space输入
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {isEdit && (
                <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                  <FormLabel className='col-span-2 text-end'>Path</FormLabel>
                  <FormControl>
                    <Input
                      value={currentRow?.path || ''}
                      className='col-span-4'
                      readOnly
                    />
                  </FormControl>
                </FormItem>
              )}
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='domain-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
