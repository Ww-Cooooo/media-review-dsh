import path from 'node:path';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {taskIdentity} from './vendor/review-tasks.mjs';
import {atomicJson,readJson,ordinaryDirectory,ReviewError} from './vendor/runtime.mjs';
import {guardedPath,inspectMedia} from './media.mjs';

const fail=(text,code='editor_required')=>{throw new ReviewError(text,code,409);};
export class Recovery {
  constructor(store){this.store=store;this.leases=new Map();}
  assert(taskId,clientId){const lease=this.leases.get(taskId);if(lease&&lease.until>Date.now()&&lease.clientId!==clientId)fail('这份作品正在另一个窗口编辑。可查看，接管后再修改。');}
  async editor(q){
    await this.store.binding(q.taskId,q.workspaceId);taskIdentity(q.clientId);
    if(!['claim','heartbeat','takeover','release'].includes(q.action))fail('编辑权操作无效。');
    const old=this.leases.get(q.taskId),alive=old&&old.until>Date.now();
    if(q.action==='release'){if(old?.clientId===q.clientId)this.leases.delete(q.taskId);}
    else if(q.action==='takeover'||!alive||old.clientId===q.clientId)this.leases.set(q.taskId,{clientId:q.clientId,until:Date.now()+45000});
    const lease=this.leases.get(q.taskId);return {editable:!!lease&&lease.clientId===q.clientId,expiresAt:lease?new Date(lease.until).toISOString():null};
  }
  async folder(taskId){return ordinaryDirectory(path.join(await this.store.tasks.directoryFor(taskId),'recovery'));}
  async archive(taskId,notes,expectedRevision,kind='saved'){
    const value={id:randomUUID(),kind,notes,expectedRevision,savedAt:new Date().toISOString()};
    await atomicJson(path.join(await this.folder(taskId),`${value.id}.json`),value);return value;
  }
  async request(q){
    await this.store.binding(q.taskId,q.workspaceId);taskIdentity(q.clientId);const folder=await this.folder(q.taskId);
    if(q.action==='list'){
      const entries=await fs.readdir(folder),items=[];
      for(const name of entries.filter(n=>/^(?:current-)?[a-f0-9-]{36}\.json$/.test(n))){const value=await readJson(path.join(folder,name),2*1024*1024);items.push(value);}
      return {items:items.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).slice(0,100)};
    }
    this.assert(q.taskId,q.clientId);
    if(!['backup','archive','clear'].includes(q.action))fail('恢复操作无效。','invalid_recovery');
    const file=path.join(folder,`current-${q.clientId}.json`);
    if(q.action==='clear'){let previous;try{previous=await readJson(file,2*1024*1024);}catch(e){if(e.code!=='ENOENT')throw e;}if(previous){await this.archive(q.taskId,previous.notes,previous.expectedRevision,'replaced');await fs.unlink(file);}return {items:[]};}
    if(!Array.isArray(q.notes)||q.notes.length>500||Buffer.byteLength(JSON.stringify(q.notes))>1024*1024||typeof q.expectedRevision!=='string')fail('草稿过大或格式无效，浏览器输入仍保留。','invalid_recovery');
    for(const note of q.notes){if(!note||typeof note!=='object')fail('草稿格式无效。','invalid_recovery');if(typeof note.id!=='string'||!note.id||note.id.length>120||note.id.includes('\0'))fail('草稿意见编号无效。','invalid_recovery');}
    const value=q.action==='archive'?await this.archive(q.taskId,q.notes,q.expectedRevision,'parked'):{id:q.clientId,kind:'unsaved',notes:q.notes,expectedRevision:q.expectedRevision,savedAt:new Date().toISOString()};
    if(q.action==='backup'){await atomicJson(file,value);const receipt=await readJson(file,2*1024*1024);if(JSON.stringify(receipt)!==JSON.stringify(value))fail('草稿备份回读失败。','backup_failed');}
    return {items:[value]};
  }
  async locations(q){
    await this.store.binding(q.taskId,q.workspaceId);const task=await this.store.tasks.read(q.taskId),scope=await this.store.tasks.scope(q.taskId,task.media.fingerprint),items=[{kind:'record',label:'正式意见',path:scope},{kind:'recovery',label:'草稿与恢复副本',path:await this.folder(q.taskId)},{kind:'reference',label:'参考画面',path:path.join(scope,`${task.media.fingerprint}.references`)}];
    items[2].path=path.join(scope,'references',task.media.fingerprint);if(!(await fs.stat(items[2].path).catch(()=>null))?.isDirectory())items[2].path=scope;
    if(q.open){const selected=items.find(i=>i.kind===q.open);if(!selected)fail('资料位置无效。','invalid_location');await guardedPath(this.store.directory,selected.path);if(process.platform==='win32')await new Promise((resolve,reject)=>{const p=spawn('explorer.exe',[selected.path],{windowsHide:true,stdio:'ignore'});p.once('spawn',resolve);p.once('error',reject);p.unref();});}
    return {items};
  }
  async relink(q,signal){
    const b=await this.store.binding(q.taskId,q.workspaceId);this.assert(q.taskId,q.clientId);
    return this.store.operation(q.operationId,{kind:'relink',...q},async()=>{
      const task=await this.store.tasks.read(q.taskId),media=await inspectMedia(b.workspaceRoot,q.source,typeof this.store.ffprobe==='function'?this.store.ffprobe():this.store.ffprobe,signal);
      if(media.contentHash!==task.contentHash||media.identity.size!==task.media.size)fail('这不是同一份媒体内容。请作为新版登记，原意见未改动。','media_changed');
      // Keep the original review identity. Only the verified source location changes.
      b.allowedRoot=b.workspaceRoot;b.identity=media.identity;b.streams=media.streams;b.source=media.source;
      await this.store.persist();this.store.verifiedMedia.delete(task.id);return this.store.taskView(task.id);
    });
  }
}
