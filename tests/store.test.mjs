import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ReviewStore} from './support.mjs';
import {parseRange,streamMedia} from '../src/media.mjs';
const project=path.resolve(import.meta.dirname,'..');
const workspace=path.join(project,'fixtures/workspace');
async function setup(){
  const directory=path.join(project,'fixtures/contracts',randomUUID());
  const calls=new Map();let failReceipt=false;
  const host={targets:async()=>[{id:'w1',path:workspace,title:'Contract fixture',sessions:[{id:'s1',title:'Fixture session'}]}],prompt:async request=>{if(!calls.has(request.requestId))calls.set(request.requestId,request);if(failReceipt){failReceipt=false;throw new Error('simulated lost receipt');}return {accepted:true};}};
  const store=await new ReviewStore(directory,host).init();
  const request={operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v1.mp4'),title:'Contract V1'};
  const task=await store.register(request,null);
  const board=await store.board({workspaceId:'w1',taskId:task.id});
  const notes=[{id:'subtitle',kind:'modify',startMs:12000,endMs:14000,text:'字幕修改',rect:null,priority:'high'},{id:'audio',kind:'modify',startMs:30000,endMs:35000,text:'降低音乐',rect:null,priority:'normal'},{id:'keep',kind:'keep',startMs:0,endMs:5000,text:'保留开头',rect:null,priority:'normal'}];
  const saved=await store.save({operationId:randomUUID(),workspaceId:'w1',taskId:task.id,expectedRevision:board.draft.revision,notes});
  const freeze={operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',taskId:task.id,expectedRevision:saved.revision,scope:'只改指定片段'};
  return {store,directory,host,calls,request,task,notes,saved,freeze,loseReceipt:()=>{failReceipt=true;}};
}
test('frozen round survives newer draft, repeat freeze, lost send receipt and cold restart',async()=>{
  const e=await setup(),round=await e.store.freeze(e.freeze);
  const duplicate=await e.store.freeze(e.freeze);assert.equal(duplicate.id,round.id);
  await assert.rejects(()=>e.store.freeze({...e.freeze,scope:'different'}),{code:'operation_conflict'});
  await e.store.save({operationId:randomUUID(),workspaceId:'w1',taskId:e.task.id,expectedRevision:e.saved.revision,notes:e.notes.map(n=>({...n,text:n.text+'下一轮'}))});
  assert.equal((await e.store.fixed(round)).record.notes[0].text,'字幕修改');
  e.loseReceipt();assert.equal((await e.store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal)).state,'delivery-failed');
  const restarted=await new ReviewStore(e.directory,e.host).init();
  assert.equal((await restarted.send({workspaceId:'w1',roundId:round.id},new AbortController().signal)).state,'delivered');
  await restarted.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);assert.equal(e.calls.size,1);
  assert.equal((await restarted.readRound(round.id,{sessionId:'s1'})).record.notes[0].text,'字幕修改');
});
test('session/workspace boundaries and real later-version/human-only review rules',async()=>{
  const e=await setup(),round=await e.store.freeze(e.freeze);await e.store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);
  await assert.rejects(()=>e.store.readRound(round.id,{sessionId:'s2'}),{code:'session_denied'});
  await assert.rejects(()=>e.store.mediaEntry(e.task.id,'w2'),{code:'task_denied'});
  await assert.rejects(()=>e.store.updateProgress({roundId:round.id,operationId:randomUUID(),noteId:'subtitle',status:'confirmed',text:''},{sessionId:'s1'}),{code:'user_only'});
  await assert.rejects(()=>e.store.updateProgress({roundId:round.id,operationId:randomUUID(),noteId:'subtitle',status:'changed',text:'said done'},{sessionId:'s1'}));
  const accept={roundId:round.id,operationId:randomUUID(),text:'Contract-test actor, not a model'};await e.store.accept(accept,{sessionId:'s1'});await e.store.accept(accept,{sessionId:'s1'});
  const v2=await e.store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v2.mp4'),title:'Contract V2',previousTaskId:e.task.id,roundId:round.id,mappings:[{noteId:'subtitle',startMs:13000,endMs:15000}]},{sessionId:'s1'});
  await e.store.updateProgress({operationId:randomUUID(),roundId:round.id,noteId:'subtitle',status:'changed',text:'Actual fixture referenced',targetTaskId:v2.id,targetMs:13000},{sessionId:'s1'});
  const before=await e.store.board({workspaceId:'w1',taskId:e.task.id});assert.equal(before.items[0].latest.status,'changed');assert.equal(before.items[0].latest.actor,'agent');
  await e.store.userReview({operationId:randomUUID(),workspaceId:'w1',roundId:round.id,noteId:'subtitle',targetTaskId:v2.id,resolved:true,text:'Contract test of user-only method'});
  assert.equal((await e.store.board({workspaceId:'w1',taskId:e.task.id})).items[0].latest.status,'confirmed');
});
test('stale save is rejected; operation identities cannot alias distinct media; missing paths do not erase notes',async()=>{
  const e=await setup();await assert.rejects(()=>e.store.save({operationId:randomUUID(),workspaceId:'w1',taskId:e.task.id,expectedRevision:'stale',notes:[]}),{code:'draft_conflict'});
  await assert.rejects(()=>e.store.register({...e.request,title:'different'},null),{code:'operation_conflict'});
  await assert.rejects(()=>e.store.register({...e.request,operationId:randomUUID(),source:path.join(workspace,'missing.mp4')},null));
  await assert.rejects(()=>e.store.register({...e.request,operationId:randomUUID(),source:'C:/Windows/win.ini'},null),{code:'outside_root'});
  assert.equal((await e.store.board({workspaceId:'w1',taskId:e.task.id})).draft.notes.length,3);
});
test('single ranges have precise boundaries and malformed/multiple ranges are rejected',()=>{
  assert.deepEqual(parseRange('bytes=-10',5),{start:0,end:4,status:206});assert.equal(parseRange('bytes=-0',5),null);assert.equal(parseRange('bytes=5-',5),null);assert.equal(parseRange('bytes=4-2',5),null);assert.equal(parseRange('bytes=0-1,3-4',5),null);assert.deepEqual(parseRange('bytes=2-99',5),{start:2,end:4,status:206});
});

test('identical media restored from backup retains review records; changed bytes remain rejected',async()=>{
  const e=await setup(),source=path.join(workspace,`restore-${randomUUID()}.mp4`);
  const bytes=await fs.readFile(path.join(workspace,'small-v1.mp4'));await fs.writeFile(source,bytes);
  const task=await e.store.register({...e.request,operationId:randomUUID(),source},null);
  const draft=await e.store.draft(task.id);
  await e.store.save({operationId:randomUUID(),workspaceId:'w1',taskId:task.id,expectedRevision:draft.revision,notes:e.notes});
  const original=e.store.state.bindings[task.id].identity;
  await fs.writeFile(source,bytes);await fs.utimes(source,new Date(),new Date(original.mtimeMs+2000));
  const entry=await e.store.mediaEntry(task.id,'w1');assert.notDeepEqual(entry.identity,original);
  const response=await streamMedia(new Request('http://localhost/media',{headers:{range:'bytes=0-31'}}),entry,new Set(),new AbortController().signal);
  assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(0,32));
  const altered=Buffer.from(bytes);altered[altered.length-1]^=1;await fs.writeFile(source,altered);
  await assert.rejects(()=>e.store.mediaEntry(task.id,'w1'),{code:'media_changed'});
  assert.equal((await e.store.draft(task.id)).record.notes.length,3);
  await fs.writeFile(source,bytes);
  const cold=await new ReviewStore(e.directory,e.host).init();await cold.assertMedia(task.id,'w1');
  assert.equal((await cold.draft(task.id)).record.notes.length,3);
});
test('separate rounds never inherit processing or human approval from identical note content',async()=>{
  const e=await setup(),r1=await e.store.freeze(e.freeze);
  assert.equal((await e.store.freeze({...e.freeze,operationId:randomUUID()})).id,r1.id,'equivalent rapid submissions coalesce');
  await e.store.send({workspaceId:'w1',roundId:r1.id},new AbortController().signal);
  const v2=await e.store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v2.mp4'),title:'V2',previousTaskId:e.task.id,roundId:r1.id,mappings:[]},{sessionId:'s1'});
  await e.store.updateProgress({operationId:randomUUID(),roundId:r1.id,noteId:'subtitle',status:'changed',text:'Contract result',targetTaskId:v2.id},{sessionId:'s1'});
  await e.store.userReview({operationId:randomUUID(),workspaceId:'w1',roundId:r1.id,noteId:'subtitle',targetTaskId:v2.id,resolved:true,text:'Contract approval'});
  const r2=await e.store.freeze({...e.freeze,operationId:randomUUID(),scope:'另一个明确范围'});
  assert.equal(r1.revision,r2.revision);assert.equal(r2.number,2);
  assert.equal((await e.store.board({workspaceId:'w1',taskId:e.task.id,roundId:r2.id})).items[0].latest,null);
  await e.store.send({workspaceId:'w1',roundId:r2.id},new AbortController().signal);
  await assert.rejects(()=>e.store.updateProgress({operationId:randomUUID(),roundId:r2.id,noteId:'subtitle',status:'changed',text:'Wrong round artifact',targetTaskId:v2.id},{sessionId:'s1'}),{code:'version_conflict'});
  await assert.rejects(()=>e.store.updateProgress({operationId:randomUUID(),roundId:r1.id,noteId:'subtitle',status:'changed',text:'Cannot erase human review',targetTaskId:v2.id},{sessionId:'s1'}),{code:'review_started'});
});
test('next round carries only unresolved items to mapped new times and preserves existing new-version notes',async()=>{
  const e=await setup(),round=await e.store.freeze(e.freeze);await e.store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);
  let v2=await e.store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v2.mp4'),title:'V2',previousTaskId:e.task.id,roundId:round.id,mappings:[{noteId:'subtitle',startMs:13000,endMs:15000},{noteId:'keep',startMs:0,endMs:5000}]},{sessionId:'s1'});
  await e.store.updateProgress({operationId:randomUUID(),roundId:round.id,noteId:'subtitle',status:'changed',text:'Contract result',targetTaskId:v2.id},{sessionId:'s1'});
  await e.store.userReview({operationId:randomUUID(),workspaceId:'w1',roundId:round.id,noteId:'subtitle',targetTaskId:v2.id,resolved:true,text:''});
  let draft=await e.store.draft(v2.id);
  const extra={id:'new-note',kind:'discuss',startMs:1000,endMs:null,text:'新版新增观察',rect:null};
  const saved=await e.store.save({operationId:randomUUID(),workspaceId:'w1',taskId:v2.id,expectedRevision:draft.revision,notes:[extra]});
  const carry={operationId:randomUUID(),workspaceId:'w1',roundId:round.id,targetTaskId:v2.id,expectedRevision:saved.revision};
  await assert.rejects(()=>e.store.carry(carry),{code:'mapping_required'});
  v2=await e.store.mapping({operationId:randomUUID(),workspaceId:'w1',roundId:round.id,taskId:v2.id,expectedRevision:v2.mappingRevision,noteId:'audio',startMs:25000,endMs:30000});
  const receipt=await e.store.carry(carry);assert.equal((await e.store.carry(carry)).revision,receipt.revision);
  draft=await e.store.draft(v2.id);assert.deepEqual(draft.record.notes.map(n=>n.id),['new-note','audio','keep']);assert.equal(draft.record.notes[1].startMs,25000);
  const next=await e.store.freeze({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',taskId:v2.id,expectedRevision:receipt.revision,scope:'继续处理未解决项'});assert.equal(next.number,2);
});
test('cold recovery completes a draft interrupted between canonical content and metadata receipt',async()=>{
  const e=await setup();
  const request={operationId:randomUUID(),workspaceId:'w1',taskId:e.task.id,expectedRevision:e.saved.revision,notes:e.notes.map(n=>({...n,text:n.text+'中断保存',priority:'high'}))};
  const persist=e.store.persist.bind(e.store);let calls=0;e.store.persist=async()=>{if(++calls===2)throw new Error('simulated disk failure after draft write');return persist();};
  await assert.rejects(()=>e.store.save(request));
  const restored=await new ReviewStore(e.directory,e.host).init(),receipt=await restored.save(request);
  const board=await restored.board({workspaceId:'w1',taskId:e.task.id});assert.equal(board.draft.revision,receipt.revision);assert.ok(board.draft.notes.every(n=>n.text.endsWith('中断保存')&&n.priority==='high'));
});
test('all passed ends a review without creating an empty follow-up or erasing new-version notes',async()=>{
  const e=await setup(),round=await e.store.freeze(e.freeze);await e.store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);
  const v2=await e.store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v2.mp4'),title:'V2',previousTaskId:e.task.id,roundId:round.id,mappings:[]},{sessionId:'s1'});
  for(const note of e.notes){
    await e.store.updateProgress({operationId:randomUUID(),roundId:round.id,noteId:note.id,status:'changed',text:'Contract result',targetTaskId:v2.id},{sessionId:'s1'});
    await e.store.userReview({operationId:randomUUID(),workspaceId:'w1',roundId:round.id,noteId:note.id,targetTaskId:v2.id,resolved:true,text:''});
  }
  const draft=await e.store.draft(v2.id);
  const receipt=await e.store.save({operationId:randomUUID(),workspaceId:'w1',taskId:v2.id,expectedRevision:draft.revision,notes:[{id:'supplement',kind:'modify',startMs:0,endMs:null,text:'A later observation',rect:null}]});
  await assert.rejects(()=>e.store.carry({operationId:randomUUID(),workspaceId:'w1',roundId:round.id,targetTaskId:v2.id,expectedRevision:receipt.revision}),{code:'nothing_to_carry'});
  const after=await e.store.draft(v2.id);assert.equal(after.revision,receipt.revision);assert.equal(after.record.notes[0].text,'A later observation');
  assert.equal((await e.store.board({workspaceId:'w1',taskId:e.task.id})).rounds[0].state,'reviewed');
});
test('cancellation removes only the exact queued request and never silently cancels another running task',async()=>{
  const e=await setup(),round=await e.store.freeze(e.freeze);await e.store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);
  const removed=[];e.host.sessionState=async()=>({active:true,running:true,queue:[{id:'unrelated',rpcId:'other'},{id:'ours',rpcId:round.id}]});e.host.removeQueued=async q=>{removed.push(q.itemId);return {accepted:true};};
  assert.equal((await e.store.cancel({workspaceId:'w1',roundId:round.id})).state,'cancelled');assert.deepEqual(removed,['ours']);
  await assert.rejects(()=>e.store.readRound(round.id,{sessionId:'s1'}),{code:'round_inactive'});
  const next=await e.store.freeze({...e.freeze,operationId:randomUUID()});await e.store.send({workspaceId:'w1',roundId:next.id},new AbortController().signal);
  e.host.sessionState=async()=>({active:true,running:true,queue:[]});let stopped=0;e.host.stopSession=async()=>{stopped++;};
  await assert.rejects(()=>e.store.cancel({workspaceId:'w1',roundId:next.id}),{code:'confirm_session_stop'});assert.equal(stopped,0);
  assert.equal((await e.store.cancel({workspaceId:'w1',roundId:next.id,stopSession:true})).state,'cancel-requested');assert.equal(stopped,1);
  e.host.sessionState=async()=>({active:true,running:false,queue:[]});
  assert.equal((await e.store.board({workspaceId:'w1',taskId:e.task.id})).rounds.find(r=>r.id===next.id).state,'cancelled');
  assert.equal(stopped,1,'status refresh must not stop another task');
});
