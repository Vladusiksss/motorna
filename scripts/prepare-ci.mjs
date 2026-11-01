import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
if(process.env.CI!=='true')throw new Error('CI fixture preparation only; never replace deployment identity.');
if(!existsSync('.openai/hosting.json')){
 mkdirSync('.openai',{recursive:true});
 writeFileSync('.openai/hosting.json',JSON.stringify({d1:'DB',r2:'BUCKET'}));
}
