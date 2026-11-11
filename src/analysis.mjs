import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {atomicJson,readJson,ordinaryDirectory,ReviewError} from './vendor/runtime.mjs';
import {parseSubtitles} from './subtitles.js';

const problem=message=>new ReviewError(message,'analysis_unavailable',422);
const pathValue=value=>typeof value==='string'?value:value?.path;
export async function localTools(probe,overrides={}){
  let saved={};try{saved=await readJson(path.join(os.homedir(),'.media-review-desk/data/tools.json'),64*1024);}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
  const sibling=probe?path.join(path.dirname(probe),process.platform==='win32'?'ffmpeg.exe':'ffmpeg'):null;
  return {ffmpeg:overrides.ffmpeg||(sibling&&await fs.stat(sibling).catch(()=>null)?sibling:pathValue(saved.ffmpeg)||'ffmpeg'),whisper:overrides.whisper||pathValue(saved.whisper_cpu)||pathValue(saved.whisper),model:overrides.model||pathValue(saved.model)};
}
async function program(command,args,signal,onData,timeout=15*60*1000,onLog){
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe']}),chunks=[];let size=0,settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve();};
    const abort=()=>{child.kill();finish(problem('分析已取消，已有意见保留。'));};
    const timer=setTimeout(()=>{child.kill();finish(problem('本机分析超时，可以重试；手动标注仍可用。'));},timeout);
    signal.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',data=>{try{onData?.(data);}catch(e){child.kill();finish(e);}});
    child.stderr.on('data',data=>{onLog?.(data.toString());if(size<4096){chunks.push(data);size+=data.length;}});
    child.on('error',()=>finish(problem('本机分析工具不可用，请核对已有 FFmpeg／语音识别工具。')));
    child.on('close',code=>finish(code===0?null:problem(signal.aborted?'分析已取消。':'本机分析未完成，手动播放和标注仍可用。')));
  });
}

export class LocalAnalysis {
  constructor(store,lifetime){this.store=store;this.lifetime=lifetime;this.jobs=new Map();this.tail=Promise.resolve();}
  async folder(){const folder=path.join(this.store.directory,'analysis');await ordinaryDirectory(folder);return folder;}
  async cached(task){try{const value=await readJson(path.join(await this.folder(),`${task.id}.json`),4*1024*1024);return value.fingerprint===task.media.fingerprint?value:null;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  public(job){return {state:job.state,phase:job.phase||'',peaks:job.peaks||[],cues:job.cues||[],waveError:job.waveError||'',transcriptError:job.transcriptError||'',source:job.source||'',durationMs:job.durationMs,fileName:job.fileName||'',startedAt:job.startedAt,updatedAt:job.updatedAt,progress:job.progress??null};}
  async request(query){
    const entry=await this.store.mediaEntry(query.taskId,query.workspaceId),task=await this.store.tasks.read(query.taskId);
    let job=this.jobs.get(task.id);
    if(!job){job={...(await this.cached(task)||{}),state:'idle',durationMs:task.media.durationMs,fingerprint:task.media.fingerprint};this.jobs.set(task.id,job);}
    if(query.action==='status')return this.public(job);
    if(query.action==='cancel'){job.controller?.abort();return this.public(job);}
    if(query.action==='import'){
      if(['queued','running','waiting-resources'].includes(job.state))throw problem('请先停止正在进行的分析，再导入字幕。');
      job.cues=parseSubtitles(query.text,task.media.durationMs);job.source='import';job.fileName=String(query.fileName||'导入字幕').slice(0,255);job.transcriptError='';job.state='ready';await this.persist(task.id,job);return this.public(job);
    }
    if(!['waveform','transcribe'].includes(query.action))throw problem('分析操作无效。');
    if(['queued','running','waiting-resources'].includes(job.state))return this.public(job);
    if(query.action==='waveform'&&job.peaks?.length)return this.public(job);
    if([...this.jobs.values()].filter(j=>['queued','running','waiting-resources'].includes(j.state)).length>=8)throw problem('已有多项素材等待分析，请稍后再试。');
    job.controller=new AbortController();job.state='queued';job.startedAt=new Date().toISOString();job.updatedAt=job.startedAt;job.progress=null;job.phase=query.action;job.waveError='';if(query.action==='transcribe')job.transcriptError='';
    const signal=AbortSignal.any([job.controller.signal,this.lifetime.signal]);
    const run=async()=>{
      try{
        signal.throwIfAborted();while(os.freemem()<512*1024*1024){job.state='waiting-resources';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2000),abort=()=>{clearTimeout(timer);reject(new Error('分析已取消。'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}job.state='running';job.updatedAt=new Date().toISOString();
        const tools=await localTools(typeof this.store.ffprobe==='function'?this.store.ffprobe():this.store.ffprobe,this.store.toolOverrides?.()||{});
        if(!job.peaks?.length){job.phase='waveform';await this.waveform(entry,task,tools,job,signal);await this.store.assertMedia(task.id,query.workspaceId);await this.persist(task.id,job);}
        if(query.action==='transcribe'){job.phase='transcript';job.progress=null;await this.transcribe(entry,task,tools,job,signal);await this.store.assertMedia(task.id,query.workspaceId);}
        job.state='ready';job.phase='';job.progress=100;job.updatedAt=new Date().toISOString();await this.persist(task.id,job);
      }catch(error){job.state=signal.aborted?'cancelled':'error';const message=signal.aborted?'分析已取消。':error.message;if(job.phase==='transcript')job.transcriptError=message;else job.waveError=message;job.phase='';}
      finally{job.controller=null;}
    };
    this.tail=this.tail.then(run,run);return this.public(job);
  }
  async activities(workspaceId){return {items:[...this.jobs.entries()].filter(([id])=>this.store.state.bindings[id]?.workspaceId===workspaceId).map(([taskId,job])=>({taskId,title:this.store.tasks.headers.get(taskId)?.title||taskId,state:job.state,phase:job.phase||'',startedAt:job.startedAt,updatedAt:job.updatedAt}))};}
  async readiness(){
    const probe=typeof this.store.ffprobe==='function'?this.store.ffprobe():this.store.ffprobe,found=await localTools(probe,this.store.toolOverrides?.()||{}),tools=[];
    const ffprobe=probe||(path.isAbsolute(found.ffmpeg)?path.join(path.dirname(found.ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe'):'ffprobe');
    for(const [name,file] of Object.entries({ffprobe,...found})){let ready=false,detail='未配置';if(file){try{if(name==='model'){const stat=await fs.stat(file);ready=stat.isFile()&&stat.size>1024*1024;detail=ready?'模型文件可读':'模型文件无效';}else{const r=await promisify(execFile)(file,[name==='whisper'?'--help':'-version'],{windowsHide:true,timeout:10000,maxBuffer:65536});ready=true;detail=(r.stdout||r.stderr||'可运行').split(/\r?\n/)[0].slice(0,180);}}catch{detail='无法运行或读取';}}tools.push({name,path:file||'',ready,detail});}
    return {version:'0.1.0-rc.6',tools,dataDirectory:this.store.directory};
  }
  async persist(id,job){await atomicJson(path.join(await this.folder(),`${id}.json`),{fingerprint:job.fingerprint,durationMs:job.durationMs,peaks:job.peaks||[],cues:job.cues||[],source:job.source||'',fileName:job.fileName||''});}
  async waveform(entry,task,tools,job,signal){
    const streams=this.store.state.bindings[task.id]?.streams;if(streams?.length&&!streams.some(s=>s.codec_type==='audio')&&streams[0].codec_name!=='browser-verified')throw problem('这份视频没有音轨，仍可按画面和时间标注。');
    const rate=8000,bucket=Math.max(1,Math.ceil(task.media.durationMs/1000*rate/6000)),peaks=[];let sum=0,count=0,total=0,carry=null;
    await program(tools.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-threads','2','-filter_threads','2','-protocol_whitelist','file,pipe','-i',entry.source,'-map','0:a:0','-vn','-ac','1','-ar',String(rate),'-f','s16le','pipe:1'],signal,data=>{
      job.updatedAt=new Date().toISOString();job.progress=Math.min(99,Math.round(total/(task.media.durationMs/1000*rate)*100));
      if(carry!==null){data=Buffer.concat([Buffer.from([carry]),data]);carry=null;}
      if(data.length%2){carry=data[data.length-1];data=data.subarray(0,-1);}
      for(let i=0;i<data.length;i+=2){const value=data.readInt16LE(i)/32768;sum+=value*value;count++;total++;if(count===bucket){peaks.push(Math.sqrt(sum/count));count=0;sum=0;if(peaks.length>6001)throw problem('音轨时长与登记不一致，请核对媒体。');}}
    });
    if(count)peaks.push(Math.sqrt(sum/count));
    if(!total)throw problem('这份作品没有可读取的音轨，仍可按画面和时间标注。');
    const measuredMs=total/rate*1000;
    // Some video containers have a shorter valid audio track. Pad its actual
    // silence; never stretch amplitudes to the video's duration.
    while(peaks.length<Math.ceil(task.media.durationMs/1000*rate/bucket))peaks.push(0);
    job.peaks=peaks;job.waveError='';job.sampleSpanMs=bucket/rate*1000;
  }
  async transcribe(entry,task,tools,job,signal){
    if(task.media.durationMs>30*60*1000)throw problem('超过 30 分钟的作品请导入字幕；波形和手动标注仍可用。');
    if(!tools.whisper||!tools.model)throw problem('本机尚未配置可用的语音识别工具，可先导入 SRT／VTT。');
    for(const file of [tools.whisper,tools.model])if(!(await fs.stat(file).catch(()=>null))?.isFile())throw problem('原有语音识别工具或模型已失效，可先导入字幕。');
    const folder=await this.folder(),prefix=path.join(folder,`transcribe-${randomUUID()}`),wav=prefix+'.wav';
    try{
      await program(tools.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-threads','2','-filter_threads','2','-protocol_whitelist','file,pipe','-i',entry.source,'-map','0:a:0','-vn','-ar','16000','-ac','1','-c:a','pcm_s16le','-fs',String(512*1024*1024),wav],signal);
      if((await fs.stat(wav)).size>=512*1024*1024)throw problem('音轨临时容量达到上限，可改为导入字幕。');
      await program(tools.whisper,['-m',tools.model,'-f',wav,'-l','zh','-t','4','-osrt','-of',prefix,'-ng'],signal,null,30*60*1000,text=>{job.updatedAt=new Date().toISOString();const match=/progress\s*=\s*(\d+)%/.exec(text);if(match)job.progress=Math.min(99,+match[1]);});
      const file=prefix+'.srt';if((await fs.stat(file)).size>2*1024*1024)throw problem('识别结果过大，未覆盖原台词。');
      job.cues=parseSubtitles(await fs.readFile(file,'utf8'),task.media.durationMs);job.source='local';job.fileName='本机识别';job.transcriptError='';
    }finally{for(const file of [wav,prefix+'.srt'])await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }
}
