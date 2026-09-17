'use client'
import {useEffect,useState} from 'react'
import Image from 'next/image'
import {Sprite,safeImageSource} from '../lib/configurator-visuals'
export default function ComponentSprite({src,alt,sprite,fit='contain'}:{src:string;alt:string;sprite?:Sprite;fit?:string}){
 const [failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[src,sprite?.id])
 if(!safeImageSource(src)||failed)return <span className="cvAssetMissing" role="img" aria-label={`${alt}: image unavailable`}>Image unavailable</span>
 if(!sprite)return <Image src={src} alt={alt} fill unoptimized sizes="(max-width:900px) 90vw, 500px" style={{objectFit:fit==='fill'?'fill':'contain',objectPosition:fit==='contain-top'?'center top':'center'}} onError={()=>setFailed(true)}/>
 return <svg role="img" aria-label={alt} viewBox={sprite.sourceRectPx.join(' ')} preserveAspectRatio={fit==='fill'?'none':fit==='contain-top'?'xMidYMin meet':'xMidYMid meet'} width="100%" height="100%" className="cvSprite"><title>{alt}</title><image href={src} width={sprite.imageSizePx.width} height={sprite.imageSizePx.height} onError={()=>setFailed(true)}/></svg>
}
