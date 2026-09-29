'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../../lib/supabase';
import {canAdmin,type AdminAccess} from '../../../lib/adminAccess';
import {indiaDate,financialYearStart,validateLines,paise,csvCell,ledgerGroups,type EntryLine} from '../../../lib/accounting-workspace';
import '../../accounting-workspace.css';
type Account={id:string;code:string;name:string;account_group:string;ledger_group:string|null;is_active:boolean};
type Balance={code:string;account_name:string;account_group:string;ledger_group:string|null;opening:number;debit:number;credit:number;closing:number};
const blank=():EntryLine=>({account_code:'',debit:'',credit:'',line_note:''});
const money=(v:number|string)=>Number(v||0).toLocaleString('en-IN',{style:'currency',currency:'INR'});
const signed=(v:number|string)=>`${money(Math.abs(Number(v)))} ${Number(v)<0?'Cr':'Dr'}`;
async function allRows(makeQuery:()=>any){
 const rows:any[]=[];
 for(let offset=0;offset<100000;offset+=500){const result=await makeQuery().range(offset,offset+499);if(result.error)throw result.error;rows.push(...(result.data||[]));if((result.data||[]).length<500)return {data:rows,error:null};}
 throw new Error('Too many ledgers to load. Narrow the accounting scope.');
}
const types=['receipt','payment','contra','journal','sales','purchase','credit_note','debit_note'];
const title=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function Accounting(){
 const [access,setAccess]=useState<AdminAccess|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[balances,setBalances]=useState<Balance[]>([]),[entries,setEntries]=useState<any[]>([]);
 const [from,setFrom]=useState(financialYearStart()),[to,setTo]=useState(indiaDate()),[period,setPeriod]=useState({from:financialYearStart(),to:indiaDate()}),[tab,setTab]=useState('daybook'),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(0),[count,setCount]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[help,setHelp]=useState(false),[detail,setDetail]=useState<any>(null);
 const [editor,setEditor]=useState(false),[ledgerOpen,setLedgerOpen]=useState(false),[ledger,setLedger]=useState({code:'',name:'',group:'Indirect Expenses'});
 const [form,setForm]=useState({type:'journal',date:indiaDate(),reference:'',narration:'',lines:[blank(),blank()]}),[quick,setQuick]=useState(false),[quickEntry,setQuickEntry]=useState({debit:'',credit:'',amount:''});
 const requestId=useRef(''),posting=useRef(false),version=useRef(0),searchRef=useRef<HTMLInputElement>(null),dateRef=useRef<HTMLInputElement>(null);
 const allowed=(action:'view'|'create'|'export')=>canAdmin(access,'accounting',action);
 const load=useCallback(async()=>{
  const current=++version.current;setLoading(true);setError('');
  try{
   const permission=await supabase.rpc('get_my_admin_access');if(permission.error)throw permission.error;
   const a=permission.data as AdminAccess;setAccess(a);if(!canAdmin(a,'accounting','view'))throw new Error('Your role does not have accounting access.');
   let query=supabase.from('accounting_entries').select('*,accounting_lines(*,accounting_accounts(code,name,account_group))',{count:'exact'}).gte('voucher_date',period.from).lte('voucher_date',period.to).order('voucher_date',{ascending:false}).order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);
   if(kind)query=query.eq('voucher_type',kind);
   const [ledgers,report,register]=await Promise.all([allRows(()=>supabase.from('accounting_accounts').select('id,code,name,account_group,ledger_group,is_active').order('code')),allRows(()=>supabase.rpc('accounting_workspace_balances',{p_from:period.from,p_to:period.to})),query]);
   if(ledgers.error||report.error||register.error)throw ledgers.error||report.error||register.error;
   if(current!==version.current)return;
   setAccounts(ledgers.data||[]);setBalances(report.data||[]);setEntries(register.data||[]);setCount(register.count||0);
  }catch(e:any){if(current===version.current){setError(e.message||'Unable to load accounting.');setEntries([]);setBalances([]);}}
  finally{if(current===version.current)setLoading(false);}
 },[period,page,kind]);
 useEffect(()=>{void load();return()=>{version.current++;};},[load]);
 function openEntry(type='journal'){
  if(!allowed('create'))return;
  if(editor){setError('Finish or close the current voucher before opening another.');return;}
  requestId.current=crypto.randomUUID();setForm({type,date:indiaDate(),reference:'',narration:'',lines:[blank(),blank()]});setQuick(['receipt','payment','contra'].includes(type));setQuickEntry({debit:type==='receipt'?'1010':'',credit:type==='payment'?'1010':'',amount:''});setError('');setNotice('');setEditor(true);
 }
 function closeEntry(){if(posting.current)return;if((form.narration||form.reference||quickEntry.amount||form.lines.some(l=>l.debit||l.credit||l.account_code))&&!window.confirm('Discard this unsaved voucher?'))return;setEditor(false);}
 async function post(){
  if(posting.current||!allowed('create'))return;setError('');
  let lines=form.lines;
  try{
   if(!form.narration.trim())throw new Error('Enter a narration.');
   if(!form.date||form.date>indiaDate())throw new Error('Choose a date on or before today.');
   if(quick){const amount=paise(quickEntry.amount)/100;if(amount<=0||quickEntry.debit===quickEntry.credit)throw new Error('Choose two different ledgers and a positive amount.');lines=[{...blank(),account_code:quickEntry.debit,debit:String(amount)},{...blank(),account_code:quickEntry.credit,credit:String(amount)}];}
   validateLines(lines);posting.current=true;setBusy(true);
   const {error}=await supabase.rpc('accounting_post_manual',{p_request_id:requestId.current,p_type:form.type,p_date:form.date,p_reference:form.reference||null,p_narration:form.narration,p_lines:lines.map(l=>({...l,debit:Number(l.debit||0),credit:Number(l.credit||0)}))});
   if(error)throw error;setEditor(false);setNotice('Voucher posted. Books updated.');await load();
  }catch(e:any){setError(e.message||'Unable to post. Your entry is retained; retry uses the same request ID.');}
  finally{posting.current=false;setBusy(false);}
 }
 async function createLedger(){
  if(posting.current||!allowed('create'))return;posting.current=true;setBusy(true);setError('');
  try{const {error}=await supabase.rpc('accounting_create_ledger',{p_code:ledger.code.trim(),p_name:ledger.name.trim(),p_group:ledger.group});if(error)throw error;setLedgerOpen(false);setLedger({code:'',name:'',group:'Indirect Expenses'});await load();setNotice('Ledger created. Use a balanced journal for opening balances.');}catch(e:any){setError(e.message);}finally{posting.current=false;setBusy(false);}
 }
 useEffect(()=>{
  const handler=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.repeat||event.isComposing)return;
   if(event.key==='Tab'&&(editor||ledgerOpen||help||detail)){
    const dialogs=document.querySelectorAll('[role="dialog"]');const dialog=dialogs[dialogs.length-1];const controls=dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]');
    if(controls?.length){const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
   }
   if(event.key==='Escape'){if(ledgerOpen&&!busy)setLedgerOpen(false);else if(detail)setDetail(null);else if(help)setHelp(false);else if(editor)closeEntry();return;}
   if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&editor&&!ledgerOpen){event.preventDefault();void post();return;}
   const input=(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]');
   if(input||editor||ledgerOpen||event.ctrlKey||event.metaKey||event.altKey||(event.shiftKey&&event.key!=='?'))return;
   const map:Record<string,string>={F4:'contra',F5:'payment',F6:'receipt',F7:'journal',F8:'sales',F9:'purchase'};
   if(map[event.key]){event.preventDefault();openEntry(map[event.key]);}
   if(event.key==='F2'){event.preventDefault();dateRef.current?.focus();}
   if(event.key==='/'){event.preventDefault();searchRef.current?.focus();}
   if(event.key==='?')setHelp(true);
  };
  window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 });
 function exportRows(){
  if(!allowed('export'))return;
  const rows=tab==='daybook'?[['Date','Voucher','Type','Reference','Narration','Ledger','Debit','Credit'],...entries.flatMap(e=>(e.accounting_lines||[]).map((l:any)=>[e.voucher_date,e.entry_number,e.voucher_type,e.reference_number,e.narration,l.accounting_accounts?.name,l.debit,l.credit]))]:[['Code','Ledger','Group','Opening Dr-Cr','Period debit','Period credit','Closing Dr-Cr'],...balances.map(r=>[r.code,r.account_name,r.ledger_group||r.account_group,r.opening,r.debit,r.credit,r.closing])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`accounts-${period.from}-${period.to}-${tab==='daybook'?`page-${page+1}`:'balances'}.csv`;a.click();URL.revokeObjectURL(url);
 }
 const filtered=balances.filter(r=>`${r.code} ${r.account_name} ${r.ledger_group||r.account_group}`.toLowerCase().includes(search.toLowerCase()));
 const total=(group:string,closing=false)=>balances.filter(r=>r.account_group===group).reduce((sum,r)=>sum+(closing?Number(r.closing):Number(r.debit)-Number(r.credit)),0);
 const income=-total('income'),expense=total('expense'),assets=total('asset',true),liabilities=-total('liability',true),equity=-total('equity',true),retained=-total('income',true)-total('expense',true);
 const debit=balances.reduce((s,r)=>s+Number(r.debit),0),credit=balances.reduce((s,r)=>s+Number(r.credit),0);
 const options=accounts.filter(a=>a.is_active).map(a=><option key={a.id} value={a.code}>{a.code} · {a.name}</option>);
 return <div className="accountingV2 accountsWorkspace">
  <div className="acctHero"><div><span className="adminEyebrow">NEW INDIA · ACCOUNTS</span><h1>Accounting workspace</h1><p>Fast voucher entry, ledger groups and books with opening, movement and closing balances.</p></div><div className="acctHeroActions"><button className="adminBtn ghost" onClick={()=>setHelp(true)}>Keyboard help</button><button className="adminBtn ghost" disabled={loading} onClick={()=>void load()}>Refresh</button><button className="adminBtn" disabled={!allowed('create')||loading} onClick={()=>openEntry()}>New voucher</button></div></div>
  <nav className="acctQuickNav" aria-label="Connected operations"><Link href="/admin/finance">Invoices & customer payments</Link><Link href="/admin/purchasing">Suppliers & purchases</Link><Link href="/admin/inventory">Stock & inventory</Link><Link href="/admin/manufacturing">Manufacturing</Link><span>Ctrl / ⌘ K · Find an admin page</span></nav>
  {error&&<div role="alert" className="acctMessage danger">{error}</div>}{notice&&<div role="status" className="acctMessage">{notice}</div>}
  <div className="acctStats">{[['Assets at closing',assets],['Liabilities at closing',liabilities],['Period income',income],['Period expenses',expense],['Period profit / loss',income-expense]].map(([label,value])=><div key={label}><span>{label}</span><b>{loading?'…':money(value)}</b></div>)}</div>
  <div className="acctToolbar"><label>From<input ref={dateRef} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="adminBtn ghost" onClick={()=>{if(!from||!to||from>to){setError('Choose a valid date range.');return;}setPage(0);setPeriod({from,to});}}>Apply dates</button><button className="adminBtn ghost" disabled={loading||!!error||!allowed('export')} onClick={exportRows}>{tab==='daybook'?'Export this page':'Export balances'}</button><small>Showing {period.from} to {period.to}</small></div>
  <div className="acctTabs" role="tablist">{[['daybook','Day book'],['ledgers','Ledgers'],['trial','Trial balance'],['profit','Profit & loss'],['balance','Balance sheet']].map(([key,label])=><button role="tab" aria-selected={tab===key} key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setSearch('');}}>{label}</button>)}</div>
  {tab==='daybook'?<section className="acctPanel"><div className="acctPanelHead"><div><h2>Voucher register</h2><p>{count} vouchers · 50 per page</p></div><label>Voucher type<select value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="">All types</option>{types.map(t=><option key={t} value={t}>{title(t)}</option>)}</select></label></div><div className="acctTableWrap"><table className="acctTable"><thead><tr><th>Date</th><th>Voucher</th><th>Reference</th><th>Narration</th><th>Amount</th><th>Status</th></tr></thead><tbody>{entries.map(e=><tr key={e.id}><td>{e.voucher_date}</td><td><button className="acctTextButton" onClick={()=>setDetail(e)}>{e.entry_number}</button><small>{title(e.voucher_type)}</small></td><td>{e.reference_number||'—'}</td><td>{e.narration}</td><td>{money(e.total_debit)}</td><td>{e.status}</td></tr>)}</tbody></table>{!loading&&!entries.length&&<p className="acctEmpty">No vouchers in the selected period.</p>}</div><div className="acctToolbar"><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(count/50))}</span><button disabled={(page+1)*50>=count||loading} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>:null}
  {(tab==='ledgers'||tab==='trial')&&<section className="acctPanel"><div className="acctPanelHead"><div><h2>{tab==='ledgers'?'Chart of accounts':'Trial balance'}</h2><p>Opening includes posted activity before the selected period. Closing includes all activity through the end date.</p></div>{tab==='ledgers'&&<button className="adminBtn" disabled={!allowed('create')} onClick={()=>setLedgerOpen(true)}>Create ledger</button>}</div><div className="acctToolbar"><input ref={searchRef} aria-label="Search ledgers" placeholder="Search ledger or group /" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="acctTableWrap"><table className="acctTable"><thead><tr><th>Ledger</th><th>Group</th><th>Opening</th><th>Debit</th><th>Credit</th><th>Closing</th></tr></thead><tbody>{filtered.map(r=><tr key={r.code}><td><b>{r.account_name}</b><small>{r.code}</small></td><td>{r.ledger_group||title(r.account_group)}</td><td>{signed(r.opening)}</td><td>{money(r.debit)}</td><td>{money(r.credit)}</td><td>{signed(r.closing)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>All ledgers · period totals</th><th>{money(debit)}</th><th>{money(credit)}</th><th>Difference {money(debit-credit)}</th></tr></tfoot></table></div></section>}
  {tab==='profit'&&<div className="acctReportGrid">{['income','expense'].map(g=><section className="acctReportBlock" key={g}><h2>{title(g)}</h2>{balances.filter(r=>r.account_group===g).map(r=><div className="acctReportLine" key={r.code}><span>{r.account_name}</span><b>{money((Number(r.debit)-Number(r.credit))*(g==='income'?-1:1))}</b></div>)}</section>)}<section className="acctReportBlock"><h2>Net profit / loss</h2><b>{money(income-expense)}</b><p>Period movements only; opening balances are excluded.</p></section></div>}
  {tab==='balance'&&<div className="acctReportGrid">{['asset','liability','equity'].map(g=><section className="acctReportBlock" key={g}><h2>{title(g)}</h2>{balances.filter(r=>r.account_group===g).map(r=><div className="acctReportLine" key={r.code}><span>{r.account_name}</span><b>{money(Number(r.closing)*(g==='asset'?1:-1))}</b></div>)}</section>)}<section className="acctReportBlock"><h2>Closing balance check</h2><p>Accumulated income less expenses: {money(retained)}</p><p>Assets: {money(assets)}</p><p>Liabilities + equity + accumulated result: {money(liabilities+equity+retained)}</p><b>Difference: {money(assets-liabilities-equity-retained)}</b></section></div>}
  {editor&&<div className="acctModalBackdrop"><section role="dialog" aria-modal="true" aria-label="Accounting voucher" className="acctModal"><button className="close" aria-label="Close voucher" disabled={busy} onClick={closeEntry}>×</button><h2>{title(form.type)} voucher</h2><p>Posts to accounting books. For stock receipts or customer payment allocation, use the connected purchase or finance page.</p>{error&&<p role="alert" className="acctMessage danger">{error}</p>}<fieldset disabled={busy}><div className="acctFormGrid"><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{types.map(t=><option value={t} key={t}>{title(t)}</option>)}</select></label><label>Date<input type="date" max={indiaDate()} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Reference<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label><label>Narration<input autoFocus required value={form.narration} onChange={e=>setForm({...form,narration:e.target.value})}/></label></div><label className="acctMode"><input type="checkbox" checked={quick} onChange={e=>setQuick(e.target.checked)}/>Simple two-ledger entry</label>{quick?<div className="acctFormGrid"><label>Debit ledger<select value={quickEntry.debit} onChange={e=>setQuickEntry({...quickEntry,debit:e.target.value})}><option value="">Choose ledger</option>{options}</select></label><label>Credit ledger<select value={quickEntry.credit} onChange={e=>setQuickEntry({...quickEntry,credit:e.target.value})}><option value="">Choose ledger</option>{options}</select></label><label>Amount<input inputMode="decimal" value={quickEntry.amount} onChange={e=>setQuickEntry({...quickEntry,amount:e.target.value})}/></label><p>Receipt: debit bank/cash. Payment: credit bank/cash. Contra: debit destination, credit source.</p></div>:<div className="acctLines"><div className="acctLine"><b>Ledger</b><b>Debit</b><b>Credit</b><span/></div>{form.lines.map((line,i)=><div className="acctLine" key={i}><select aria-label={`Ledger ${i+1}`} value={line.account_code} onChange={e=>setForm({...form,lines:form.lines.map((l,n)=>n===i?{...l,account_code:e.target.value}:l)})}><option value="">Choose ledger</option>{options}</select>{(['debit','credit'] as const).map(side=><input key={side} aria-label={`${side} ${i+1}`} inputMode="decimal" value={line[side]} onChange={e=>setForm({...form,lines:form.lines.map((l,n)=>n===i?{...l,[side]:e.target.value,[side==='debit'?'credit':'debit']:''}:l)})}/>)}<button aria-label={`Remove line ${i+1}`} disabled={form.lines.length<=2} onClick={()=>setForm({...form,lines:form.lines.filter((_,n)=>n!==i)})}>×</button></div>)}<button onClick={()=>setForm({...form,lines:[...form.lines,blank()]})}>+ Add line</button><p>Debit {money(form.lines.reduce((s,l)=>s+(Number(l.debit)||0),0))} · Credit {money(form.lines.reduce((s,l)=>s+(Number(l.credit)||0),0))}</p></div>}<div className="acctModalActions"><button className="adminBtn ghost" onClick={()=>setLedgerOpen(true)}>Create ledger</button><button className="adminBtn" onClick={()=>void post()}>{busy?'Posting…':'Post voucher · Ctrl / ⌘ Enter'}</button></div></fieldset></section></div>}
  {ledgerOpen&&<div className="acctModalBackdrop ledgerOverlay"><section role="dialog" aria-modal="true" aria-label="Create ledger" className="acctModal"><button className="close" aria-label="Close ledger" disabled={busy} onClick={()=>setLedgerOpen(false)}>×</button><h2>Create ledger</h2>{error&&<p role="alert">{error}</p>}<fieldset disabled={busy}><div className="acctFormGrid"><label>Unique code<input autoFocus maxLength={30} value={ledger.code} onChange={e=>setLedger({...ledger,code:e.target.value})}/></label><label>Ledger name<input maxLength={150} value={ledger.name} onChange={e=>setLedger({...ledger,name:e.target.value})}/></label><label>Group<select value={ledger.group} onChange={e=>setLedger({...ledger,group:e.target.value})}>{Object.keys(ledgerGroups).map(g=><option key={g}>{g}</option>)}</select></label></div><p>New ledgers start at zero. Opening balances must be entered as a balanced journal.</p><button className="adminBtn" onClick={()=>void createLedger()}>Save ledger</button></fieldset></section></div>}
  {detail&&<div className="acctModalBackdrop"><section role="dialog" aria-modal="true" aria-label="Voucher details" className="acctModal"><button className="close" aria-label="Close details" onClick={()=>setDetail(null)}>×</button><h2>{detail.entry_number}</h2><p>{detail.voucher_date} · {title(detail.voucher_type)} · {detail.status}</p><p>{detail.narration}</p><table className="acctTable"><thead><tr><th>Ledger</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{detail.accounting_lines?.map((l:any)=><tr key={l.id}><td>{l.accounting_accounts?.name}</td><td>{money(l.debit)}</td><td>{money(l.credit)}</td></tr>)}</tbody></table><p>Posted entries are preserved for audit. Enter a correcting journal to adjust an error.</p></section></div>}
  {help&&<div className="acctModalBackdrop"><section role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="acctModal"><button className="close" aria-label="Close help" onClick={()=>setHelp(false)}>×</button><h2>Keyboard shortcuts</h2><dl>{[['Ctrl / ⌘ K','Find any permitted admin page'],['F2','Focus period start'],['F4','Contra'],['F5','Payment'],['F6','Receipt'],['F7','Journal'],['F8','Sales accounting entry'],['F9','Purchase accounting entry'],['Ctrl / ⌘ Enter','Post current voucher'],['Tab / Shift Tab','Next / previous input'],['Escape','Close dialog'],['/','Focus ledger search']].map(([key,label])=><div className="acctReportLine" key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>)}</dl><p>Function shortcuts work outside input fields. On Mac, use Fn with function keys. Browser or operating-system shortcuts may take priority.</p></section></div>}
 </div>;
}
