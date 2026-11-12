import type { Context } from '@deepseek-ai/cordis';
import { Remote, bindTypertRemote, principalOf, RemoteError } from '@deepseek-ai/dsh-typert-protocol';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-client-connection';
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-workspace';
import type {} from '@deepseek-ai/dsh-config-editor';
import z from '@deepseek-ai/schemastery';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionPromptRequest,SessionUpdateQueueRequest } from '@deepseek-ai/dsh-api-session-controller/types';
type SessionId=SessionPromptRequest['sessionId'];
import { ReviewStore } from './store.mjs';
import { streamMedia } from './media.mjs';
import { LocalAnalysis } from './analysis.mjs';
import { Inspections } from './inspection.mjs';
import { ToolPreparation } from './tool-preparation.mjs';
import { exportReview,readExport } from './export.mjs';
import type * as T from './types.ts';

declare module '@deepseek-ai/cordis' { interface Context { eh3MediaReview: MediaReviewService } }
declare module '@deepseek-ai/dsh-typert-protocol' {interface RemoteErrorDetailsMap {'eh3-media-review/rejected':{reason:string}}}
export interface MediaReviewConfig { dataDirectory:string;ffprobe:{get():string|undefined};ffmpeg?:{get():string|undefined};whisper?:{get():string|undefined};model?:{get():string|undefined} }
export const Config=z.object({dataDirectory:z.string().required().description('审片记录保存目录'),ffprobe:z.string().description('已安装的 ffprobe 完整路径；留空则自动查找').volatile(),ffmpeg:z.string().description('已安装的 FFmpeg 路径').volatile(),whisper:z.string().description('已安装的 Whisper 路径').volatile(),model:z.string().description('已有 Whisper 模型文件路径').volatile()});
export const inject=['connection','tools','workspaceRegistry','sessionController'];
export class MediaReviewService {
  readonly typertRemote=bindTypertRemote(this,'eh3MediaReview');
  readonly store:any;
  readonly lifetime:AbortController=new AbortController();
  readonly activeStreams:Set<import('node:fs').ReadStream>=new Set();
  readonly analysisJobs:any;
  readonly inspections:any;
  readonly preparation:any;
  constructor(readonly ctx:Context,readonly config:MediaReviewConfig){
    this.store=new ReviewStore(config.dataDirectory,{
      targets:async()=>{
        const list=await ctx.sessionController.list({},this.lifetime.signal);
        const rows=new Map(list.items.map(row=>[row.sessionId,row]));
        return ctx.workspaceRegistry.list().map(w=>({id:w.id,title:w.title,path:w.path,sessions:w.sessionIds.filter(id=>!ctx.workspaceRegistry.archivedSessionIds.includes(id)).map(id=>{
          const title=(rows.get(id)?.projections?.values as Record<string,unknown>|undefined)?.title;
          return {id,title:typeof title==='string'?title:`会话 ${id.replace(/^session-/,'').slice(0,8)}`};
        })}));
      },
      prompt:(request:SessionPromptRequest,signal:AbortSignal)=>ctx.sessionController.prompt(request,signal),
      sessionState:(sessionId:SessionId)=>ctx.sessionController.state({sessionId},this.lifetime.signal),
      removeQueued:(request:SessionUpdateQueueRequest)=>ctx.sessionController.updateQueue(request),
      stopSession:(sessionId:SessionId)=>ctx.sessionController.cancel({sessionId}),
    },{ffprobe:()=>config.ffprobe.get()||this.store?.managedTools?.ffprobe});
    this.store.explicitTools=()=>({ffprobe:config.ffprobe.get(),ffmpeg:config.ffmpeg?.get(),whisper:config.whisper?.get(),model:config.model?.get()});
    this.store.toolOverrides=()=>Object.fromEntries(['ffmpeg','whisper','model'].map(key=>[key,this.store.explicitTools()[key]||this.store.managedTools?.[key]]));
    this.analysisJobs=new LocalAnalysis(this.store,this.lifetime);
    this.inspections=new Inspections(this.store,this.lifetime);
    this.preparation=new ToolPreparation(this.store,this.analysisJobs,this.lifetime);
  }
  async init():Promise<void>{await this.store.init();await this.preparation.init();}
  dispose():void{this.lifetime.abort();for(const stream of this.activeStreams)stream.destroy();}
  private owner(){if(principalOf(this.ctx.invocation))throw new RemoteError('eh3-media-review/rejected','仅本机所有者可操作审片台',{reason:'owner_required'});}
  private async run<V>(work:()=>Promise<V>):Promise<V>{
    this.owner();
    try{return await work();}catch(error){
      if(error&&typeof error==='object'&&('status' in error||error.constructor.name==='RecordValidationError'))throw new RemoteError('eh3-media-review/rejected',String((error as Error).message),{reason:'code' in error?String(error.code):'invalid_record'});
      throw error;
    }
  }
  @Remote async status():Promise<T.ConnectionReceipt>{return {schemaVersion:1,installedAt:this.store.state.installedAt,service:'eh3-media-review',phase:'review',persisted:true};}
  @Remote async configuration():Promise<T.Configuration>{return this.run(async()=>({dataDirectory:this.store.directory,ffprobe:this.config.ffprobe.get()||'',ffmpeg:this.config.ffmpeg?.get()||'',whisper:this.config.whisper?.get()||'',model:this.config.model?.get()||''}));}
  @Remote async configure(request:T.ConfigurationRequest):Promise<T.Saved>{return this.run(async()=>{
    const probe=request.ffprobe.trim();
    if(probe&&(probe.length>2048||!path.isAbsolute(probe)||!(await stat(probe).catch(()=>null))?.isFile()))throw new RemoteError('eh3-media-review/rejected','程序路径无效，请填写已安装的 ffprobe 完整路径',{reason:'invalid_probe'});
    const values:Record<string,string>={ffprobe:probe};for(const key of ['ffmpeg','whisper','model'] as const){if(request[key]===undefined)continue;const file=request[key]!.trim();if(file&&(file.length>2048||!path.isAbsolute(file)||!(await stat(file).catch(()=>null))?.isFile()))throw new RemoteError('eh3-media-review/rejected','工具或模型路径无效',{reason:'invalid_tool'});values[key]=file;}
    const entry=this.ctx.fiber.entry,editor=this.ctx.get('configEditor');
    if(!entry||!editor)throw new RemoteError('eh3-media-review/rejected','当前环境不能保存设置',{reason:'configuration_unavailable'});
    await editor.edit(entry,current=>({...current,...values}));
    return {saved:true};
  });}
  @Remote async probe(request:T.ProbeRequest):Promise<T.ProbeReceipt>{return {...request,accepted:true};}
  @Remote async board(query:T.BoardQuery):Promise<T.Board>{return this.run(()=>this.store.board(query));}
  @Remote async conversation(query:T.ConversationQuery):Promise<T.ConversationReview>{return this.run(()=>this.store.conversation(query));}
  @Remote async browse(query:T.BrowseRequest):Promise<T.BrowseResult>{return this.run(()=>this.store.browse(query));}
  @Remote async register(request:T.Registration,signal:AbortSignal):Promise<T.MediaTask>{return this.run(async()=>{const task=await this.store.register(request,null,AbortSignal.any([signal,this.lifetime.signal]));await this.inspections.request({workspaceId:request.workspaceId,taskId:task.id,action:'start'}).catch(()=>{});return task;});}
  @Remote async save(request:T.DraftRequest):Promise<T.SaveReceipt>{return this.run(()=>this.store.save(request));}
  @Remote async freeze(request:T.FreezeRequest):Promise<T.Round>{return this.run(()=>this.store.freeze(request));}
  @Remote async send(request:T.RoundRequest,signal:AbortSignal):Promise<T.Round>{return this.run(()=>this.store.send(request,AbortSignal.any([signal,this.lifetime.signal])));}
  @Remote async cancel(request:T.CancellationRequest):Promise<T.Round>{return this.run(()=>this.store.cancel(request));}
  @Remote async mapping(request:T.MappingRequest):Promise<T.MediaTask>{return this.run(()=>this.store.mapping(request));}
  @Remote async carry(request:T.CarryRequest):Promise<T.CarryReceipt>{return this.run(()=>this.store.carry(request));}
  @Remote async userReview(request:T.UserReviewRequest):Promise<T.Recorded>{return this.run(()=>this.store.userReview(request));}
  @Remote async manualProgress(request:T.ManualProgressRequest):Promise<T.Recorded>{return this.run(()=>this.store.manualProgress(request));}
  @Remote async reference(request:T.ReferenceRequest):Promise<T.Reference>{return this.run(()=>this.store.reference(request));}
  @Remote async playback(request:T.PlaybackRequest):Promise<T.Saved>{return this.run(()=>this.store.preferences(request));}
  @Remote async analysis(request:T.AnalysisRequest):Promise<T.AnalysisResult>{return this.run(()=>this.analysisJobs.request(request));}
  @Remote async organize(request:T.OrganizeRequest):Promise<T.MediaTask>{return this.run(()=>this.store.organize(request));}
  @Remote async editor(request:T.EditorRequest):Promise<T.EditorReceipt>{return this.run(()=>this.store.recovery.editor(request));}
  @Remote async recovery(request:T.RecoveryRequest):Promise<T.RecoveryReceipt>{return this.run(()=>this.store.recovery.request(request));}
  @Remote async locations(request:T.LocationsRequest):Promise<T.Locations>{return this.run(()=>this.store.recovery.locations(request));}
  @Remote async relink(request:T.RelinkRequest,signal:AbortSignal):Promise<T.MediaTask>{return this.run(()=>this.store.recovery.relink(request,AbortSignal.any([signal,this.lifetime.signal])));}
  @Remote async readiness():Promise<T.Readiness>{return this.run(()=>this.analysisJobs.readiness());}
  @Remote async prepareTools(request:T.PreparationRequest):Promise<T.PreparationResult>{return this.run(async()=>this.preparation.request(request));}
  @Remote async activities(request:T.ActivityQuery):Promise<T.Activities>{return this.run(()=>this.analysisJobs.activities(request.workspaceId));}
  @Remote async inspection(request:T.InspectionRequest):Promise<T.InspectionResult>{return this.run(()=>this.inspections.request(request));}
  @Remote async checks(request:T.CheckQuery):Promise<T.CheckReports>{return this.run(()=>this.store.checks(request));}
  @Remote async handoff(request:T.RoundRequest):Promise<T.HandoffReceipt>{return this.run(()=>this.store.copyHandoff(request));}
  @Remote async exportBundle(request:T.ExportRequest):Promise<T.ExportReceipt>{return this.run(()=>exportReview(this.store,request));}
}
const str={type:'string',required:true} as const;
const actor=(exec:ToolRunContext)=>{if(!exec.agent)throw new Error('Media Review requires an executing Harness session');return {sessionId:exec.agent.session.id};};
export async function apply(ctx:Context,config:MediaReviewConfig):Promise<void>{
  const service=new MediaReviewService(ctx,config);await service.init();ctx.provide('eh3MediaReview',service);
  ctx.effect(()=>()=>service.dispose());
  const assetsDirectory=path.join(path.dirname(fileURLToPath(import.meta.url)),'assets');
  const assets=new Set((await readdir(assetsDirectory).catch(()=>[])).filter(name=>/^[a-z0-9-]+\.woff2$/.test(name)));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/eh3-media-review/asset',methods:['GET','HEAD'],requestBody:'buffered',async fetch(request){
    const name=new URL(request.url).searchParams.get('file');if(!name||!assets.has(name))return new Response(null,{status:404});
    const bytes=await readFile(path.join(assetsDirectory,name));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':'font/woff2','Content-Length':String(bytes.length),'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/eh3-media-review/media',methods:['GET','HEAD'],requestBody:'buffered',async fetch(request){
    try {
      const u=new URL(request.url);if([...u.searchParams.keys()].some(k=>!['task','workspace'].includes(k)))return new Response('Unsupported media query',{status:400});
      const entry=await service.store.mediaEntry(u.searchParams.get('task'),u.searchParams.get('workspace'),AbortSignal.any([request.signal,service.lifetime.signal]));
      return await streamMedia(request,entry,service.activeStreams,service.lifetime.signal);
    }catch(error){const e=error as Error&{status?:number};return new Response(e.status?e.message:'媒体暂不可读；原文件和意见保留',{status:e.status||404,headers:{'Cache-Control':'no-store','Content-Type':'text/plain;charset=utf-8'}});}
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/eh3-media-review/reference',methods:['GET','HEAD'],requestBody:'buffered',async fetch(request){
    try{const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['task','workspace','file'].includes(k)))return new Response(null,{status:400});
      const image=await service.store.referenceImage(q.get('task'),q.get('workspace'),q.get('file'));
      return new Response(request.method==='HEAD'?null:image.bytes,{headers:{'Content-Type':'image/jpeg','Content-Length':String(image.bytes.length),'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
    }catch{return new Response(null,{status:404});}
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/eh3-media-review/export',methods:['GET','HEAD'],requestBody:'buffered',async fetch(request){
    try{const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['task','workspace','id'].includes(k)))return new Response(null,{status:400});
      const result=await readExport(service.store,q.get('task'),q.get('workspace'),q.get('id'));
      return new Response(request.method==='HEAD'?null:result.bytes,{headers:{'Content-Type':'application/zip','Content-Length':String(result.bytes.length),'Content-Disposition':`attachment; filename="${result.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }catch(error){const e=error as Error&{status?:number};return new Response(null,{status:e.status||404});}
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/eh3-media-review/inspection-frame',methods:['GET','HEAD'],requestBody:'buffered',async fetch(request){
    try{const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['task','workspace','file'].includes(k)))return new Response(null,{status:400});const bytes=await service.inspections.frame(q.get('task'),q.get('workspace'),q.get('file'));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':'image/jpeg','Content-Length':String(bytes.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch{return new Response(null,{status:404});}
  }}));
  const output={schema:{type:'json'} as const,render:(_args:unknown,value:unknown)=>[{type:'text' as const,text:JSON.stringify(value)}]};
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_read_round',description:'Read the immutable Media Review round assigned to this executing session, including source media, scope, keep requests and fixed annotations. Never read a newer draft instead.',parameters:{roundId:str},output,execute:async(args,exec)=>service.store.readRound(args.roundId,actor(exec))})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_accept',description:'Acknowledge that this session has read and accepted its frozen Media Review round. Does not claim repair or human approval.',parameters:{operationId:str,roundId:str,text:str,clarifications:{type:'array',items:{type:'string'}}},output,execute:async(args,exec)=>service.store.accept(args,actor(exec))})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_register',description:'Register a real playable local media file in the current session workspace. Keep the original file. For a repair, provide previousTaskId and assigned roundId, plus actual new segment mappings. UUID operationId is stable across retries.',parameters:{operationId:str,workspaceId:str,sessionId:str,source:str,title:str,allowedRoot:{type:'string'},previousTaskId:{type:'string'},roundId:{type:'string'},mappings:{type:'array',items:{type:'object',additionalProperties:false,properties:{noteId:str,startMs:{type:'integer',required:true},endMs:{oneOf:[{type:'integer'},{type:'null'}],required:true}}}}},output,execute:async(args,exec)=>{const task=await service.store.register(args,actor(exec),AbortSignal.any([exec.signal,service.lifetime.signal]));await service.inspections.request({workspaceId:args.workspaceId,taskId:task.id,action:'start'}).catch(()=>{});return task;}})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_progress',description:'Record handling of one exact frozen note. changed requires a real registered later version. Include evidence and verify keep items. Cannot approve on behalf of the human.',parameters:{operationId:str,roundId:str,noteId:str,status:{type:'string',enum:['pending','clarify','changed'],required:true},text:str,targetTaskId:{type:'string'},targetMs:{type:'integer'}},output,execute:async(args,exec)=>service.store.updateProgress(args,actor(exec))})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_status',description:'Read status of a frozen review round assigned to this session.',parameters:{roundId:str},output,execute:async(args,exec)=>(await service.store.readRound(args.roundId,actor(exec))).round})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_inspection',description:'Start or read local technical checks for a registered media file owned by this session: full decode, black/silence clues and representative frames. This does not establish that you watched or listened, or human approval. Returned frame filenames can be read in the task inspection directory.',parameters:{workspaceId:str,taskId:str,action:{type:'string',enum:['start','status','cancel'],required:true},points:{type:'array',items:{type:'integer'}}},output,execute:async(args,exec)=>{const b=await service.store.binding(args.taskId,args.workspaceId);if(b.sessionId!==actor(exec).sessionId)throw Error('Task belongs to another session');const result=await service.inspections.request(args);return {...result,directory:await service.inspections.folder(args.taskId)};}})));
  ctx.effect(()=>ctx.tools.register(defineTool({name:'eh3_media_review_check',description:'Record actual viewing/listening coverage of a registered version, findings, unverified aspects and checks of keep notes. Never equate decode success with audiovisual review, or claim human approval. Use checked only after actually inspecting the specified interval/aspect.',parameters:{operationId:str,workspaceId:str,taskId:str,coverage:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{startMs:{type:'integer',required:true},endMs:{type:'integer',required:true},aspects:{type:'array',required:true,items:{type:'string',enum:['visual','audio','subtitle','pace']}},result:{type:'string',required:true,enum:['checked','issue','unverified']},detail:str}}},keptNotes:{type:'array',items:{type:'object',additionalProperties:false,properties:{taskId:str,recordRevision:str,noteId:str,result:{type:'string',required:true,enum:['checked','issue','unverified']},detail:str}}},findings:{type:'string'},notVerified:{type:'string'}},output,execute:async(args,exec)=>service.store.checkReport(args,actor(exec))})));

}
