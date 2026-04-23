import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { Separator } from '@/components/ui/separator'

// 账户信息表单Schema
const accountInfoSchema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your name.')
    .min(2, 'Name must be at least 2 characters.')
    .max(30, 'Name must not be longer than 30 characters.'),
})

// 修改密码表单Schema
const changePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(1, 'Please enter your current password.'),
  newPassword: z
    .string()
    .min(1, 'Please enter your new password.')
    .min(6, 'New password must be at least 6 characters long.'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your new password.'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type AccountInfoValues = z.infer<typeof accountInfoSchema>
type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export function AccountForm() {
  const { auth } = useAuthStore()
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // 账户信息表单
  const accountForm = useForm<AccountInfoValues>({
    resolver: zodResolver(accountInfoSchema),
    defaultValues: {
      name: auth.user?.name || '',
    },
  })

  // 修改密码表单
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  // 处理账户信息更新
  function onAccountInfoSubmit(_data: AccountInfoValues) {
    toast.success('Account information updated successfully')
    // 这里可以添加实际的API调用来更新用户信息
  }

  // 处理密码修改
  async function onChangePasswordSubmit(data: ChangePasswordValues) {
    try {
      const response = await api.auth.changePassword(data.oldPassword, data.newPassword, auth.accessToken)
      const result = await response.json()

      if (response.ok) {
        toast.success('Password changed successfully')
        passwordForm.reset()
        setIsChangingPassword(false)
      } else {
        toast.error(result.error || 'Failed to change password')
      }
    } catch (error) {
      toast.error('Network error. Please try again.')
    }
  }

  return (
    <div className="space-y-8">
      {/* 账户信息部分 */}
      <div>
        <h3 className="text-lg font-medium">Account Information</h3>
        <p className="text-sm text-muted-foreground">
          Update your account information.
        </p>
      </div>
      
      <Form {...accountForm}>
        <form onSubmit={accountForm.handleSubmit(onAccountInfoSubmit)} className="space-y-6">
          <FormField
            control={accountForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" {...field} />
                </FormControl>
                <FormDescription>
                  This is the name that will be displayed on your profile.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl>
              <Input value={auth.user?.username || ''} disabled />
            </FormControl>
            <FormDescription>
              Your username cannot be changed.
            </FormDescription>
          </FormItem>
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input value={auth.user?.email || ''} disabled />
            </FormControl>
            <FormDescription>
              Your email address cannot be changed.
            </FormDescription>
          </FormItem>
          <Button type="submit">Update account</Button>
        </form>
      </Form>

      <Separator />

      {/* 修改密码部分 */}
      <div>
        <h3 className="text-lg font-medium">Change Password</h3>
        <p className="text-sm text-muted-foreground">
          Change your password here. After saving, you'll be logged out.
        </p>
      </div>

      {!isChangingPassword ? (
        <Button onClick={() => setIsChangingPassword(true)}>
          Change Password
        </Button>
      ) : (
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onChangePasswordSubmit)} className="space-y-6">
            <FormField
              control={passwordForm.control}
              name="oldPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Enter your current password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Enter your new password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your new password must be at least 6 characters long.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Confirm your new password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-2">
              <Button type="submit">Save Password</Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsChangingPassword(false)
                  passwordForm.reset()
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}