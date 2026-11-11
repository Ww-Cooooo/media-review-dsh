import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ordinaryDirectory,atomicJson,readJson,ReviewError} from './vendor/runtime.mjs';
import {parseSubtitles} from './subtitles.js';
import pins from './tool-pins.json' with {type:'json'};

const execute=promisify(execFile);
const reject=message=>{throw new ReviewError(message,'tool_preparation_failed',422);};
export async function verifiedDownload(file,spec){
  const info=await fs.lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size!==spec.bytes)reject('下载文件长度不符，未执行。');
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  if(hash.digest('hex')!==spec.sha256)reject('下载文件校验不符，未执行。');
}
export const safeArchiveEntry=name=>{const normalized=name.replaceAll('\\','/');return !/^(?:\/|[a-z]:)/iu.test(normalized)&&!normalized.split('/').includes('..')&&!normalized.includes(':');};
const signature=async files=>{const facts=[];for(const file of files){const stat=await fs.stat(file);facts.push([await fs.realpath(file),stat.size,stat.mtimeMs]);}return createHash('sha256').update(JSON.stringify(facts)).digest('hex');};
export class ToolPreparation {
  constructor(store,analysis,lifetime){this.store=store;this.analysis=analysis;this.lifetime=lifetime;this.state={state:'idle',phase:'',error:'',reused:[],prepared:[],verified:false,verificationReused:false,downloadedBytes:0};this.tail=Promise.resolve();}
  async init(){this.store.managedTools=await readJson(path.join(this.store.directory,'managed-tools.json'),65536).catch(e=>{if(e.code==='ENOENT')return {};throw e;});}
  public(){return {...this.state};}
  request(request){
    if(request.action==='cancel'){this.controller?.abort();return this.public();}
    if(request.action==='status'||this.state.state==='running')return this.public();
    if(request.action!=='prepare')reject('工具准备操作无效。');
    if(process.platform!=='win32'||process.arch!=='x64')reject('自动准备当前支持 Windows x64。');
    this.controller=new AbortController();const signal=AbortSignal.any([this.controller.signal,this.lifetime.signal]);
    this.state={state:'running',phase:'检查已有工具',error:'',reused:[],prepared:[],verified:false,verificationReused:false,downloadedBytes:0};
    this.tail=this.run(signal,request.verify===true).then(()=>{this.state.state='ready';this.state.phase='工具与字幕测试通过';}).catch(e=>{this.state.state=signal.aborted?'cancelled':'error';this.state.error=signal.aborted?'已停止准备，已有工具和意见保留。':e.message;}).finally(()=>{this.controller=null;});
    return this.public();
  }
  async acquire(id,signal){
    const spec=pins[id],runtime=await ordinaryDirectory(path.join(this.store.directory,'runtime')),stage=await fs.mkdtemp(path.join(runtime,'.prepare-')),archive=path.join(stage,id==='model'?'ggml-small.bin':'download.zip');
    this.state.phase=`下载${{ffmpeg:'音视频工具',whisper:'台词识别工具',model:'语音模型'}[id]}`;
    const timer=setInterval(()=>fs.stat(archive).then(s=>{this.state.downloadedBytes=s.size;}).catch(()=>{}),1000);
    try{
      const system=process.env.SystemRoot||'C:/Windows';
      await execute(path.join(system,'System32/curl.exe'),['--fail','--location','--silent','--show-error','--proto','=https','--proto-redir','=https','--connect-timeout','30','--max-time','1800','--speed-limit','8192','--speed-time','45','--max-filesize',String(spec.bytes),'--output',archive,spec.url],{windowsHide:true,signal,timeout:1810000,maxBuffer:8192});
      await verifiedDownload(archive,spec);signal.throwIfAborted();this.state.phase='校验通过，正在准备';
      if(id!=='model'){
        const tar=path.join(system,'System32/tar.exe'),listing=await execute(tar,['-tf',archive],{windowsHide:true,signal,timeout:30000,maxBuffer:4*1024*1024});
        if(listing.stdout.split(/\r?\n/).filter(Boolean).some(name=>!safeArchiveEntry(name)))reject('工具包路径异常，未解压。');
        await execute(tar,['-xf',archive,'-C',stage],{windowsHide:true,signal,timeout:120000,maxBuffer:65536});await fs.unlink(archive);
      }
      const check=async dir=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())reject('工具包包含链接，未采用。');if(entry.isDirectory())await check(path.join(dir,entry.name));}};await check(stage);
      if(!(await fs.stat(path.join(stage,spec.entry))).isFile())reject('工具包缺少入口，未采用。');
      await atomicJson(path.join(stage,'media-review-dsh-managed.json'),{id,version:spec.version,sha256:spec.sha256});
      const target=path.join(runtime,`${id}-${spec.version}-${randomUUID().slice(0,8)}`);await fs.rename(stage,target);return path.join(target,spec.entry);
    }catch(e){if(signal.aborted)throw e;reject(`${this.state.phase}未完成：${e.code||e.message}。已完成的工具会复用。`);}
    finally{clearInterval(timer);const full=path.resolve(stage);if(path.dirname(full)!==path.resolve(runtime)||!path.basename(full).startsWith('.prepare-'))reject('临时目录边界异常，未删除。');const stat=await fs.lstat(full).catch(()=>null);if(stat?.isDirectory()&&!stat.isSymbolicLink())await fs.rm(full,{recursive:true});}
  }
  async run(signal,force){
    const status=await this.analysis.readiness(),selected=Object.fromEntries(status.tools.filter(t=>t.ready).map(t=>[t.name,t.path]));
    for(const [id,file] of Object.entries(selected))if(!path.isAbsolute(file)){const found=await execute(path.join(process.env.SystemRoot||'C:/Windows','System32/where.exe'),[file],{windowsHide:true,signal,timeout:5000,maxBuffer:8192});selected[id]=found.stdout.trim().split(/\r?\n/)[0];if(!path.isAbsolute(selected[id]))reject('工具实际位置无法确认。');}
    this.state.reused=Object.keys(selected);
    for(const id of ['ffmpeg','whisper','model']){
      signal.throwIfAborted();if(selected[id]&&(id!=='ffmpeg'||selected.ffprobe))continue;
      const configured=this.store.explicitTools?.()||{};
      if(configured[id]||(id==='ffmpeg'&&configured.ffprobe))reject('已指定的工具路径不可用，请先在设置中修正；原配置保留。');
      const file=await this.acquire(id,signal);selected[id]=file;
      if(id==='ffmpeg')selected.ffprobe=path.join(path.dirname(file),'ffprobe.exe');
      this.state.prepared.push(id);this.store.managedTools={...this.store.managedTools,...selected};
      await atomicJson(path.join(this.store.directory,'managed-tools.json'),this.store.managedTools);
    }
    // Persist only plugin-owned fallback choices. Explicit host settings remain authoritative.
    this.store.managedTools={...this.store.managedTools,...selected};await atomicJson(path.join(this.store.directory,'managed-tools.json'),this.store.managedTools);
    const verified=await this.analysis.readiness();if(verified.tools.some(t=>!t.ready))reject('工具试运行未通过，请查看工具状态。');
    const sample=this.store.setupSample||fileURLToPath(new URL('./assets/setup-speech.wav',import.meta.url)),facts=await signature([...Object.values(selected),sample]),receiptFile=path.join(this.store.directory,'tool-verification.json'),old=await readJson(receiptFile,65536).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(!force&&old?.signature===facts&&old.passed){this.state.verified=true;this.state.verificationReused=true;return;}
    this.state.phase='实测中文台词';const temporary=await ordinaryDirectory(path.join(this.store.directory,'tool-tests')),prefix=path.join(temporary,randomUUID());
    const run=(file,args)=>execute(file,args,{windowsHide:true,signal,timeout:120000,maxBuffer:1024*1024});
    try{
      const probe=await run(selected.ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',sample]),durationMs=Math.round(Number(probe.stdout.trim())*1000);
      if(!Number.isFinite(durationMs)||durationMs<1000||durationMs>20000)reject('自检样本时长异常。');
      await run(selected.ffmpeg,['-nostdin','-v','error','-i',sample,'-ac','1','-ar','16000',prefix+'.wav']);
      const pcm=await fs.readFile(prefix+'.wav');if(pcm.length<1000||!pcm.subarray(100).some(v=>v>0))reject('自检没有得到有效音轨。');
      await run(selected.whisper,['-m',selected.model,'-f',prefix+'.wav','-l','zh','-t','4','-osrt','-of',prefix,'-ng']);
      const cues=parseSubtitles(await fs.readFile(prefix+'.srt','utf8'),durationMs),text=cues.map(c=>c.text).join('');
      if(!cues.length||!/(字幕|声音|聲音|画面|畫面)/.test(text))reject('中文台词实测未通过，已有工具保留。');
      await atomicJson(receiptFile,{signature:facts,passed:true,at:new Date().toISOString(),durationMs,cues:cues.length});this.state.verified=true;
    }finally{for(const suffix of ['.wav','.srt'])await fs.unlink(prefix+suffix).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }
}
