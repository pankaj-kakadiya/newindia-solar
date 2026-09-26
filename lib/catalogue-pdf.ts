import {jsPDF} from 'jspdf'
import fonts from './catalogue-fonts.json'
import type {PdfCatalogue} from './pdf-catalogues'
import type {Product} from './catalogue'
import {activeVariants,attributesFor,attributeLabel,priceFor,productImage,safeAssetUrl} from './catalogue'
// Uses only public product fields. No HTML execution, server image proxy, or service-role key.
const text=(s:unknown)=>String(s??'').replace(/<[^>]*>/g,'').replace(/₹/g,'INR ').replace(/[–—]/g,'-').replace(/×/g,'x').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7e\n]/g,' ').trim()
export type PdfImage={data:string;width:number;height:number}
export type ImageLoader=(url:string)=>Promise<PdfImage|null>
export async function browserPdfImage(url:string):Promise<PdfImage|null>{
 const safe=safeAssetUrl(url);if(!safe)return null
 return new Promise(resolve=>{const img=new Image();let done=false;const finish=(v:PdfImage|null)=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(v)};const timer=setTimeout(()=>finish(null),8000);img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.onerror=()=>finish(null);img.onload=()=>{try{if(!img.naturalWidth||!img.naturalHeight)return finish(null);const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)return finish(null);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);finish({data:canvas.toDataURL('image/jpeg',0.82),width:canvas.width,height:canvas.height})}catch{finish(null)}};img.src=safe})
}
export async function buildCataloguePdf(c:PdfCatalogue,products:Product[],loadImage:ImageLoader,progress:(s:string)=>void=()=>{}){
 if(!products.length)throw new Error('No published products match this catalogue. Update the selection and try again.')
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true}),date=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'});let missing=0
 pdf.addFileToVFS('Catalogue-Regular.ttf',fonts.regular);pdf.addFont('Catalogue-Regular.ttf','Catalogue','normal');pdf.addFileToVFS('Catalogue-Bold.ttf',fonts.bold);pdf.addFont('Catalogue-Bold.ttf','Catalogue','bold')
 pdf.setProperties({title:text(c.title),author:'New India Solar Components Pvt Ltd',subject:'Buyer product catalogue'})
 const logo=await loadImage('/new-india-solar-full-logo.webp'),appendix=new Set<Product>()
 const ink=()=>pdf.setTextColor(12,30,49),green=()=>pdf.setTextColor(15,105,62)
 function label(value:unknown,x:number,y:number,size=8,bold=false){pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);pdf.text(text(value),x,y)}
 function fit(value:unknown,x:number,y:number,width:number,size:number,max:number,p?:Product,bold=false){pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);let lines=pdf.splitTextToSize(text(value),width) as string[];if(lines.length>max){if(p)appendix.add(p);lines=lines.slice(0,max);let last=lines[max-1];while(pdf.getTextWidth(last+'...')>width)last=last.slice(0,-1);lines[max-1]=last+'...'}for(const [i,l]of lines.entries())pdf.text(l,x,y+i*size*.43)}
 function box(x:number,y:number,w:number,h:number,fill=false){pdf.setDrawColor(214,229,223);pdf.setFillColor(fill?239:255,fill?248:255,fill?244:255);pdf.roundedRect(x,y,w,h,2,2,'FD')}
 function header(){
  pdf.setFillColor(255,255,255);pdf.rect(0,0,210,297,'F');ink()
  if(logo){const scale=Math.min(62/logo.width,24/logo.height);pdf.addImage(logo.data,'JPEG',9,4,logo.width*scale,logo.height*scale)}else label('NEW INDIA SOLAR',9,17,17,true)
  green();label('BUYER PRODUCT CATALOGUE',112,12,10,true);ink();label("Powering India's Solar Installations.",112,19,7);label('newindiasolar.com',112,25,8)
  pdf.setFillColor(240,248,244);pdf.rect(0,32,210,31,'F');green();label('SIMPLE CHOICES. STRONGER INSTALLATIONS.',9,39,8,true);ink();fit(c.title,9,48,192,19,1,undefined,true);fit(c.description||'Compare components, specifications and current product options.',9,55,192,8,1)
  green();label(`${products.length} products  |  Current product details  |  Project quotations`,9,61,7)
 }
 function footer(){pdf.setFillColor(10,62,47);pdf.rect(0,279,210,11,'F');pdf.setTextColor(255,255,255);label('Confirm current price, ratings, compatibility and warranty terms before ordering.',9,284,6.4);label('newindiasolar.com  |  Project quantities and bulk enquiries',9,288,6.4);ink();label('NEW INDIA SOLAR COMPONENTS PVT LTD',9,294,6.3,true)}
 for(let i=0;i<products.length;i++){
  if(i%4===0){if(i)pdf.addPage();header()}
  const p=products[i],x=8+(i%2)*99,y=67+Math.floor((i%4)/2)*105,w=95,h=101,v=activeVariants(p)[0],spec=(p.specifications||{}) as Record<string,unknown>,attrs=attributesFor(p,v||null)
  progress(`Building PDF: ${i+1} / ${products.length}`);box(x,y,w,h)
  const url=productImage(p)?.image_url,img=url?await loadImage(url):null
  if(img){const scale=Math.min(33/img.width,44/img.height);pdf.addImage(img.data,'JPEG',x+3+(33-img.width*scale)/2,y+3+(44-img.height*scale)/2,img.width*scale,img.height*scale)}else{missing++;fit('Product image unavailable',x+4,y+20,29,7,3)}
  const ref=text(spec['Catalogue reference']||v?.sku||'PRODUCT'),right=x+39
  pdf.setFillColor(220,245,231);pdf.roundedRect(right,y+4,52,6,1,1,'F');green();fit(ref,right+2,y+8.2,48,8,1,p)
  ink();fit(p.name.split('|')[0],right,y+15,52,9.3,3,p,true);fit(p.categories?.name||'Solar components',right,y+29,52,7.4,1,p)
  const warranty=Number((p as Product&{warranty_months?:number}).warranty_months)
  green();label(warranty>0?`${warranty} month warranty*`:'Project quote available',right,y+35,6.6,true)
  ink();label('Variant code',right,y+41,6);fit(v?.sku||'See product details',right,y+45,52,7.2,1,p)
  box(x+3,y+49,43,34);box(x+49,y+49,43,34);green();label('Key specifications',x+5,y+54,7.2,true);label('Components / details',x+51,y+54,7.2,true);ink()
  const specs=Object.entries(attrs).slice(0,5).map(([key,val])=>`${attributeLabel(key)}: ${val}`)
  if(!specs.length)for(const key of ['Product type','Input / output','Current reference','Enclosure target size'])if(spec[key])specs.push(`${key}: ${text(spec[key])}`)
  if(!specs.length)specs.push('See product page for specifications.')
  fit(specs.join('\n'),x+5,y+59,39,6.3,8,p)
  const details:string[]=[];if(spec['SPD reference'])details.push('SPD: '+text(spec['SPD reference']));if(spec['Breaker reference'])details.push('Breaker: '+text(spec['Breaker reference']))
  const inclusions=(p as Product&{inclusions?:unknown}).inclusions;if(Array.isArray(inclusions))for(const item of inclusions)if(typeof item==='string'&&!details.some(d=>d.includes(item)))details.push(item)
  if(!details.length)details.push(p.short_description||'View product for component details.')
  fit(details.join('\n'),x+51,y+59,39,6.3,8,p)
  pdf.setFillColor(229,247,238);pdf.roundedRect(x+3,y+86,89,12,2,2,'F');green()
  const price=activeVariants(p).map(item=>priceFor(p,item)).filter((value):value is NonNullable<ReturnType<typeof priceFor>>=>value!==null).sort((a,b)=>a.total-b.total)[0]||null;label(c.show_prices&&price?`${activeVariants(p).length>1?'From - ':''}incl. ${price.rate}% GST`:'Project pricing',x+5,y+90,6)
  label(c.show_prices&&price?`INR ${price.total.toLocaleString('en-IN',{maximumFractionDigits:2})}`:'Price on request',x+5,y+95.5,c.show_prices&&price?12:9,true)
  pdf.setFillColor(14,113,66);pdf.roundedRect(x+58,y+88,32,8,1,1,'F');pdf.setTextColor(255,255,255);label('Request quote >',x+61,y+93.3,7,true);pdf.link(x+58,y+88,32,8,{url:`https://newindiasolar.com/product/${encodeURIComponent(p.slug)}`});ink()
  if(activeVariants(p).length>1||Object.keys(attrs).length>5)appendix.add(p)
 }
 // Preserve additional variants and long text instead of squeezing or losing them in the four-card layout.
 if(appendix.size){let y=0;const newPage=()=>{pdf.addPage();ink();label('Product details & variants',10,18,17,true);y=29};newPage()
  const line=(value:unknown,size=8,bold=false)=>{pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);for(const l of pdf.splitTextToSize(text(value),188) as string[]){if(y>269)newPage();label(l,11,y,size,bold);y+=size*.48}y+=3}
  for(const p of appendix){line(p.name,11,true);line(p.short_description||'');for(const [k,val]of Object.entries(attributesFor(p,null)))line(`${attributeLabel(k)}: ${val}`);const spec=p.specifications as Record<string,unknown>|null;for(const k of ['Catalogue reference','SPD reference','Breaker reference','Current reference','Input / output','Enclosure target size','Source device markings','Assembled voltage rating','IP rating / certification'])if(spec?.[k])line(`${k}: ${text(spec[k])}`)
   const inclusions=(p as Product&{inclusions?:unknown}).inclusions;if(Array.isArray(inclusions))line('Includes: '+inclusions.filter(x=>typeof x==='string').join(', '))
   for(const v of activeVariants(p)){line(`${v.sku} | ${v.title||p.name}`,8,true);if(c.show_prices){const price=priceFor(p,v);line(price?`INR ${price.total.toFixed(2)} incl. ${price.rate}% GST (INR ${price.base.toFixed(2)} excl. GST)`:'Price on request')}for(const [k,val]of Object.entries(attributesFor(p,v)))line(`${attributeLabel(k)}: ${val}`)}
  }
 }
 const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);footer();label(`${date} | ${n} / ${pages}`,166,294,6)}
 return {pdf,missing,filename:(c.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'new-india-solar-catalogue')+'.pdf'}
}
