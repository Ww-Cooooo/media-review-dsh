import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {localTools} from './analysis.mjs';
import {ordinaryDirectory,atomicJson,readJson,ReviewError} from './vendor/runtime.mjs';

const empty=()=>({state:'idle',phase:'',startedAt:null,updatedAt:null,error:'',decoded:false,black:[],silence:[],frames:[],findings:[]});
export async function inspectProgram(command,args,signal,log){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve();};
    const abort=()=>{child.kill();finish(new Error('检查已停止，已有结果保留。'));},timer=setTimeout(()=>{child.kill();finish(new Error('检查超时，已有结果保留。'));},30*60*1000);
    signal.addEventListener('abort',abort,{once:true});
    child.stderr.on('data',bytes=>log?.(bytes.toString()));child.on('error',()=>finish(new Error('本机 FFmpeg 不可用，请检查工具设置。')));child.on('close',code=>finish(code===0?null:new Error('媒体解码或取帧未完成，请查看检查记录。')));
  });
}
export class Inspections {
  constructor(store,lifetime){this.store=store;this.lifetime=lifetime;this.jobs=new Map();this.tail=Promise.resolve();}
  async folder(taskId){return ordinaryDirectory(path.join(await this.store.tasks.directoryFor(taskId),'inspection'));}
  public(job){const {controller,...result}=job;return structuredClone(result);}
  async request(q){
    await this.store.binding(q.taskId,q.workspaceId);const folder=await this.folder(q.taskId);
    let job=this.jobs.get(q.taskId);if(!job){try{job=await readJson(path.join(folder,'result.json'),2*1024*1024);}catch(e){if(e.code!=='ENOENT')throw e;job=empty();}if(['running','queued'].includes(job.state)){job.state='interrupted';job.error='上次检查被中断，可重新开始。';}this.jobs.set(q.taskId,job);}
    if(q.action==='status')return this.public(job);
    if(q.action==='cancel'){job.controller?.abort();return this.public(job);}
    if(q.action!=='start')throw new ReviewError('检查操作无效。','invalid_inspection',400);
    if(['running','queued'].includes(job.state))return this.public(job);
    if([...this.jobs.values()].filter(j=>['running','queued'].includes(j.state)).length>=8)throw new ReviewError('已有多份作品等待检查，请稍后再试。','inspection_capacity',429);
    const task=await this.store.tasks.read(q.taskId),entry=await this.store.mediaEntry(q.taskId,q.workspaceId),binding=await this.store.binding(q.taskId,q.workspaceId);
    const supplied=q.points||[];if(!Array.isArray(supplied)||supplied.length>16||supplied.some(n=>!Number.isSafeInteger(n)||n<0||n>task.media.durationMs))throw new ReviewError('检查位置无效。','invalid_inspection',400);
    const points=[...new Set([0,Math.round(task.media.durationMs*.25),Math.round(task.media.durationMs*.5),Math.round(task.media.durationMs*.75),Math.max(0,task.media.durationMs-100),...supplied,...binding.mappings.map(m=>m.startMs)])].slice(0,21);
    Object.assign(job,empty(),{state:'queued',phase:'等待检查',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),controller:new AbortController()});
    const signal=AbortSignal.any([job.controller.signal,this.lifetime.signal]);
    const persist=()=>atomicJson(path.join(folder,'result.json'),this.public(job));
    const work=async()=>{try{
      signal.throwIfAborted();job.state='running';job.phase='全片解码';await persist();const tools=await localTools(typeof this.store.ffprobe==='function'?this.store.ffprobe():this.store.ffprobe,this.store.toolOverrides?.()||{}),video=binding.streams.some(s=>s.codec_type==='video'),audio=binding.streams.some(s=>s.codec_type==='audio');
      let pending='',silenceStart=null;const duration=task.media.durationMs;
      const line=value=>{job.updatedAt=new Date().toISOString();let m;if((m=/black_start:([\d.]+) black_end:([\d.]+)/.exec(value))&&job.black.length<1000)job.black.push({startMs:Math.round(+m[1]*1000),endMs:Math.min(duration,Math.round(+m[2]*1000))});if((m=/silence_start: ([\d.]+)/.exec(value)))silenceStart=Math.round(+m[1]*1000);if((m=/silence_end: ([\d.]+)/.exec(value))&&silenceStart!==null&&job.silence.length<1000){job.silence.push({startMs:silenceStart,endMs:Math.min(duration,Math.round(+m[1]*1000))});silenceStart=null;}if(/invalid|error|corrupt/i.test(value)&&job.findings.length<50)job.findings.push(value.slice(0,400));};
      await inspectProgram(tools.ffmpeg,['-nostdin','-hide_banner','-threads','2','-filter_threads','2','-protocol_whitelist','file,pipe','-i',entry.source,...(video?['-vf','blackdetect=d=0.25:pix_th=0.10']:['-vn']),...(audio?['-af','silencedetect=n=-45dB:d=0.4']:['-an']),'-f','null','-'],signal,text=>{pending+=text;const lines=pending.split(/[\r\n]+/);pending=lines.pop().slice(-8192);lines.forEach(line);});if(pending)line(pending);if(silenceStart!==null)job.silence.push({startMs:silenceStart,endMs:duration});job.decoded=true;
      if(video){job.phase='抽取检查画面';for(const at of points){signal.throwIfAborted();const file=`${randomUUID()}.jpg`;await inspectProgram(tools.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-threads','2','-filter_threads','2','-ss',String(Math.min(at,Math.max(0,duration-100))/1000),'-protocol_whitelist','file,pipe','-i',entry.source,'-frames:v','1','-vf','scale=640:-2','-q:v','3',path.join(folder,file)],signal);const stat=await fs.stat(path.join(folder,file));if(stat.size>2*1024*1024)throw Error('检查画面超过容量限制。');job.frames.push({file,timeMs:at});job.updatedAt=new Date().toISOString();await persist();}}
      await this.store.assertMedia(q.taskId,q.workspaceId);job.state='ready';job.phase='完成';
    }catch(e){job.state=signal.aborted?'cancelled':'error';job.error=e.message;}finally{job.updatedAt=new Date().toISOString();job.controller=null;await persist();}};
    this.tail=this.tail.then(work,work);return this.public(job);
  }
  async frame(taskId,workspaceId,file){await this.store.binding(taskId,workspaceId);if(!/^[a-f0-9-]{36}\.jpg$/.test(file||''))throw Error('Invalid frame');const result=await this.request({taskId,workspaceId,action:'status'});if(!result.frames.some(f=>f.file===file))throw Error('Unknown frame');const target=path.join(await this.folder(taskId),file),stat=await fs.lstat(target);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>2*1024*1024)throw Error('Invalid frame');return fs.readFile(target);}
}
