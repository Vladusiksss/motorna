"use client";
import {useId,useRef,useState,type PointerEvent} from 'react';
import {vehicleAppearance} from './vehicle-appearance';
type Point=[number,number,number];
type Face={points:Point[];fill:string};
export default function VehicleModel({fields=[],name,onSelect}:{fields?:{label:string;value:string}[];name?:string;onSelect:(i:number)=>void}){
 const a=vehicleAppearance(fields),id=useId().replace(/:/g,''),[angle,setAngle]=useState(28),[selected,setSelected]=useState(0);
 const drag=useRef<{id:number;x:number;y:number;angle:number;width:number;active:boolean}|null>(null);
 const suppressClick=useRef(false),[dragging,setDragging]=useState(false);
 function startDrag(e:PointerEvent<SVGSVGElement>){
  if(!e.isPrimary||e.button!==0)return;
  suppressClick.current=false;
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,angle,width:e.currentTarget.getBoundingClientRect().width,active:false};
 }
 function moveDrag(e:PointerEvent<SVGSVGElement>){
  const d=drag.current;if(!d||d.id!==e.pointerId)return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(!d.active){
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
   if(Math.abs(dy)>Math.abs(dx)){drag.current=null;return;}
   d.active=true;suppressClick.current=true;setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);
  }
  setAngle(Math.max(-180,Math.min(180,d.angle+dx/Math.max(d.width,1)*240)));
 }
 function endDrag(e:PointerEvent<SVGSVGElement>){
  if(drag.current?.id!==e.pointerId)return;
  drag.current=null;setDragging(false);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 const tall=['suv','van','wagon'].includes(a.body),van=a.body==='van',pickup=a.body==='pickup';
 const roof=tall?1.95:a.body==='hatch'?1.75:1.58,back=van?1.8:tall?1.55:a.body==='hatch'?1.6:a.body==='coupe'?.8:1.05,front=van?-1.25:-.8;
 const yaw=angle*Math.PI/180;
 function project([x,y,z]:Point){return [300+(x*Math.cos(yaw)+z*Math.sin(yaw))*94,244-y*94+(z*Math.cos(yaw)-x*Math.sin(yaw))*30];}
 const faces:Face[]=[];
 function face(points:Point[],fill:string){faces.push({points,fill});}
 function prism(profile:[number,number][],width:number,fill:string){
  for(const z of [-width,width])face(profile.map(([x,y])=>[x,y,z]),fill);
  profile.forEach(([x,y],i)=>{const n=profile[(i+1)%profile.length];face([[x,y,-width],[n[0],n[1],-width],[n[0],n[1],width],[x,y,width]],fill);});
 }
 prism([[-2.35,.57],[-2.38,.92],[-1.85,1.14],[1.95,1.14],[2.25,.95],[2.25,.57]],.88,`url(#paint-${id})`);
 if(a.body!=='convertible'){
 prism([[-1.42,1.15],[front,roof],[pickup?.25:back-.35,roof],[pickup?.65:back+.45,1.15]],.77,`url(#paint-${id})`);
 // Glazing sits on each side of the cabin; coordinates follow the selected body.
 for(const z of [-.782,.782]){
 face([[-1.28,1.19],[front+.08,roof-.08],[-.03,roof-.08],[-.03,1.19]].map(([x,y])=>[x,y,z]),'#263d50');
 if(!pickup)face([[.07,1.19],[.07,roof-.08],[back-.42,roof-.08],[back+.25,1.19]].map(([x,y])=>[x,y,z]),'#304a5e');
 }
 face([[-1.43,1.17,-.69],[front-.02,roof-.02,-.69],[front-.02,roof-.02,.69],[-1.43,1.17,.69]],'#3c596d');
 }else{prism([[-1.35,1.15],[-.95,1.62],[-.88,1.62],[-1.25,1.15]],.75,'#304a5e');face([[-.8,1.16,-.65],[1.1,1.16,-.65],[1.1,1.16,.65],[-.8,1.16,.65]],'#263442');}
 if(pickup)face([[.7,1.15,-.7],[2,1.15,-.7],[2,1.15,.7],[.7,1.15,.7]],'#303944');
 // Four wheel cylinders, with brake discs and alloy spokes on the outer faces.
 for(const x of [-1.5,1.48])for(const side of [-1,1]){
 const z=side*.92,r=tall?.43:.39;
 const ring=(depth:number,radius:number):Point[]=>Array.from({length:20},(_,i)=>[x+Math.cos(i*Math.PI/10)*radius,.48+Math.sin(i*Math.PI/10)*radius,depth]);
 const inner=ring(z-side*.15,r),outer=ring(z+side*.13,r);
 face(outer,'#202831');outer.forEach((p,i)=>face([p,outer[(i+1)%20],inner[(i+1)%20],inner[i]],'#151d26'));
 face(ring(z+side*.14,r*.69),'#82929f');face(ring(z+side*.15,r*.47),'#344453');
 for(let i=0;i<5;i++){const t=i*Math.PI*2/5;face([[x,.48,z+side*.16],[x+Math.cos(t)*r*.65,.48+Math.sin(t)*r*.65,z+side*.16],[x+Math.cos(t+.25)*r*.65,.48+Math.sin(t+.25)*r*.65,z+side*.16]],'#e1e7ed');}
 }
 for(const z of [-.62,.62])face([[-2.395,.84,z-.17],[-2.395,1,z-.17],[-2.395,1,z+.17],[-2.395,.84,z+.17]],'#eaf7ff');
 face([[-2.4,.62,-.35],[-2.4,.85,-.35],[-2.4,.85,.35],[-2.4,.62,.35]],'#1e2b36');
 const depth=(f:Face)=>f.points.reduce((v,[x,y,z])=>v+z*Math.cos(yaw)-x*Math.sin(yaw)+y*.32,0)/f.points.length;
 faces.sort((a,b)=>depth(a)-depth(b));
 const nodes=[{n:1,title:'Гальма',detail:'Гальмівний диск і колодки — всередині колеса.',point:[-1.5,.48,1.08] as Point,group:0},{n:2,title:'Передня підвіска',detail:'Амортизатор і важелі — за переднім колесом, між колесом та кузовом.',point:[-1.5,1.14,.8] as Point,group:2},{n:3,title:'Задня підвіска',detail:'Вузли підвіски — біля задньої осі, за колесом.',point:[1.48,1.14,.8] as Point,group:2}];
 return <section className="vehicle-model" aria-label="3D-модель автомобіля"><div className="model-caption"><strong>{name||'Ваш автомобіль'}</strong><span>{a.bodyLabel} · {a.colorLabel}</span></div><svg className={dragging?'model-touch dragging':'model-touch'} style={{touchAction:'pan-y pinch-zoom',userSelect:'none',cursor:dragging?'grabbing':'grab'}} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}} viewBox="0 0 600 330" role="group" aria-label={`${a.bodyLabel}, ${a.colorLabel}. Об’ємна схема кузова`}><defs><linearGradient id={`paint-${id}`} x1="0" y1="0" x2=".4" y2="1"><stop stopColor={a.color}/><stop offset=".45" stopColor={a.color}/><stop offset="1" stopColor="#111e2c"/></linearGradient><radialGradient id={`shadow-${id}`}><stop stopColor="#344758" stopOpacity=".24"/><stop offset="1" stopColor="#344758" stopOpacity="0"/></radialGradient></defs><ellipse cx="300" cy="268" rx="265" ry="48" fill={`url(#shadow-${id})`}/>{faces.map((f,i)=><polygon key={i} points={f.points.map(p=>project(p).join(',')).join(' ')} fill={f.fill} stroke="#172a3a" strokeOpacity=".16" strokeWidth=".6"/>)}{nodes.map((n,i)=>{const [x,y]=project(n.point);return <g key={n.n} role="button" tabIndex={0} aria-label={`${n.n}. ${n.title}`} aria-pressed={selected===i} onClick={()=>{setSelected(i);onSelect(n.group);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i);onSelect(n.group);}}} className="model-node"><circle cx={x} cy={y} r="22" fill={selected===i?'#1767b4':'#ef853d'} stroke="white" strokeWidth="3"/><text x={x} y={y+5} textAnchor="middle" fill="white" fontSize="15" fontWeight="700">{n.n}</text></g>;})}</svg><small>Проведіть пальцем або перетягніть авто, щоб повернути.</small><div className="model-legend">{nodes.map((n,i)=><button key={n.n} aria-pressed={selected===i} onClick={()=>{setSelected(i);onSelect(n.group);}}>{n.n}. {n.title}</button>)}</div><p className="model-explanation">{nodes[selected].detail}</p><small>Схематична 3D-модель кузова. Точна конструкція вузлів залежить від модифікації.{!a.knownBody||!a.knownColor?' Відсутні дані не визначаємо за припущенням.':''}</small></section>;
}
