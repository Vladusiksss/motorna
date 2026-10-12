export type Catalog = {vehicle:{name:string;year:number;vin?:string;engine?:string;mileage:number};history:{date:string;title:string;amount:number;mileage:number}[];documents:{id:string;name:string;size:number}[];created:number};
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function exportCatalog(data:Catalog,format:'xlsx'|'pdf'){
 const name='MOTORNA-'+data.vehicle.name.replace(/[^\p{L}\p{N}-]/gu,'_');
 const details=[['Автомобіль',data.vehicle.name],['Рік',data.vehicle.year],['VIN',data.vehicle.vin||'—'],['Двигун',data.vehicle.engine||'—'],['Пробіг, км',data.vehicle.mileage]];
 const history=data.history.map(e=>[e.date,e.title,e.mileage,e.amount]);
 if(format==='xlsx'){
  const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();book.creator='MOTORNA';book.created=new Date();
  for(const [title,rows] of [['Автомобіль',[['Характеристика','Значення'],...details]],['Історія',[['Дата','Обслуговування','Пробіг, км','Сума, грн'],...history]],['Чеки',[['Назва файлу','Розмір, КБ'],...data.documents.map(d=>[d.name,Math.ceil(d.size/1024)])]]] as [string,(string|number)[][]][]){
   const sheet=book.addWorksheet(title);sheet.addRows(rows);sheet.views=[{state:'frozen',ySplit:1}];sheet.columns.forEach((c,i)=>c.width=i===1?55:24);sheet.getRow(1).height=30;
   sheet.eachRow((row,index)=>{row.height=28;row.eachCell(cell=>{cell.font={name:'Calibri',size:11,color:{argb:index===1?'FFFFFFFF':'FF173653'},bold:index===1};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index===1?'FF0F4C81':index%2?'FFF0F5FA':'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};});});
   if(title==='Історія'){sheet.getColumn(4).numFmt='#,##0.00';sheet.addRow(['Разом','','',data.history.reduce((s,e)=>s+e.amount,0)]);}
  }
  download(new Blob([await book.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name+'.xlsx');
 }else{
  const [{default:pdfMake},{default:fonts}]=await Promise.all([import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);pdfMake.addVirtualFileSystem(fonts);
  const table=(rows:(string|number)[][],widths:(string|number)[])=>({table:{headerRows:1,widths,body:rows.map((r,i)=>r.map(v=>({text:String(v),fillColor:i===0?'#0F4C81':i%2?'#F0F5FA':'#FFFFFF',color:i===0?'#FFFFFF':'#173653',bold:i===0,margin:[4,6,4,6]})))},layout:'noBorders',margin:[0,8,0,18]});
  await pdfMake.createPdf({info:{title:'Каталог '+data.vehicle.name,author:'MOTORNA'},pageMargins:[36,40,36,40],defaultStyle:{font:'Roboto',fontSize:10,color:'#173653'},content:[{text:'МОТОРНА',fontSize:25,bold:true,color:'#0F4C81'},{text:'Історія автомобіля',fontSize:17,margin:[0,6,0,16]},table([['Характеристика','Значення'],...details],['35%','65%']),{text:'Обслуговування',fontSize:15,bold:true},table([['Дата','Роботи','Пробіг, км','Сума, грн'],...(history.length?history:[['—','Записів ще немає','—','—']])],[65,'*',65,65]),{text:'Разом: '+data.history.reduce((s,e)=>s+e.amount,0).toLocaleString('uk-UA')+' грн',bold:true},{text:'Реєстр чеків',fontSize:15,bold:true,margin:[0,20,0,8]},...data.documents.map(d=>({text:d.name,margin:[0,0,0,6]})),{text:data.documents.length?'Оригінали чеків завантажуються окремо з каталогу.':'Чеки не додано.',color:'#62788B'},{text:'Сформовано '+new Date().toLocaleDateString('uk-UA'),margin:[0,20,0,0],color:'#62788B'}],footer:(page:number,pages:number)=>({text:`MOTORNA · ${page} / ${pages}`,alignment:'center',fontSize:8})} as Parameters<typeof pdfMake.createPdf>[0]).download(name+'.pdf');
 }
}
