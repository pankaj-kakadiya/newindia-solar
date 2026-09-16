import {fitRectangle,imageSource,PreviewLayer,safeImageSource,sourceRectangle,spriteFor} from './configurator-visuals'

export async function exportBuilder(enclosure:any,layers:PreviewLayer[],code:string):Promise<void>{
  const width=1086,height=1448,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Preview export is unavailable in this browser.')
  const entries=[{item:enclosure,slot:{x_pct:0,y_pct:0,width_pct:100,height_pct:100,z_index:0,rotation_deg:0,settings:{fit:'contain'}}},...layers.map(l=>({item:l.component,slot:l.slot}))]
  const loaded=await Promise.all(entries.map(async entry=>{
    const src=imageSource(entry.item);if(!safeImageSource(src))throw new Error('One preview image has an unsupported URL.')
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new window.Image();const timer=window.setTimeout(()=>reject(new Error('An image took too long to load. Please retry.')),15000);img.crossOrigin='anonymous';img.onload=()=>{clearTimeout(timer);resolve(img)};img.onerror=()=>{clearTimeout(timer);reject(new Error('An image could not be loaded for export.'))};img.src=src})
    return {...entry,image}
  }))
  for(const {item,slot,image} of loaded){
    const source=sourceRectangle(spriteFor(item.visual_settings),image.naturalWidth,image.naturalHeight)
    const target=[slot.x_pct*width/100,slot.y_pct*height/100,slot.width_pct*width/100,slot.height_pct*height/100]
    const [x,y,w,h]=fitRectangle(source,target,slot.settings?.fit||'contain')
    ctx.save();const cx=target[0]+target[2]/2,cy=target[1]+target[3]/2;ctx.translate(cx,cy);ctx.rotate((slot.rotation_deg||0)*Math.PI/180);ctx.drawImage(image,source[0],source[1],source[2],source[3],x-cx,y-cy,w,h);ctx.restore()
  }
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create the PNG.')),'image/png'))
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`New-India-Solar-${code}-Preview.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
