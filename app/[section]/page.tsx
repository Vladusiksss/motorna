import {notFound} from 'next/navigation';
import Workspace from '../workspace';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['garage','service','favorites','profile'].includes(section))notFound();return <Workspace initialSection={section}/>;}
