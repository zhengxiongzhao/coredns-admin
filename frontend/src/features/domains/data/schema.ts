import { z } from 'zod'

export const domainSchema = z.object({
  domain: z.string(),
  space: z.string(),
  path: z.string(),
  is_marked_as_domain: z.boolean().optional().default(false),
  is_virtual: z.boolean().optional().default(false),
  record_count: z.number().optional().default(0),
  instance_id: z.number().optional(),
  instance_name: z.string().optional(),
  instance_host: z.string().optional(),
  instance_port: z.number().optional(),
  instance_base_path: z.string().optional(),
})

export type Domain = z.infer<typeof domainSchema>
