'use client'

import {useEffect} from 'react'
import {AlertTriangle,RotateCcw} from 'lucide-react'
import {BuyerButton} from '../components/buyer/BuyerUI'

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error(error)},[error])
 return <main className="container" style={{paddingBlock:48}}><section className="nisState"><div className="nisStateIcon"><AlertTriangle size={26}/></div><span className="nisEyebrow">Something went wrong</span><h1>We could not load this page.</h1><p>Your cart or account data has not been intentionally cleared. Retry the page first; if the problem continues, return to the store.</p><div className="nisStateActions"><BuyerButton onClick={reset}><RotateCcw size={16}/> Try again</BuyerButton><BuyerButton href="/" variant="outline">Return to homepage</BuyerButton></div></section></main>
}
