import { z } from 'zod'

// We're keeping a simple schema here.
// You can add more fields as needed.
export const dnsRecordSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.string(),
  content: z.string(),
  ttl: z.number(),
  priority: z.number().optional().default(100),
  domain: z.string().optional(), // 添加domain字段用于统一域名显示
  // 冲突警告相关字段
  has_conflict: z.boolean().optional().default(false),
  conflict_type: z.string().optional().default('none'),
  conflict_message: z.string().optional().default(''),
  conflict_details: z.string().optional().default(''),
  // 多条记录相关字段
  is_multiple_record: z.boolean().optional().default(false),
  record_group: z.string().optional(), // 记录组标识
  is_root_record: z.boolean().optional().default(true), // 是否为根记录
  // ETCD实例信息
  instance_id: z.number().optional(),
  instance_name: z.string().optional(),
  instance_host: z.string().optional(),
  instance_port: z.number().optional(),
  instance_base_path: z.string().optional(),
})

export type DnsRecord = z.infer<typeof dnsRecordSchema>
