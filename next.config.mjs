const production=process.env.NODE_ENV==='production'
const cspParts=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self'",
 "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data: https:",
 "media-src 'self' blob: https:",
 "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://checkout.razorpay.com https://graph.facebook.com",
 "frame-src 'self' https://*.razorpay.com https://checkout.razorpay.com",
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

/** @type {import('next').NextConfig} */
const nextConfig={
 reactStrictMode:true,
 poweredByHeader:false,
 async headers(){
  return [
   {source:'/:path*',headers:securityHeaders},
   {source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]},
   {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}
  ]
 }
}

export default nextConfig
