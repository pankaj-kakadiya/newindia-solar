export function indiaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function financialYearStart(date = indiaDate()) {
  const year=Number(date.slice(0,4)); return `${Number(date.slice(5,7))<4?year-1:year}-04-01`;
}
export function paise(value: string | number): number {
  const text=String(value).trim();
  if(!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction='']=text.split('.'); const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(result)) throw new Error('Amount is too large.');
  return result;
}
export type EntryLine={account_code:string;debit:string;credit:string;line_note:string};
export function validateLines(lines:EntryLine[]) {
  if(lines.length<2) throw new Error('Choose at least two ledger lines.');
  let debit=0,credit=0;
  for(const line of lines){
    if(!line.account_code) throw new Error('Choose a ledger for every line.');
    const d=paise(line.debit||'0'),c=paise(line.credit||'0');
    if((d>0)===(c>0)) throw new Error('Each line needs an amount on exactly one side.');
    debit+=d;credit+=c;
  }
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)) throw new Error('Total is too large.');
  if(debit!==credit) throw new Error('Debit and credit must match exactly.');
  return {debit:debit/100,credit:credit/100};
}
export function csvCell(value:unknown){
  let text=String(value??''); if(/^[\s]*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export const ledgerGroups: Record<string,string>={
  'Cash in Hand':'asset','Bank Accounts':'asset','Sundry Debtors':'asset','Stock in Hand':'asset','Fixed Assets':'asset','Investments':'asset','Deposits':'asset','Loans and Advances':'asset','Input Taxes':'asset','Current Assets':'asset',
  'Sundry Creditors':'liability','Duties and Taxes':'liability','Secured Loans':'liability','Unsecured Loans':'liability','Bank Overdraft':'liability','Provisions':'liability','Current Liabilities':'liability',
  'Capital Account':'equity','Reserves and Surplus':'equity',
  'Sales Accounts':'income','Direct Income':'income','Indirect Income':'income',
  'Purchase Accounts':'expense','Direct Expenses':'expense','Indirect Expenses':'expense',
};
