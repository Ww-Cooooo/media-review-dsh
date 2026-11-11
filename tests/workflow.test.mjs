import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ReviewStore} from './support.mjs';
import {LocalAnalysis} from '../src/analysis.mjs';
import {parseSubtitles,prepareNotes,regionsOf,withRegions} from '../src/subtitles.js';
import {exportReview,readExport} from '../src/export.mjs';
import {proportionalWaveform} from '../src/waveform.js';
const project=path.resolve(import.meta.dirname,'..'),workspace=path.join(project,'fixtures/workspace');
async function setup(source='small-v1.mp4'){
  const directory=path.join(project,'fixtures/contracts',randomUUID());
  const host={targets:async()=>[{id:'w',path:workspace,title:'Workflow test',sessions:[{id:'s',title:'Test'}]}],prompt:async()=>({accepted:true})};
  const store=await new ReviewStore(directory,host).init();
  const task=await store.register({operationId:randomUUID(),workspaceId:'w',sessionId:'s',source:path.join(workspace,source),title:'Workflow test'},null);
  return {directory,host,store,task};
}
test('multiple regional texts survive generated transport shape, fixed snapshot, export and cold restart',async()=>{
  const e=await setup(),notes=prepareNotes([{id:'frame',kind:'modify',startMs:12000,endMs:14000,text:'',regions:[{id:1,rect:{x:.1,y:.2,width:.3,height:.1},text:'字幕变清楚'},{id:3,rect:{x:.6,y:.1,width:.2,height:.3},text:'保留颜色 <script>danger</script>'}],regionSerial:3,priority:'high'}]);
  const current=await e.store.draft(e.task.id),receipt=await e.store.save({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,expectedRevision:current.revision,notes});
  const round=await e.store.freeze({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,sessionId:'s',expectedRevision:receipt.revision,scope:'Only this frame'});
  const edit=structuredClone(notes);edit[0].regions[1].text='Later draft';
  await e.store.save({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,expectedRevision:receipt.revision,notes:edit});
  const cold=await new ReviewStore(e.directory,e.host).init();
  assert.deepEqual((await cold.fixed(round)).record.notes[0].regions,notes[0].regions);
  assert.equal((await cold.draft(e.task.id)).record.notes[0].regions[1].text,'Later draft');
  const archive=await exportReview(cold,{workspaceId:'w',taskId:e.task.id,roundId:round.id}),file=await readExport(cold,e.task.id,'w',archive.id);
  assert.ok(file.bytes.includes(Buffer.from('保留颜色 &lt;script&gt;danger&lt;/script&gt;')));
  assert.ok(!file.bytes.includes(Buffer.from('<script>danger</script></p>')));
  await assert.rejects(()=>readExport(cold,e.task.id,'other',archive.id),{code:'task_denied'});
  assert.throws(()=>prepareNotes([{...notes[0],regions:[{...notes[0].regions[0],text:''}]}]),/补充/);
  const legacy={id:'legacy',kind:'keep',startMs:0,endMs:null,text:'Original text',rect:{x:0,y:0,width:.2,height:.2}};
  assert.deepEqual(prepareNotes([legacy])[0],legacy,'Old single-box records remain intact');
  const moved=withRegions(legacy,regionsOf(legacy).map(r=>({...r,rect:{...r.rect,x:.1}})));
  assert.equal(prepareNotes([moved])[0].regions[0].text,legacy.text,'Moving a legacy box retains its existing instruction without asking for it again');
});
test('no-change completion is explicit, revision guarded, retained after restart and cleared on later edit',async()=>{
  const e=await setup(),before=await e.store.draft(e.task.id);
  const receipt=await e.store.save({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,expectedRevision:before.revision,notes:[],noChanges:true});
  const cold=await new ReviewStore(e.directory,e.host).init();
  assert.equal((await cold.board({workspaceId:'w',taskId:e.task.id})).draft.completion.outcome,'no-changes');
  const note={id:'new',kind:'modify',startMs:1,endMs:null,text:'Now a change is needed',rect:null};
  await assert.rejects(()=>cold.save({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,expectedRevision:receipt.revision,notes:[note],noChanges:true}),{code:'invalid_completion'});
  await cold.save({operationId:randomUUID(),workspaceId:'w',taskId:e.task.id,expectedRevision:receipt.revision,notes:[note]});
  assert.equal((await cold.board({workspaceId:'w',taskId:e.task.id})).draft.completion,null);
});
test('SRT and VTT keep actual time boundaries; malformed/out-of-version files cannot replace cues',()=>{
  assert.deepEqual(parseSubtitles('WEBVTT\n\n00:02.000 --> 00:04.500\n<b>句子</b>',5000),[{id:'1',startMs:2000,endMs:4500,text:'句子'}]);
  assert.equal(parseSubtitles('1\n00:00:01,250 --> 00:00:02,000\n字幕',5000)[0].startMs,1250);
  assert.throws(()=>parseSubtitles('1\n00:00:09,000 --> 00:00:10,000\n错版',5000),/超出/);
  assert.throws(()=>parseSubtitles('No timestamps',5000),/没有读到/);
});
test('real FFmpeg waveform measures strong, weak and silent samples; analysis cache survives reload',async()=>{
  const name=`rms-${randomUUID()}.wav`,rate=8000,samples=rate*3,pcm=Buffer.alloc(samples*2),header=Buffer.alloc(44);
  for(let i=0;i<samples;i++)pcm.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*200)*(i<rate?16000:i<rate*2?4000:0)),i*2);
  header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  await fs.writeFile(path.join(workspace,name),Buffer.concat([header,pcm]));
  const e=await setup(name),service=new LocalAnalysis(e.store,new AbortController()),q={workspaceId:'w',taskId:e.task.id};
  await service.request({...q,action:'waveform'});await service.tail;
  const result=await service.request({...q,action:'status'});assert.equal(result.state,'ready',JSON.stringify(result));assert.equal(result.peaks.length,6000);
  const average=values=>values.reduce((a,b)=>a+b,0)/values.length,strong=average(result.peaks.slice(0,2000)),weak=average(result.peaks.slice(2000,4000));
  assert.ok(strong/weak>3.95&&strong/weak<4.05);assert.equal(Math.max(...result.peaks.slice(4000)),0);
  // Follow the measured audio all the way into the plotted heights. The old
  // square-root "contrast" display turned this 4:1 difference into only 2:1.
  const rows=proportionalWaveform(result.peaks,0,3000,3000,80,600);
  const loud=average(rows.slice(0,200).map(v=>v.upper)),quiet=average(rows.slice(200,400).map(v=>v.upper));
  assert.ok(loud/quiet>3.95&&loud/quiet<4.05);
  assert.equal(Math.max(...rows.slice(400).map(v=>v.upper)),0);
  const taller=proportionalWaveform(result.peaks,0,3000,3000,100,600);
  assert.ok(Math.abs(taller[20].upper/rows[20].upper-1.25)<1e-9);
  const zoomed=proportionalWaveform(result.peaks,1000,2000,3000,80,200);
  assert.deepEqual(zoomed.map(v=>v.upper),rows.slice(200,400).map(v=>v.upper),'Zooming a quiet section must not make it look louder');
  assert.equal(Math.max(...proportionalWaveform([0,0,0],0,3,3).map(v=>v.upper)),0);
  assert.deepEqual(proportionalWaveform([],0,0,0),[]);
  await service.request({...q,action:'import',text:'1\n00:00:00,000 --> 00:00:01,000\n真实时间'});
  await assert.rejects(()=>service.request({...q,action:'import',text:'invalid'}));
  assert.equal((await service.request({...q,action:'status'})).cues[0].text,'真实时间');
  const cold=new LocalAnalysis(e.store,new AbortController()),cached=await cold.request({...q,action:'status'});
  assert.deepEqual(cached.peaks,result.peaks);assert.equal(cached.cues[0].startMs,0);
  await assert.rejects(()=>cold.request({...q,workspaceId:'wrong',action:'waveform'}),{code:'task_denied'});
});
