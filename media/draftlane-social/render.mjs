import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const frames=path.join(root,'frames');await mkdir(frames,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(4344,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
 page.on('pageerror',error=>{throw error;});
 await page.goto('http://127.0.0.1:4344/?render');await page.waitForFunction(()=>window.ready);
 for(let frame=0;frame<576;frame++){await page.evaluate(t=>window.renderAt(t),frame/24);await page.screenshot({path:path.join(frames,String(frame).padStart(5,'0')+'.png')});if(frame%96===0)console.log(`Rendered ${frame}/576`);}
}finally{await browser.close();server.close();}
