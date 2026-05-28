import { notFound } from 'next/navigation'

import { Container, Section } from '@infonomic/uikit/react'
import type { Metadata } from 'next'

import { getMeta } from '@/lib/meta'
import { parseDocFile } from '@/modules/docs/lib/frontmatter'
import { findDocBySlug, listDocs, readDocSource } from '@/modules/docs/lib/registry'
import { renderMarkdown } from '@/modules/docs/lib/render'
import { Breadcrumbs } from '@/ui/components/breadcrumbs'
import { GradientGlow } from '@/ui/components/gradient'
import type { Locale } from '@/i18n/i18n-config'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return listDocs().map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: Locale; slug: string }>
}): Promise<Metadata> {
  const { lng, slug } = await params
  const entry = findDocBySlug(slug)
  if (!entry) return await getMeta(lng)
  return await getMeta(lng, {
    title: entry.frontmatter.title,
    path: `/docs/${entry.slug}`,
    description: entry.frontmatter.summary,
  })
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ lng: Locale; slug: string }>
}): Promise<React.JSX.Element> {
  const { lng, slug } = await params
  const entry = findDocBySlug(slug)
  if (!entry) notFound()

  const source = readDocSource(entry)
  const { frontmatter, body } = parseDocFile(source, entry.filePath)
  const { content } = await renderMarkdown(body, frontmatter.title)

  return (
    <>
      <GradientGlow />
      <Section className="py-5 pb-2">
        <Container>
          <Breadcrumbs
            lng={lng}
            breadcrumbs={[
              { label: 'Docs', href: '/docs' },
              { label: frontmatter.title, href: `/docs/${entry.slug}` },
            ]}
          />
        </Container>
      </Section>
      <Section className="py-6">
        <Container>
          <article className="prose">
            <h1>{frontmatter.title}</h1>
            {content}
          </article>
        </Container>
      </Section>
    </>
  )
}
