/** Part 28.2: gallery navigation only. No product or commerce calculations. */
export type GalleryTouch = {id:number;x:number;y:number;at:number}

export function galleryKeyIndex(key:string,current:number,count:number):number|null {
  if(!Number.isInteger(count)||count<2)return null
  const index=Math.min(Math.max(Number.isInteger(current)?current:0,0),count-1)
  switch(key){
    case 'ArrowLeft':return(index+count-1)%count
    case 'ArrowRight':return(index+1)%count
    case 'Home':return 0
    case 'End':return count-1
    default:return null
  }
}

/** A sideways one-finger swipe, not page scrolling, pinching or a long press. */
export function gallerySwipe(start:GalleryTouch|null,end:GalleryTouch|null): -1|0|1 {
  if(!start||!end||start.id!==end.id)return 0
  if(![start.x,start.y,start.at,end.x,end.y,end.at].every(Number.isFinite))return 0
  const dx=end.x-start.x,dy=end.y-start.y,elapsed=end.at-start.at
  if(elapsed<0||elapsed>1200||Math.abs(dx)<50||Math.abs(dx)<=Math.abs(dy)*1.3)return 0
  return dx<0?1:-1
}
