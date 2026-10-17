import type {MetadataRoute} from 'next'
import {SITE_URL} from '../lib/seo'

export default function robots():MetadataRoute.Robots{
 return {
  rules:[{userAgent:'*',allow:'/',disallow:['/admin/','/api/','/checkout','/cart','/account','/login','/reset-password','/*?*sort=','/*?*page=']}],
  sitemap:`${SITE_URL}/sitemap.xml`,
  host:SITE_URL,
 }
}
