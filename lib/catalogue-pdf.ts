import {jsPDF} from 'jspdf'
import fonts from './catalogue-fonts.json'
import type {PdfCatalogue} from './pdf-catalogues'
import type {Product} from './catalogue'
import {activeVariants,attributesFor,attributeLabel,priceFor,productImage,safeAssetUrl} from './catalogue'
import {COMBO_SLUG_PREFIX} from './category-pages'
const categoryLabel=(p:Product)=>String(p.slug||'').toLowerCase().startsWith(COMBO_SLUG_PREFIX)?'ACDB + DCDB Combo':p.categories?.name||'Solar components'
// Uses only public product fields. No HTML execution, server image proxy, or service-role key.
const text=(s:unknown)=>String(s??'').replace(/<[^>]*>/g,'').replace(/₹/g,'INR ').replace(/[–—]/g,'-').replace(/×/g,'x').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7e\n]/g,' ').trim()
export type PdfImage={data:string;width:number;height:number}
export type ImageLoader=(url:string)=>Promise<PdfImage|null>
export async function browserPdfImage(url:string):Promise<PdfImage|null>{
 const safe=safeAssetUrl(url);if(!safe)return null
 return new Promise(resolve=>{const img=new Image();let done=false;const finish=(v:PdfImage|null)=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(v)};const timer=setTimeout(()=>finish(null),8000);img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.onerror=()=>finish(null);img.onload=()=>{try{if(!img.naturalWidth||!img.naturalHeight)return finish(null);const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)return finish(null);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);finish({data:canvas.toDataURL('image/jpeg',0.82),width:canvas.width,height:canvas.height})}catch{finish(null)}};img.src=safe})
}
const SITE='https://newindiasolar.com'
const productUrl=(p:Product)=>`${SITE}/product/${encodeURIComponent(p.slug)}`
const inr=(n:number)=>`INR ${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const CATEGORY_URL:Record<string,string>={'acdb-dcdb-combo':`${SITE}/categories/acdb-dcdb-combo`,acdb:`${SITE}/categories/acdb`,dcdb:`${SITE}/categories/dcdb`}

// Internal fields that must never appear in a buyer catalogue.
const PRIVATE_SPEC=/cost|margin|purchase|supplier|vendor|internal|private|profit|buy.?price|landed|markup|dealer.?price/i
export const PRODUCTS_PER_PAGE=9
export const gridPages=(count:number)=>Math.ceil(count/PRODUCTS_PER_PAGE)

/** Every public specification for a product: known attributes first (with labels), then other spec fields. */
function allDetails(p:Product):[string,string][]{
 const seen=new Set<string>(),out:[string,string][]=[]
 const v=activeVariants(p)[0]||null
 for(const [k,val] of Object.entries(attributesFor(p,v))){out.push([attributeLabel(k),val]);seen.add(attributeLabel(k).toLowerCase())}
 const spec=(p.specifications&&typeof p.specifications==='object'&&!Array.isArray(p.specifications)?p.specifications:{}) as Record<string,unknown>
 for(const [k,val] of Object.entries(spec)){
  if(val===null||val===undefined||typeof val==='object'||PRIVATE_SPEC.test(k))continue
  const label=k.replace(/_/g,' ').replace(/\s+/g,' ').trim(),value=String(val).trim()
  if(!value||seen.has(label.toLowerCase()))continue
  seen.add(label.toLowerCase());out.push([label.charAt(0).toUpperCase()+label.slice(1),value])
 }
 return out
}

export async function buildCataloguePdf(c:PdfCatalogue,products:Product[],loadImage:ImageLoader,progress:(s:string)=>void=()=>{}){
 if(!products.length)throw new Error('No published products match this catalogue. Update the selection and try again.')
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true}),date=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});let missing=0
 pdf.addFileToVFS('Catalogue-Regular.ttf',fonts.regular);pdf.addFont('Catalogue-Regular.ttf','Catalogue','normal');pdf.addFileToVFS('Catalogue-Bold.ttf',fonts.bold);pdf.addFont('Catalogue-Bold.ttf','Catalogue','bold')
 pdf.setProperties({title:text(c.title),author:'New India Solar Components Pvt Ltd',subject:'Product catalogue'})
 const logo=await loadImage('/new-india-solar-full-logo.webp')
 const W=210,H=297,M=8
 const rgb={ink:[12,30,49],muted:[96,112,122],green:[15,122,61],deep:[10,58,44],mint:[236,247,241],line:[220,232,226],white:[255,255,255],gold:[240,148,42]} as const
 const fill=(k:keyof typeof rgb)=>pdf.setFillColor(...(rgb[k] as [number,number,number]))
 const color=(k:keyof typeof rgb)=>pdf.setTextColor(...(rgb[k] as [number,number,number]))
 const draw=(k:keyof typeof rgb)=>pdf.setDrawColor(...(rgb[k] as [number,number,number]))
 function label(value:unknown,x:number,y:number,size=8,bold=false,align:'left'|'right'|'center'='left'){pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);pdf.text(text(value),x,y,{align})}
 /** Wrapped text; returns the y after the last line. */
 function para(value:unknown,x:number,y:number,width:number,size:number,max:number,bold=false,lh=0.42){pdf.setFont('Catalogue',bold?'bold':'normal');pdf.setFontSize(size);let lines=pdf.splitTextToSize(text(value),width) as string[];if(lines.length>max){lines=lines.slice(0,max);let last=lines[max-1];while(last&&pdf.getTextWidth(last+'...')>width)last=last.slice(0,-1);lines[max-1]=last+'...'}lines.forEach((l,i)=>pdf.text(l,x,y+i*size*lh));return y+lines.length*size*lh}
 function placeImage(img:PdfImage,x:number,y:number,w:number,h:number){const s=Math.min(w/img.width,h/img.height);pdf.addImage(img.data,'JPEG',x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s)}
 function button(caption:string,x:number,y:number,w:number,h:number,url:string,style:'green'|'light'='green'){fill(style==='green'?'green':'white');draw(style==='green'?'green':'line');pdf.roundedRect(x,y,w,h,1.6,1.6,'FD');color(style==='green'?'white':'green');label(caption,x+w/2,y+h/2+1.2,Math.min(7.4,h*1.05),true,'center');pdf.link(x,y,w,h,{url})}

 // Load every product image once (cover reuses them).
 const images=new Map<string,PdfImage|null>()
 for(let i=0;i<products.length;i++){progress(`Loading images: ${i+1} / ${products.length}`);const url=productImage(products[i])?.image_url;const img=url?await loadImage(url):null;if(!img)missing++;images.set(products[i].id,img)}
 const categoryUrl=(c.storefront&&CATEGORY_URL[c.storefront])||`${SITE}/shop`
 const prices=products.map(p=>activeVariants(p).map(v=>priceFor(p,v)).filter((x):x is NonNullable<ReturnType<typeof priceFor>>=>!!x).sort((a,b)=>a.base-b.base)[0]||null)
 const lowest=prices.filter((x):x is NonNullable<typeof x>=>!!x).sort((a,b)=>a.base-b.base)[0]

 // ---------- Cover ----------
 fill('deep');pdf.rect(0,0,W,128,'F');fill('green');pdf.rect(0,124,W,4,'F')
 fill('white');pdf.roundedRect(M+4,12,70,24,3,3,'F');if(logo)placeImage(logo,M+7,14,64,20);else{color('ink');label('NEW INDIA SOLAR',M+9,27,14,true)}
 color('white');label('PRODUCT CATALOGUE  |  '+date.toUpperCase(),W-M-4,22,7.5,true,'right')
 color('white');label('NEW INDIA SOLAR COMPONENTS PVT LTD',M+4,52,8,true)
 pdf.setTextColor(170,232,196);label('Powering India’s Solar Installations.',M+4,58,8)
 color('white');let cy=para(c.title,M+4,74,W-2*M-8,26,2,true,0.4)
 color('white');cy=para(c.description,M+4,cy+3,W-2*M-8,9.2,3,false,0.46)
 const chips=[`${products.length} products`,...(c.show_prices&&lowest?[`From ${inr(lowest.base)} + GST`]:[]),'1-6 kW single phase','GST invoice']
 let cx=M+4;for(const chip of chips){pdf.setFont('Catalogue','bold');pdf.setFontSize(7.6);const w=pdf.getTextWidth(text(chip))+8;pdf.setFillColor(255,255,255);pdf.setGState(new (pdf as any).GState({opacity:0.14}));pdf.roundedRect(cx,111,w,8,4,4,'F');pdf.setGState(new (pdf as any).GState({opacity:1}));color('white');label(chip,cx+4,116.3,7.6,true);cx+=w+3}
 // Hero image grid
 const hero=products.filter(p=>images.get(p.id)).slice(0,6),gw=(W-2*M-8)/3,gh=44
 hero.forEach((p,i)=>{const x=M+(i%3)*(gw+4),y=136+Math.floor(i/3)*(gh+4);fill('mint');draw('line');pdf.roundedRect(x,y,gw,gh,3,3,'FD');placeImage(images.get(p.id)!,x+3,y+3,gw-6,gh-6);pdf.link(x,y,gw,gh,{url:productUrl(p)})})
 // How to order
 const oy=236;color('ink');label('HOW TO ORDER',M,oy,8,true);color('muted');label('Tap any product in this catalogue to open it on our website.',M,oy+5,7)
 const steps=[['1','Choose a product','Compare ratings, components and prices.'],['2','Order online','Add to cart and pay securely with a GST invoice.'],['3','Bulk & dealer pricing','Send one RFQ for project quantities.']]
 steps.forEach(([n,t,d],i)=>{const x=M+i*((W-2*M-8)/3+4),w=(W-2*M-8)/3;fill('mint');pdf.roundedRect(x,oy+9,w,20,2,2,'F');fill('green');pdf.circle(x+6,oy+16,3.4,'F');color('white');label(n,x+6,oy+17.4,7.5,true,'center');color('ink');label(t,x+12,oy+16.6,7.8,true);color('muted');para(d,x+12,oy+21.4,w-15,6.6,2)})
 button('Shop this category online  >',M,oy+33,(W-2*M-4)/2,9,categoryUrl);button('Request bulk / dealer pricing  >',M+(W-2*M-4)/2+4,oy+33,(W-2*M-4)/2,9,`${SITE}/bulk-order`,'light')

 // ---------- Product grid: 9 per page ----------
 const top=22,bottom=280,cols=3,rows=PRODUCTS_PER_PAGE/3,gap=4,cw=(W-2*M-gap*(cols-1))/cols,ch=(bottom-top-gap*(rows-1))/rows
 function pageHeader(){fill('white');pdf.rect(0,0,W,H,'F');fill('deep');pdf.rect(0,0,W,16,'F');if(logo){fill('white');pdf.roundedRect(M,3,34,10,1.6,1.6,'F');placeImage(logo,M+1.5,3.8,31,8.4)}color('white');label(c.title,W-M,9.6,9,true,'right');pdf.setTextColor(170,232,196);label(c.show_prices?'Base prices exclude 18% GST':'Contact us for pricing',W-M,13.6,6,false,'right')}
 for(let i=0;i<products.length;i++){
  if(i%(cols*rows)===0){pdf.addPage();pageHeader()}
  const p=products[i],slot=i%(cols*rows),x=M+(slot%cols)*(cw+gap),y=top+Math.floor(slot/cols)*(ch+gap),v=activeVariants(p)[0]
  progress(`Building PDF: ${i+1} / ${products.length}`)
  fill('white');draw('line');pdf.setLineWidth(0.3);pdf.roundedRect(x,y,cw,ch,2.4,2.4,'FD')
  // Image (large)
  const ih=38;fill('mint');pdf.roundedRect(x+2,y+2,cw-4,ih,1.8,1.8,'F')
  const img=images.get(p.id);if(img)placeImage(img,x+4,y+3.5,cw-8,ih-3);else{color('muted');label('Image coming soon',x+cw/2,y+2+ih/2,7,false,'center')}
  // Category chip
  pdf.setFont('Catalogue','bold');pdf.setFontSize(5.4);const cat=text(categoryLabel(p)).toUpperCase(),cwid=pdf.getTextWidth(cat)+4;fill('white');pdf.roundedRect(x+4,y+4,cwid,4.6,2.3,2.3,'F');color('green');label(cat,x+6,y+7.3,5.4,true)
  // Name + SKU
  color('ink');let ty=para(p.name.split('|')[0].trim()||p.name,x+3,y+ih+6,cw-6,7.6,2,true,0.43)
  const sub=p.name.includes('|')?p.name.split('|').slice(1).join('|').trim():'';color('muted');if(sub)ty=para(sub,x+3,ty+0.2,cw-6,5.8,1,false,0.42)
  label(`SKU: ${v?.sku||'-'}`,x+3,ty+1.8,5.6)
  // Key specs: most useful first, only as many as fit above the price
  const KEY=/spd|mcb|fuse|rating|protection|configuration|input|output|voltage|current|string|phase|capacity/i
  const all=allDetails(p),ranked=[...all.filter(([k])=>KEY.test(k)),...all.filter(([k])=>!KEY.test(k)&&!/^brand$/i.test(k))]
  const priceTop=y+ch-15.5-3.2;let sy=ty+5.6;const fitCount=Math.max(0,Math.floor((priceTop-1-sy)/2.9)+1)
  for(const [k,val] of ranked.slice(0,Math.min(5,fitCount))){color('muted');pdf.setFont('Catalogue','normal');pdf.setFontSize(5.6);const kk=text(k)+': ';pdf.text(kk,x+3,sy);color('ink');pdf.setFont('Catalogue','bold');const room=cw-6-pdf.getTextWidth(kk);let vv=text(val);while(vv&&pdf.getTextWidth(vv)>room)vv=vv.slice(0,-1);pdf.text(vv+(vv.length<text(val).length?'...':''),x+3+pdf.getTextWidth(kk),sy);sy+=2.9}
  // Price
  const price=prices[i],py=y+ch-15.5
  draw('line');pdf.line(x+3,py-3.2,x+cw-3,py-3.2)
  if(c.show_prices&&price){color('ink');label(inr(price.base),x+3,py+1,10.5,true);color('muted');label(`${activeVariants(p).length>1?'From  ':''}+ ${price.rate}% GST  |  ${inr(price.total)} incl.`,x+3,py+4.6,5.4)}
  else{color('ink');label('Price on request',x+3,py+2.5,9,true)}
  // Button + whole-card link
  button('View details & buy  >',x+3,y+ch-8.5,cw-6,6.2,productUrl(p))
  pdf.link(x,y,cw,ch-9,{url:productUrl(p)})
 }

 // ---------- Footer on every page ----------
 const pages=pdf.getNumberOfPages()
 for(let n=1;n<=pages;n++){pdf.setPage(n);fill('deep');pdf.rect(0,H-14,W,14,'F');color('white');label('newindiasolar.com',M,H-8,8,true);pdf.link(M,H-11,32,5,{url:SITE});pdf.setTextColor(170,232,196);label(c.show_prices?'Prices exclude 18% GST and are subject to stock. Confirm current price before ordering.':'Confirm current price, ratings and stock before ordering.',M,H-4.2,6);color('white');label('Bulk / dealer pricing  >',W-M,H-8,7.4,true,'right');pdf.link(W-M-34,H-11,34,5,{url:`${SITE}/bulk-order`});pdf.setTextColor(170,232,196);label(`${date}  |  Page ${n} of ${pages}`,W-M,H-4.2,6,false,'right')}
 return {pdf,missing,filename:(c.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'new-india-solar-catalogue')+'.pdf'}
}
