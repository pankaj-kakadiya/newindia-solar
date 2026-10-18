const production=process.env.NODE_ENV==='production'
const cspParts=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self'",
 "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://connect.facebook.net",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data: https:",
 "media-src 'self' blob: https:",
 "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://checkout.razorpay.com https://graph.facebook.com https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com https://www.google.co.in https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.googleadservices.com",
 "frame-src 'self' https://*.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com",
 "worker-src 'self' blob:",
 "manifest-src 'self'"
]
if(production)cspParts.push('upgrade-insecure-requests')
const csp=cspParts.join('; ')

const securityHeaders=[
 {key:'Content-Security-Policy',value:csp},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 ...(production?[{key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'}]:[])
]

// Shareable catalogue links on our own domain (e.g. https://newindiasolar.com/downloads/acdb-dcdb-combo-catalogue.pdf).
// The PDF files are hosted on IndiaMART's document store; to publish a new version, upload it and change the URL here.
const catalogueFiles={
 'acdb-dcdb-combo-catalogue.pdf':'https://5.imimg.com/data5/SELLER/Doc/2026/10/654288977/QY/NK/DP/246685908/newindia-solar-acdb-dcdb-combo-catalogue-hd.pdf',
 'acdb-catalogue.pdf':'https://5.imimg.com/data5/SELLER/Doc/2026/10/654288979/GT/EG/CH/246685908/newindia-solar-acdb-catalogue-hd.pdf',
 'dcdb-catalogue.pdf':'https://5.imimg.com/data5/SELLER/Doc/2026/10/654288980/VQ/YP/RX/246685908/newindia-solar-dcdb-catalogue-hd.pdf'
}

/** @type {import('next').NextConfig} */
const nextConfig={
 reactStrictMode:true,
 poweredByHeader:false,
 async redirects(){
  // The storefront sells only ACDB, DCDB and ACDB + DCDB combos; builders and other categories were retired.
  const retiredCategories=['enclosures','mcb-mccb','spd','dc-fuses','solar-cable','mc4-connectors','cable-glands','terminal-blocks','earthing-kits','bos-accessories']
  return [
   {source:'/combo',destination:'/categories/acdb-dcdb-combo',permanent:true},
   {source:'/customize',destination:'/categories/acdb-dcdb-combo',permanent:true},
   {source:'/customize/acdb',destination:'/categories/acdb',permanent:true},
   {source:'/customize/dcdb',destination:'/categories/dcdb',permanent:true},
   {source:'/customize/:path*',destination:'/categories/acdb-dcdb-combo',permanent:true},
   ...retiredCategories.map(slug=>({source:`/categories/${slug}`,destination:'/categories',permanent:true}))
   ,{source:'/downloads/new-india-solar-product-catalogue.pdf',destination:'/downloads',permanent:true}
  ]
 },
 async rewrites(){
  return Object.entries(catalogueFiles).map(([file,destination])=>({source:`/downloads/${file}`,destination}))
 },
 async headers(){
  return [
   {source:'/:path*',headers:securityHeaders},
   {source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]},
   {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}
  ]
 }
}

export default nextConfig
