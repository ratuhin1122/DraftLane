import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './soundtrack.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','warning','-framerate','24','-i',path.join(root,'frames/%05d.png'),'-i',path.join(root,'soundtrack.wav'),'-vf','scale=1080:1920:flags=lanczos','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','24','-movflags','+faststart',path.join(root,'DraftLane-social-1080x1920.mp4')],{stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)throw new Error('Video encoding failed');
