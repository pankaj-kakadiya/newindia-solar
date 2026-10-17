import Script from 'next/script'
import type {MarketingSettings} from '../lib/marketing-settings'
import RouteTracker from './RouteTracker'

// IDs are validated against strict patterns in lib/marketing-settings.ts before they reach here.
export default function MarketingTags({settings}: {settings: MarketingSettings}) {
  const googleIds = [settings.ga4Id, settings.googleAdsId].filter(Boolean) as string[]
  const pixel = settings.metaPixelId
  if (!googleIds.length && !pixel) return null
  return <>
    {googleIds.length > 0 && <>
      <Script id="nis-gtag-src" src={`https://www.googletagmanager.com/gtag/js?id=${googleIds[0]}`} strategy="afterInteractive"/>
      <Script id="nis-gtag-init" strategy="afterInteractive">{`
        if(!location.pathname.startsWith('/admin')){
          window.dataLayer=window.dataLayer||[];
          function gtag(){dataLayer.push(arguments);}
          window.gtag=gtag;
          gtag('js',new Date());
          ${googleIds.map(id => `gtag('config','${id}');`).join('\n          ')}
        }
      `}</Script>
    </>}
    {pixel && <Script id="nis-meta-pixel" strategy="afterInteractive">{`
      if(!location.pathname.startsWith('/admin')){
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${pixel}');
        fbq('track','PageView');
      }
    `}</Script>}
    {pixel && <RouteTracker/>}
  </>
}
