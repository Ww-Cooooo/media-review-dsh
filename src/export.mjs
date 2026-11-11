import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ordinaryDirectory,atomicJson,readJson,ReviewError} from './vendor/runtime.mjs';
import {regionsOf} from './subtitles.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timestamp=ms=>ms===null?'整片':`${Math.floor(ms/60000).toString().padStart(2,'0')}:${(ms/1000%60).toFixed(2).padStart(5,'0')}`;
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// ZIP STORE keeps the portable export dependency-free and has an explicit cap.
export function zipStore(entries){
  let offset=0,total=0;const local=[],central=[];
  for(const [name,value] of entries){const bytes=Buffer.isBuffer(value)?value:Buffer.from(value),label=Buffer.from(name);total+=bytes.length;if(total>32*1024*1024)throw new ReviewError('资料包超过 32 MB，请按轮次分别导出。','export_capacity',413);
    const crc=crc32(bytes),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(label.length,26);
    local.push(header,label,bytes);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(label.length,28);c.writeUInt32LE(offset,42);central.push(c,label);offset+=header.length+label.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
export async function exportReview(store,request){
  await store.binding(request.taskId,request.workspaceId);
  const task=await store.tasks.read(request.taskId);
  let record;
  if(request.roundId){const round=store.state.rounds[request.roundId];if(!round||round.taskId!==request.taskId||round.workspaceId!==request.workspaceId)throw new ReviewError('返修轮次不属于这份作品。','round_denied',403);record=(await store.fixed(round)).record;}
  else record=(await store.draft(task.id)).record;
  const round=request.roundId?store.state.rounds[request.roundId]:null;
  const metadata={format:'media-review-dsh-package/v1',pluginVersion:'0.1.0-rc.6',taskId:task.id,title:task.title,version:task.version,media:record.media,roundId:round?.id||null,recordRevision:round?.revision||(await store.draft(task.id)).revision,exportedAt:new Date().toISOString(),originalMediaIncluded:false};
  const entries=[['review.json',JSON.stringify(record,null,2)],['package.json',JSON.stringify(metadata,null,2)]];
  if(round)entries.push(['round.json',JSON.stringify({id:round.id,number:round.number,revision:round.revision,hash:round.hash,scope:round.scope,priorities:round.priorities,state:round.state,taskId:round.taskId,targetTaskId:round.targetTaskId,createdAt:round.createdAt},null,2)]);
  const images=new Map();let imageBytes=0;
  for(const n of record.notes)if(n.reference&&!images.has(n.reference.fileName)){const image=await store.referenceImage(task.id,request.workspaceId,n.reference.fileName);imageBytes+=image.bytes.length;if(imageBytes>24*1024*1024)throw new ReviewError('参考图较多，请按轮次分别导出。','export_capacity',413);images.set(n.reference.fileName,image.bytes);entries.push(['references/'+n.reference.fileName,image.bytes]);}
  const markdown=[`# ${task.title} · V${task.version.number}`,'',round?`固定轮次 R${round.number}`:'已保存意见','',`任务：${task.id}`,''];
  const rows=record.notes.map((n,i)=>{
    const regions=regionsOf(n),image=n.reference;
    const visual=image?`<svg viewBox="0 0 ${image.width} ${image.height}" role="img" aria-label="带编号框的参考画面"><image href="references/${escape(image.fileName)}" width="${image.width}" height="${image.height}"/>${regions.map(r=>{const x=r.rect.x*image.width,y=r.rect.y*image.height,w=r.rect.width*image.width,h=r.rect.height*image.height;return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="white" stroke-width="4"/><text x="${x+8}" y="${y+27}" font-size="24" fill="white" stroke="black" stroke-width="4" paint-order="stroke">#${r.id}</text>`;}).join('')}</svg><small>参考帧 ${timestamp(image.frameMs)}${image.origin?` · 原版 V${image.origin.version}`:''}</small>`:'';
    const heading=`${i+1}. ${{modify:'修改',keep:'保留',discuss:'讨论'}[n.kind]} · ${timestamp(n.startMs)}${n.endMs!==null?' — '+timestamp(n.endMs):''}`;
    markdown.push(`## ${heading}`,'',n.text,'',...regions.flatMap(r=>[`**框 #${r.id}** ${r.text||''}`,'']));
    if(image){const svg=visual.slice(0,visual.indexOf('</svg>')+6).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace(`references/${escape(image.fileName)}`,`data:image/jpeg;base64,${images.get(image.fileName).toString('base64')}`);const filename=`annotations/${n.id}.svg`;entries.push([filename,svg]);markdown.push(`![带编号框的参考画面](${filename})`,'',`参考帧 ${timestamp(image.frameMs)}`,'');}
    return `<article><h2>${escape(heading)}</h2><p>${escape(n.text)}</p>${visual}${regions.map(r=>r.text?`<p><strong>#${r.id}</strong> ${escape(r.text)}</p>`:'').join('')}</article>`;
  }).join('');
  entries.push(['返修清单.md',markdown.join('\n')]);
  entries.unshift(['返修清单.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(task.title)} · 返修清单</title><style>body{max-width:960px;margin:40px auto;padding:0 24px;font:16px/1.8 system-ui;color:#20302c}article{padding:24px 0;border-bottom:1px solid #ddd}h2{font-size:19px}p{white-space:pre-wrap}svg{display:block;width:100%;max-height:600px}small{color:#52635f}</style><h1>${escape(task.title)} · V${task.version.number}</h1><p>${request.roundId?'固定轮次意见':'已保存意见'} · ${record.notes.length} 条。原媒体另行提供。</p>${rows}</html>`]);
  const id=randomUUID(),folder=path.join(store.directory,'exports');await ordinaryDirectory(folder);
  const name=`Media-Review-${id}.zip`,file=path.join(folder,name);await fs.writeFile(file,zipStore(entries),{flag:'wx',mode:0o600});
  await atomicJson(path.join(folder,`${id}.json`),{taskId:task.id,workspaceId:request.workspaceId,name});
  return {id,name,directory:folder,path:file};
}
export async function readExport(store,taskId,workspaceId,id){
  await store.binding(taskId,workspaceId);if(!/^[a-f0-9-]{36}$/.test(id||''))throw new ReviewError('资料包不存在。','export_missing',404);
  const folder=path.join(store.directory,'exports'),meta=await readJson(path.join(folder,`${id}.json`),4096);
  if(meta.taskId!==taskId||meta.workspaceId!==workspaceId||meta.name!==`Media-Review-${id}.zip`)throw new ReviewError('资料包不属于当前作品。','export_denied',403);
  const file=path.join(folder,meta.name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>34*1024*1024)throw new ReviewError('资料包无法读取。','export_invalid',404);
  return {bytes:await fs.readFile(file),name:meta.name};
}
