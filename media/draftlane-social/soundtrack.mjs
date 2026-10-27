import {writeFile} from 'node:fs/promises';
const rate=44100,seconds=24,samples=rate*seconds;
const audio=Buffer.alloc(samples*2+44);
audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(rate,24);audio.writeUInt32LE(rate*2,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(samples*2,40);
const chords=[[130.813,164.814,195.998],[110,130.813,164.814],[87.307,110,130.813],[97.999,123.471,146.832]];
for(let i=0;i<samples;i++){
 const t=i/rate,beat=t%.5,bar=Math.floor(t/4),chord=chords[bar%4];
 let v=0;
 for(const f of chord)v+=.055*Math.sin(2*Math.PI*f*t)*(.65+.35*Math.sin(Math.PI*(t%4)/4));
 v+=.21*Math.sin(2*Math.PI*(48*beat+4*(1-Math.exp(-beat*35))))*Math.exp(-beat*18);
 const step=Math.floor(t/.25),arp=chord[step%3]*4,local=t%.25;
 v+=.07*Math.sin(2*Math.PI*arp*t)*Math.exp(-local*18);
 const fade=Math.min(1,t/.15,(24-t)/1.1);
 audio.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v*fade))*32767),44+i*2);
}
await writeFile(new URL('soundtrack.wav',import.meta.url),audio);
