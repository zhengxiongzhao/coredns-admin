import { Domains } from '@/features/domains'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const domainsSearchSchema = z.object({
  domain: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  showVirtual: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/domains/')({
  component: DomainsComponent,
  validateSearch: (search) => domainsSearchSchema.parse(search),
})

function DomainsComponent() {
  const search = Route.useSearch()
  console.log('路由search参数:', search)
  console.log('传递给Domains组件的参数:', { domain: search.domain, showVirtual: search.showVirtual })
  return <Domains domain={search.domain} showVirtual={search.showVirtual} />
}
