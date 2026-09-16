'use client'

import Link from 'next/link'
import {AlertCircle,CheckCircle2,Info,TriangleAlert} from 'lucide-react'
import {ButtonHTMLAttributes,HTMLAttributes,InputHTMLAttributes,ReactNode,SelectHTMLAttributes,TextareaHTMLAttributes} from 'react'

type ButtonVariant='primary'|'secondary'|'outline'|'ghost'|'danger'
type ButtonSize='sm'|'md'|'lg'
const sizeClass:Record<ButtonSize,string>={sm:'nisBtnSm',md:'',lg:'nisBtnLg'}

export function BuyerButton({href,children,variant='primary',size='md',block=false,className='',...props}:{href?:string;children:ReactNode;variant?:ButtonVariant;size?:ButtonSize;block?:boolean;className?:string}&ButtonHTMLAttributes<HTMLButtonElement>){
 const classes=['nisBtn',`nisBtn${variant[0].toUpperCase()}${variant.slice(1)}`,sizeClass[size],block?'nisBtnBlock':'',className].filter(Boolean).join(' ')
 if(href)return <Link href={href} className={classes}>{children}</Link>
 return <button {...props} className={classes}>{children}</button>
}

export function BuyerBadge({children,tone='default',className=''}:{children:ReactNode;tone?:'default'|'success'|'warning'|'danger'|'info'|'dark';className?:string}){
 return <span className={`nisBadge ${tone==='default'?'':tone} ${className}`.trim()}>{children}</span>
}

export function BuyerCard({children,hover=false,className='',...props}:{children:ReactNode;hover?:boolean;className?:string}&HTMLAttributes<HTMLDivElement>){
 return <div {...props} className={`nisCard ${hover?'nisCardHover':''} ${className}`.trim()}>{children}</div>
}

export function BuyerField({label,optional=false,hint,error,children,className=''}:{label:string;optional?:boolean;hint?:string;error?:string;children:ReactNode;className?:string}){
 return <label className={`nisField ${className}`.trim()}><span className="nisFieldLabel"><span>{label}</span>{optional&&<small>Optional</small>}</span>{children}{error?<span className="nisFieldError">{error}</span>:hint?<span className="nisFieldHint">{hint}</span>:null}</label>
}

export function BuyerInput({className='',error,...props}:InputHTMLAttributes<HTMLInputElement>&{error?:boolean}){
 return <input {...props} aria-invalid={error||undefined} className={`nisInput ${className}`.trim()}/>
}

export function BuyerSelect({className='',error,children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{error?:boolean;children:ReactNode}){
 return <select {...props} aria-invalid={error||undefined} className={`nisSelect ${className}`.trim()}>{children}</select>
}

export function BuyerTextarea({className='',error,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&{error?:boolean}){
 return <textarea {...props} aria-invalid={error||undefined} className={`nisTextarea ${className}`.trim()}/>
}

export function BuyerAlert({children,tone='warning'}:{children:ReactNode;tone?:'success'|'warning'|'error'|'info'}){
 const Icon=tone==='success'?CheckCircle2:tone==='error'?AlertCircle:tone==='info'?Info:TriangleAlert
 return <div className={`nisAlert ${tone}`} role={tone==='error'?'alert':'status'}><Icon size={18}/><div>{children}</div></div>
}

export function BuyerSkeleton({kind='text',className=''}:{kind?:'text'|'title'|'media'|'button';className?:string}){
 return <div className={`nisSkeleton ${kind} ${className}`.trim()} aria-hidden="true"/>
}

export function BuyerEmptyState({icon,eyebrow,title,description,primary,secondary}:{icon?:ReactNode;eyebrow?:string;title:string;description:string;primary?:{label:string;href:string};secondary?:{label:string;href:string}}){
 return <section className="nisState">{icon&&<div className="nisStateIcon">{icon}</div>}{eyebrow&&<span className="nisEyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p>{(primary||secondary)&&<div className="nisStateActions">{primary&&<BuyerButton href={primary.href}>{primary.label}</BuyerButton>}{secondary&&<BuyerButton href={secondary.href} variant="outline">{secondary.label}</BuyerButton>}</div>}</section>
}
