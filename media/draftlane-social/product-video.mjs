// Recut the project's landing-page product recording; no authenticated user data is captured.
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../..');
const source=path.join(repo,'public/videos/hero-mint.mp4');
const work=path.join(repo,'.local','product-video');await mkdir(work,{recursive:true});
function run(args){const p=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...args],{stdio:'inherit'});if(p.error)throw p.error;if(p.status!==0)throw Error('FFmpeg failed');}
const scenes=[
 {duration:2.5,title:'Your idea. One workspace.',caption:'Canvas + documents + AI',intro:true},
 {duration:8,start:3,span:8,title:'CANVAS',caption:'Watch the agent draw a diagram, shape by shape.'},
 {duration:5,start:11,span:4,title:'AI IN THE WORKSPACE',caption:'Ask for changes. Refine the visual plan in place.'},
 {duration:5,start:16,span:3.8,title:'BOTH VIEWS. ONE CONTEXT.',caption:'Keep the diagram and its written specification side by side.'},
 {duration:6,start:18.6,span:1.1,title:'DOCUMENT',caption:'From a visual flow to a structured written specification.',doc:true},
 {duration:3.5,title:'Make room for the idea.',caption:'github.com/ratuhin1122/DraftLane',intro:true},
];
const font='C\\:/Windows/Fonts/arial.ttf',bold='C\\:/Windows/Fonts/arialbd.ttf';
const text=(value,y,size,color='#eef8f5')=>`drawtext=fontfile='${bold}':text='${value}':fontcolor=${color}:fontsize=${size}:x=(w-tw)/2:y=${y}`;
for(const vertical of [false,true]){
 const W=vertical?1080:1920,H=vertical?1920:1080;
 const outputs=[];
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],out=path.join(work,`${vertical?'vertical':'wide'}-${i}.mp4`);outputs.push(out);
  let filters,inputs;
  if(s.intro){
   inputs=['-f','lavfi','-i',`color=c=0x080e12:s=${W}x${H}:r=24:d=${s.duration}`,'-loop','1','-i',path.join(root,'logo.png')];
   filters=`[1:v]scale=${vertical?660:760}:-1[logo];[0:v][logo]overlay=(W-w)/2:${vertical?440:260},${text(s.title,vertical?760:500,vertical?64:76)},${text(s.caption,vertical?940:650,vertical?34:38,'#72e4c4')},fade=t=in:d=0.3,fade=t=out:st=${s.duration-.3}:d=0.3[v]`;
  }else{
   inputs=['-ss',String(s.start),'-t',String(s.span),'-i',source,'-f','lavfi','-i',`color=c=0x080e12:s=${W}x${H}:r=24:d=${s.duration}`,'-loop','1','-i',path.join(root,'logo.png')];
   const crop=s.doc?'crop=660:740:65:80':'crop=1536:768:32:64';
   const size=vertical?(s.doc?'scale=-2:900,pad=1024:920:(ow-iw)/2:(oh-ih)/2:color=0x080e12':'scale=1024:512'):(s.doc?'scale=-2:780,pad=1664:832:(ow-iw)/2:(oh-ih)/2:color=0x080e12':'scale=1664:832');
   filters=`[0:v]setpts=${s.duration/s.span}*(PTS-STARTPTS),fps=24,${crop},${size}[clip];[2:v]scale=${vertical?300:270}:-1[logo];[1:v][clip]overlay=(W-w)/2:${vertical?610:170}[base];[base][logo]overlay=${vertical?60:128}:${vertical?110:32},${text(s.title,vertical?350:102,vertical?55:38,'#72e4c4')},${text(s.caption,vertical?1640:1030,vertical?27:28)},fade=t=in:d=0.2,fade=t=out:st=${s.duration-.2}:d=0.2[v]`;
  }
  run([...inputs,'-filter_complex',filters,'-map','[v]','-t',String(s.duration),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out]);
  console.log(`Rendered ${vertical?'vertical':'wide'} scene ${i+1}/6`);
 }
 const list=path.join(work,vertical?'vertical.txt':'wide.txt');
 await writeFile(list,outputs.map(file=>`file '${file.replaceAll('\\','/')}'`).join('\n'));
 const output=path.join(root,`DraftLane-product-demo-${vertical?'1080x1920':'1920x1080'}.mp4`);
 run(['-f','concat','-safe','0','-i',list,'-stream_loop','-1','-i',path.join(root,'soundtrack.wav'),'-map','0:v','-map','1:a','-c:v','copy','-af','afade=t=out:st=28.8:d=1.2','-c:a','aac','-b:a','192k','-t','30','-movflags','+faststart',output]);
 console.log(output);
}
