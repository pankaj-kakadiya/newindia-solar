'use client'
import {useState} from 'react'
import {supabase} from '../lib/supabase'
import {loadPdfProducts} from '../lib/pdf-catalogues'
import type {PdfCatalogue} from '../lib/pdf-catalogues'
export default function CatalogueDownload({catalogue,preview=false}:{catalogue:PdfCatalogue;preview?:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function download(){setBusy(true);setMessage('Loading current products…');try{
  let current=catalogue
  if(!preview){const {data,error}=await supabase.from('product_catalogues').select('id,title,description,scope,category_ids,product_ids,show_prices,is_published,sort_order').eq('id',catalogue.id!).eq('is_published',true).maybeSingle();if(error||!data)throw new Error('This catalogue is no longer available. Refresh the page.');current=data as PdfCatalogue}
  const products=await loadPdfProducts(supabase,current,AbortSignal.timeout(60000))
  const {buildCataloguePdf,browserPdfImage}=await import('../lib/catalogue-pdf')
  const result=await buildCataloguePdf(current,products,browserPdfImage,setMessage);result.pdf.save(result.filename)
  setMessage(`${products.length} products exported.${result.missing?` ${result.missing} product images could not load; their details are included.`:''}`)
 }catch(e){setMessage(e instanceof Error?e.message:'Could not create the PDF. Please retry.')}finally{setBusy(false)}}
 return <div><button type="button" className="catButton" onClick={download} disabled={busy}>{busy?'Preparing PDF…':preview?'Preview / download PDF':'Download PDF'}</button>{message&&<p className="catStatus" role="status">{message}</p>}</div>
}
