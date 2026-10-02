"use client";
import {useState} from 'react';
import {Search,CarFront,MapPin,Heart,UserRound,Wrench,Menu} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';

const items=[
 {id:'parts',label:'Пошук запчастин',short:'Пошук',icon:Search},
 {id:'garage',label:'Мій гараж',short:'Гараж',icon:CarFront},
 {id:'service',label:'СТО поруч',short:'СТО',icon:MapPin},
 {id:'favorites',label:'Обране',short:'Обране',icon:Heart},
 {id:'profile',label:'Історія та профіль',short:'Профіль',icon:UserRound},
];
export default function WorkspaceNavigation({section,navigate,name}:{section:string;navigate:(s:string)=>void;name?:string}){
 const [open,setOpen]=useState(false);
 function go(id:string){setOpen(false);navigate(id);}
 function navigation(){return <nav aria-label="Розділи простору">{items.map(({id,label,icon:Icon})=><button key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} onClick={()=>go(id)}><Icon size={20}/>{label}</button>)}</nav>;}
 return <>
  <header className="topbar refreshed-header">
   <button className="menu-toggle icon-btn" onClick={()=>setOpen(true)} aria-label="Відкрити меню" aria-expanded={open}><Menu size={22}/></button>
   <a className="brand" href="/" onClick={e=>{e.preventDefault();go('parts');}}>моторна<span>.</span></a>
   <nav aria-label="Головна навігація">{[['parts','Запчастини'],['garage','Мій гараж'],['service','СТО та ремонт']].map(([id,label])=><a key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} href={id==='parts'?'/':'/'+id} onClick={e=>{e.preventDefault();go(id);}}>{label}</a>)}</nav>
   <div className="header-actions"><button className={'icon-btn '+(section==='favorites'?'selected':'')} aria-label="Обране" onClick={()=>go('favorites')}><Heart size={20}/></button><button className="avatar" aria-label="Профіль" onClick={()=>go('profile')}><UserRound size={19}/></button></div>
  </header>
  <aside className="desktop-sidebar"><div className="sidebar-account"><UserRound size={24}/><strong>{name||'Ваш автопростір'}</strong><small>Уся Україна</small></div>{navigation()}<div className="sidebar-tip"><Wrench size={24}/><strong>Догляд без зайвих турбот</strong><p>Зберігайте авто, чеки та історію обслуговування в одному місці.</p><button onClick={()=>go('garage')}>До гаража →</button></div></aside>
  <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="workspace-mobile-menu"><SheetTitle>Ваш автопростір</SheetTitle><SheetDescription>Уся Україна</SheetDescription>{navigation()}</SheetContent></Sheet>
  <nav className="mobile-dock" aria-label="Мобільна навігація">{items.map(({id,short,icon:Icon})=><button key={id} aria-current={section===id?'page':undefined} onClick={()=>go(id)}><Icon size={21} strokeWidth={section===id?2.5:1.8}/><span>{short}</span></button>)}</nav>
 </>;
}
