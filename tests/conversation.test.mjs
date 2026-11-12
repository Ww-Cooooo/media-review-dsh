import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ReviewStore} from './support.mjs';
import {incomingReview,resumeReview} from '../src/conversation-state.js';

test('conversation delivery is session scoped, durable, and unaffected by opening or archiving',async()=>{
  const root=path.resolve(import.meta.dirname,'..'),directory=path.join(root,'fixtures/contracts',randomUUID()),workspace=path.join(root,'fixtures/workspace');
  const host={targets:async()=>[{id:'w1',path:workspace,title:'Fixture',sessions:[{id:'s1'},{id:'s2'}]}]};
  const store=await new ReviewStore(directory,host).init();
  assert.deepEqual((await store.conversation({sessionId:'s1'})).entries,[]);
  const request={operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v1.mp4'),title:'Session one'};
  const first=await store.register(request,{sessionId:'s1'});
  const feed=await store.conversation({sessionId:'s1'});assert.equal(feed.cursor,first.id);assert.equal(feed.entries.length,1);
  assert.deepEqual((await store.conversation({sessionId:'s2'})).entries,[]);
  assert.deepEqual((await store.conversation({sessionId:'missing'})).entries,[]);
  assert.equal(incomingReview(feed,'').id,first.id);assert.equal(incomingReview(feed,first.id),null);
  await store.register(request,{sessionId:'s1'});
  await store.organize({workspaceId:'w1',taskId:first.id,action:'opened'});
  await store.organize({workspaceId:'w1',taskId:first.id,action:'archive'});
  const again=await store.conversation({sessionId:'s1'});assert.equal(again.cursor,feed.cursor);assert.equal(again.entries.length,1);
  const cold=await new ReviewStore(directory,host).init();assert.deepEqual(await cold.conversation({sessionId:'s1'}),again);
  const own={workspaceId:'w1',taskId:first.id,viewTaskId:first.id,selected:'local-note',roundId:null};
  assert.deepEqual(resumeReview(feed,own),own);
  assert.equal(resumeReview(feed,{workspaceId:'elsewhere',taskId:'unrelated'}).id,first.id);
});

test('a returned version opens its frozen review instead of an empty new-version draft',async()=>{
  const root=path.resolve(import.meta.dirname,'..'),workspace=path.join(root,'fixtures/workspace');
  const store=await new ReviewStore(path.join(root,'fixtures/contracts',randomUUID()),{targets:async()=>[{id:'w1',path:workspace,sessions:[{id:'s1'}]}],prompt:async()=>({accepted:true})}).init();
  const first=await store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v1.mp4'),title:'First'},null);
  const b=await store.board({workspaceId:'w1',taskId:first.id});
  const saved=await store.save({operationId:randomUUID(),workspaceId:'w1',taskId:first.id,expectedRevision:b.draft.revision,notes:[{id:'n1',kind:'modify',startMs:1000,endMs:null,text:'Check first second',rect:null}]});
  const round=await store.freeze({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',taskId:first.id,expectedRevision:saved.revision,scope:''});
  await store.send({workspaceId:'w1',roundId:round.id},new AbortController().signal);
  const second=await store.register({operationId:randomUUID(),workspaceId:'w1',sessionId:'s1',source:path.join(workspace,'small-v2.mp4'),title:'Second',previousTaskId:first.id,roundId:round.id,mappings:[{noteId:'n1',startMs:1000,endMs:null}]},{sessionId:'s1'});
  const feed=await store.conversation({sessionId:'s1'}),entry=incomingReview(feed,first.id);
  assert.equal(entry.id,second.id);assert.equal(entry.taskId,first.id);assert.equal(entry.viewTaskId,second.id);assert.equal(entry.roundId,round.id);
});
