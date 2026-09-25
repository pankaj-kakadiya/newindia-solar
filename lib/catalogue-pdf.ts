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
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});const date=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'});let y=20,missing=0
 pdf.addFileToVFS('Catalogue-Regular.ttf',fonts.regular);pdf.addFont('Catalogue-Regular.ttf','Catalogue','normal');pdf.addFileToVFS('Catalogue-Bold.ttf',fonts.bold);pdf.addFont('Catalogue-Bold.ttf','Catalogue','bold');pdf.setFont('Catalogue','normal')
 pdf.setProperties({title:text(c.title),author:'New India Solar Components Pvt Ltd',subject:'Product catalogue'})
 const logo=await loadImage('/new-india-solar-full-logo.webp')
 function header(){pdf.setFillColor(16,77,53);pdf.rect(0,0,210,9,'F');pdf.setTextColor(20,40,32);y=22}
 function page(){pdf.addPage();header()}
 function line(value:string,size=10,bold=false){pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);const lines=pdf.splitTextToSize(text(value),174) as string[];for(const l of lines){if(y>270)page();pdf.text(l,18,y);y+=size*0.46}y+=3}
 header();if(logo){const w=95,h=Math.min(42,w*logo.height/logo.width);pdf.addImage(logo.data,'JPEG',18,y,w,h);y+=h+20}else{line('NEW INDIA SOLAR',24,true);y+=10}
 line(c.title,26,true);line(c.description,12);y+=10;line(`${products.length} products | Updated ${date}`,12,true);line('Powering India\'s Solar Installations.',12);line('newindiasolar.com',12);y+=12;line(c.show_prices?'Prices in INR. GST treatment is shown for each variant. Prices and availability may change; confirm your quotation before ordering.':'Contact our team for current pricing and project quantities.');line('Product images are illustrative. Confirm ratings, compatibility and final specifications before ordering.')
 const groups=new Map<string,number>();for(const p of products)groups.set(p.categories?.name||'Other',(groups.get(p.categories?.name||'Other')||0)+1)
 y+=8;line('IN THIS CATALOGUE',12,true);for(const [name,count]of groups)line(`${name}: ${count} products`)
 for(let i=0;i<products.length;i++){
  const p=products[i];progress(`Building PDF: ${i+1} / ${products.length}`);page();line(p.categories?.name||'PRODUCT',9,true);line(p.name,17,true)
  if(y+75>270)page();const url=productImage(p)?.image_url;const image=url?await loadImage(url):null
  if(image){const scale=Math.min(174/image.width,65/image.height);const w=image.width*scale,h=image.height*scale;pdf.addImage(image.data,'JPEG',18+(174-w)/2,y,w,h);y+=h+8}else{missing++;line('Product image unavailable');y+=8}
  if(p.short_description)line(p.short_description)
  const attributes=attributesFor(p,null);for(const [key,value]of Object.entries(attributes))line(`${attributeLabel(key)}: ${value}`)
  for(const key of ['Catalogue reference','SPD reference','Breaker reference','Current reference','Input / output','Enclosure target size','Source device markings','Assembled voltage rating','IP rating / certification']){const value=(p.specifications as Record<string,unknown>|null)?.[key];if(typeof value==='string'&&value)line(`${key}: ${value}`)}
  line('AVAILABLE VARIANTS',11,true)
  for(const v of activeVariants(p)){
   line(`${v.sku} | ${v.title||p.name}${v.unit?' | Unit: '+v.unit:''}`,10,true)
   if(c.show_prices){const price=priceFor(p,v);line(price?`INR ${price.total.toFixed(2)} incl. ${price.rate}% GST (INR ${price.base.toFixed(2)} excl. GST)`:'Price on request')}
   for(const [key,value]of Object.entries(attributesFor(p,v)))if(attributes[key]!==value)line(`${attributeLabel(key)}: ${value}`)
  }
  if(y>265)page();pdf.setTextColor(18,116,70);pdf.setFontSize(10);pdf.textWithLink('View current product details and request a quote',18,y,{url:`https://newindiasolar.com/product/${encodeURIComponent(p.slug)}`});pdf.setTextColor(20,40,32)
 }
 const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setDrawColor(210,225,216);pdf.line(18,281,192,281);pdf.setFontSize(8);pdf.setTextColor(80,95,88);pdf.text(`New India Solar | newindiasolar.com | ${date}`,18,287);pdf.text(`${n} / ${pages}`,192,287,{align:'right'})}
 return {pdf,missing,filename:(c.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'new-india-solar-catalogue')+'.pdf'}
}
