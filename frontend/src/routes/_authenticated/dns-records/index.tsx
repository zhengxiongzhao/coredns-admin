import { DnsRecords } from '@/features/dns-records'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const dnsRecordsSearchSchema = z.object({
  domain: z.string().optional(),
  instance_id: z.number().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
})

export const Route = createFileRoute('/_authenticated/dns-records/')({
  component: DnsRecordsComponent,
  validateSearch: (search) => dnsRecordsSearchSchema.parse(search),
})

function DnsRecordsComponent() {
  const { domain, instance_id } = Route.useSearch()
  return <DnsRecords domain={domain} instanceId={instance_id} />
}
