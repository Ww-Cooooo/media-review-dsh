import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const workspace=path.join(root,'fixtures/workspace');
await fs.mkdir(workspace,{recursive:true});
await fs.mkdir(path.join(root,'fixtures/contracts'),{recursive:true});
const ffmpeg=process.env.MR_TEST_FFMPEG||'ffmpeg';
for(const [name,color] of [['small-v1.mp4','0x24415c'],['small-v2.mp4','0x5c4524']]) {
  const file=path.join(workspace,name);
  if(await fs.stat(file).catch(()=>null)) continue;
  execFileSync(ffmpeg,['-nostdin','-v','error','-n','-f','lavfi','-i',`color=c=${color}:s=320x180:r=25:d=40`,'-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','40','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',file],{stdio:'inherit',windowsHide:true});
}
console.log('Synthetic 40-second color/silence fixtures ready. No user media is used.');
