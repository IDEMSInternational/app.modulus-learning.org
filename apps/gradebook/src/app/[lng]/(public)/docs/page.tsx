import { Container, Section } from '@infonomic/uikit/react'
import type { Metadata } from 'next'

import { getMeta } from '@/lib/meta'
import { DocsList } from '@/modules/docs/components/list'
import { listDocs } from '@/modules/docs/lib/registry'
import { Breadcrumbs } from '@/ui/components/breadcrumbs'
import { GradientGlow } from '@/ui/components/gradient'
import type { Locale } from '@/i18n/i18n-config'

export const dynamicParams = true
export async function generateStaticParams() {
  return []
}
export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: Locale }>
}): Promise<Metadata> {
  const { lng } = await params
  return await getMeta(lng, { title: 'Docs', path: '/docs' })
}

export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ lng: Locale }>
}): Promise<React.JSX.Element> {
  const { lng } = await params
  const docs = listDocs()

  return (
    <>
      <GradientGlow />
      <Section className="py-5 pb-2">
        <Container>
          <Breadcrumbs lng={lng} breadcrumbs={[{ label: 'Docs', href: '/docs' }]} />
        </Container>
      </Section>
      <Section className="py-6">
        <Container>
          <h1 className="mb-6 text-3xl font-bold tracking-tight">Docs</h1>
          {docs.length === 0 ? <p>No docs published yet.</p> : <DocsList docs={docs} lng={lng} />}
        </Container>
      </Section>
    </>
  )
}
