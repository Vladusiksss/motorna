import PublicCatalog from './public-catalog';
export const metadata={title:'Каталог авто · MOTORNA',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{token:string}>}){return <PublicCatalog token={(await params).token}/>;}
