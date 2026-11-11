import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReviewError } from './vendor/runtime.mjs';

const run = promisify(execFile);
const equalPath = (a,b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
export const identity = stat => Object.fromEntries(['dev','ino','size','mtimeMs','ctimeMs'].map(k=>[k,stat[k]]));
export const sameIdentity = (a,b) => Object.keys(a).every(k=>a[k]===b[k]);
// A copied backup can have a new inode/timestamp while containing the exact
// reviewed bytes. Revalidate that exceptional case without buffering the file.
export async function verifyMediaIdentity(entry,signal) {
  const file=await guardedPath(entry.root,entry.source),handle=await fs.open(file,'r');
  try {
    const before=identity(await handle.stat());
    if(sameIdentity(entry.identity,before))return entry;
    if(before.size!==entry.identity.size)throw new ReviewError('媒体内容已变化，请登记新版本；原意见保留','media_changed',409);
    const hash=createHash('sha256');
    for await(const bytes of handle.createReadStream({autoClose:false,highWaterMark:256*1024})) {signal?.throwIfAborted();hash.update(bytes);}
    if(hash.digest('hex')!==entry.hash||!sameIdentity(before,identity(await handle.stat()))||!sameIdentity(before,identity(await fs.stat(file))))throw new ReviewError('媒体内容已变化，请登记新版本；原意见保留','media_changed',409);
    return {...entry,identity:before};
  }finally{await handle.close();}
}
export function within(root,file) {
  const relative=path.relative(root,file);
  return relative==='' || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative));
}
export async function guardedPath(root,file) {
  if(!path.isAbsolute(root)||!path.isAbsolute(file)||!within(root,file)) throw new ReviewError('文件不在这个任务允许的目录内','outside_root',403);
  const resolvedRoot=await fs.realpath(root), resolved=await fs.realpath(file);
  if(!equalPath(path.resolve(root),resolvedRoot)||!equalPath(path.resolve(file),resolved)||!within(resolvedRoot,resolved)) throw new ReviewError('文件路径包含链接或已改变','path_changed',403);
  // Check every component, including junctions which resolve back into the root.
  let current=path.parse(resolved).root;
  for(const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    if((await fs.lstat(current)).isSymbolicLink()) throw new ReviewError('不读取链接或联接中的文件','path_changed',403);
  }
  return resolved;
}
export async function inspectMedia(root,file,configuredProbe,signal,manualMetadata) {
  const resolved=await guardedPath(root,file);
  const handle=await fs.open(resolved,'r');
  let initial, digest;
  try {
    initial=await handle.stat();
    if(!initial.isFile()||initial.size<1)throw new ReviewError('请登记有内容的普通媒体文件','invalid_media',400);
    const hash=createHash('sha256');
    for await (const bytes of handle.createReadStream({autoClose:false,highWaterMark:256*1024})) {signal?.throwIfAborted();hash.update(bytes);}
    if(!sameIdentity(identity(initial),identity(await handle.stat())))throw new ReviewError('读取期间文件发生变化','media_changed');
    digest=hash.digest('hex');
  }finally{await handle.close();}
  let probe=configuredProbe;
  if(!probe) {
    try {
      const data=JSON.parse(await fs.readFile(path.join(os.homedir(),'.media-review-desk/data/tools.json'),'utf8'));
      const ffmpeg=typeof data.ffmpeg==='string'?data.ffmpeg:data.ffmpeg?.path;
      if(ffmpeg) probe=path.join(path.dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe');
    }catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  }
  probe=probe || 'ffprobe';
  let result;
  try { result=await run(probe,['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height','-of','json',resolved],{windowsHide:true,signal,timeout:20000,maxBuffer:1024*1024}); }
  catch(error){if(manualMetadata){const m=manualMetadata;if(m.sha256!==digest||m.size!==initial.size||!Number.isSafeInteger(m.durationMs)||m.durationMs<1||m.durationMs>172800000||![m.width,m.height].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=16384))throw new ReviewError('手选文件与路径不是同一份媒体，未登记。','manual_mismatch',409);if(!sameIdentity(identity(initial),identity(await fs.stat(resolved))))throw new ReviewError('文件在读取时已变化','media_changed');return {source:resolved,identity:identity(initial),contentHash:digest,durationMs:m.durationMs,streams:[{codec_type:m.width&&m.height?'video':'audio',codec_name:'browser-verified',...(m.width&&m.height?{width:m.width,height:m.height}:{})}],metadataSource:'browser'};}throw new ReviewError(error.code==='ENOENT'?'未找到可用的 ffprobe。请在插件设置中指定已安装的程序。':'媒体无法识别或读取超时；原文件未改动','probe_failed',422);}
  const data=JSON.parse(result.stdout),durationMs=Math.round(Number(data.format?.duration)*1000);
  if(!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>172800000||!data.streams?.some(s=>['video','audio'].includes(s.codec_type)))throw new ReviewError('文件没有有效音视频时长','invalid_media',422);
  if(!sameIdentity(identity(initial),identity(await fs.stat(resolved))))throw new ReviewError('媒体在检查期间发生变化','media_changed');
  return {source:resolved,identity:identity(initial),contentHash:digest,durationMs,streams:data.streams};
}
export function parseRange(value,size) {
  if(!value)return {start:0,end:size-1,status:200};
  const match=/^bytes=(\d*)-(\d*)$/.exec(value);
  if(!match||(!match[1]&&!match[2]))return null;
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return null;start=Math.max(0,size-suffix);end=size-1;}
  else {start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return null;end=Math.min(size-1,end);}
  return {start,end,status:206};
}
export async function streamMedia(request,entry,active,lifetime) {
  const file=await guardedPath(entry.root,entry.source),handle=await fs.open(file,'r');
  let handedOff=false;
  try {
    const stat=await handle.stat();
    if(!stat.isFile()||!sameIdentity(entry.identity,identity(stat)))throw new ReviewError('这份媒体已被外部修改，请登记新版；意见仍保留','media_changed',409);
    const headers={'Accept-Ranges':'bytes','Content-Type':entry.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','ETag':'"'+entry.hash+'"'};
    // RFC 9110: Range applies to GET. HEAD reports the complete representation.
    const range=parseRange(request.method==='HEAD'?null:request.headers.get('range'),stat.size);
    if(!range)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${stat.size}`,'Content-Length':'0'}});
    headers['Content-Length']=String(range.end-range.start+1);
    if(range.status===206)headers['Content-Range']=`bytes ${range.start}-${range.end}/${stat.size}`;
    if(request.method==='HEAD')return new Response(null,{status:200,headers});
    if(active.size>=12)throw new ReviewError('同时播放请求较多，请稍后再试','stream_capacity',429);
    const signal=AbortSignal.any([request.signal,lifetime]);
    signal.throwIfAborted();
    const stream=handle.createReadStream({start:range.start,end:range.end,highWaterMark:64*1024,autoClose:true});
    const abort=()=>stream.destroy();
    active.add(stream);signal.addEventListener('abort',abort,{once:true});
    stream.once('close',()=>{active.delete(stream);signal.removeEventListener('abort',abort);});
    handedOff=true;
    return new Response(Readable.toWeb(stream),{status:range.status,headers});
  }finally{if(!handedOff)await handle.close();}
}
