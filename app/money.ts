export const currencyScale={UAH:2,EUR:2,USD:2,GBP:2} as const;
export type Currency=keyof typeof currencyScale;
export type Money={amountMinor:number;currency:Currency};
export function isCurrency(value:unknown):value is Currency{return typeof value==='string'&&Object.hasOwn(currencyScale,value);}
// Decimal parsing avoids multiplying a binary floating-point amount by 100.
// More than two decimal places require an explicit business decision, never silent rounding.
export function toMinor(value:number|string,currency:Currency):number{
 if(!isCurrency(currency))throw new Error('Unsupported currency');
 if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw new Error('Invalid amount');
 const text=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('Amount requires explicit rounding or correction');
 const [whole,fraction='']=text.split('.');const minor=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Amount exceeds safe integer range');
 return Number(minor);
}
export function validateMoney(money:Money):Money{
 if(!isCurrency(money.currency)||!Number.isSafeInteger(money.amountMinor)||money.amountMinor<0)throw new Error('Invalid minor-unit money');
 return money;
}
export function addMoney(left:Money,right:Money):Money{
 validateMoney(left);validateMoney(right);if(left.currency!==right.currency)throw new Error('Currency mismatch');
 return validateMoney({amountMinor:left.amountMinor+right.amountMinor,currency:left.currency});
}
