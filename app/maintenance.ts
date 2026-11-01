// Calendar dates are compared in the owner's Ukrainian service timezone.
export function serviceReminder(car:{mileage:number;nextService:number;nextServiceDate?:string},date=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 const km=car.nextService>0?car.nextService-car.mileage:null;
 const dueDate=car.nextServiceDate||'';
 const overdue=(km!==null&&km<=0)||Boolean(dueDate&&dueDate<=today);
 if(km===null&&!dueDate)return {due:false,text:'Наступне ТО ще не заплановано'};
 return {due:overdue,text:[overdue?'ТО вже на часі':'Наступне ТО',km===null?'':km<=0?'Пробіг ТО досягнуто':`через ${km.toLocaleString('uk-UA')} км`,dueDate?`до ${dueDate.split('-').reverse().join('.')}`:''].filter(Boolean).join(' · ')};
}
