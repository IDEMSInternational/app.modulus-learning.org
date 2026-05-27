import { ScrollToTop } from '@infonomic/uikit/react'
import type { Metadata, Viewport } from 'next'

import { getTranslations } from '@/i18n/server'
import { getMeta } from '@/lib/meta'
import { ClientUserSessionProvider } from '@/modules/app/session/client-provider'
import { AppBarFront } from '@/ui/components/app-bar-front'
import { SiteFooter } from '@/ui/components/site-footer'
import { Providers } from '../providers'
import { DocumentRoot } from '../root'
import type { Locale } from '@/i18n/i18n-config'

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: '#050708',
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: Locale }>
}): Promise<Metadata> {
  const { lng } = await params
  return await getMeta(lng)
}

export default async function PublicLayout({
  children,
  params,
}: LayoutProps<'/[lng]'>): Promise<React.JSX.Element> {
  const { lng } = (await params) as { lng: Locale }
  const translations = await getTranslations(lng)

  return (
    <DocumentRoot lng={lng}>
      <Providers translations={translations}>
        <ClientUserSessionProvider>
          <div className="layout-container root flex min-h-screen flex-col">
            <AppBarFront lng={lng} />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter lng={lng} />
            <ScrollToTop />
          </div>
        </ClientUserSessionProvider>
      </Providers>
    </DocumentRoot>
  )
}
