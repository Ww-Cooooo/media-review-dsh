import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewFlow,sameReviewNotes} from '../src/review-flow.js';
const task={id:'original'},target={id:'returned'},round={state:'working'};
const changed={latest:{status:'changed',actor:'agent'}},passed={latest:{status:'confirmed',actor:'user'}},declined={latest:{status:'pending',actor:'user'}},waiting={latest:null};
test('reopening matches full note content, preserving unsent priority and regional edits',()=>{
  const fixed=[{id:'a',priority:'normal',regions:[{id:1,text:'原意见',rect:{x:.2,y:.3}}]}];
  assert.ok(sameReviewNotes([{regions:[{rect:{y:.3,x:.2},text:'原意见',id:1}],priority:'normal',id:'a'}],fixed));
  assert.equal(sameReviewNotes([{...fixed[0],priority:'high'}],fixed),false);
  assert.equal(sameReviewNotes([{...fixed[0],regions:[{...fixed[0].regions[0],text:'新意见'}]}],fixed),false);
});
test('an empty draft requires an explicit finish; a finished draft offers a new review',()=>{
  assert.equal(reviewFlow({}).action,'new');
  assert.equal(reviewFlow({task}).action,'finish');
  assert.equal(reviewFlow({task}).stage,0);
  assert.equal(reviewFlow({task,completion:{at:'now'}}).stage,3);
  assert.equal(reviewFlow({task,completion:{at:'now'},notes:[{}]}).action,'send');
});
test('reviewing takes priority over carrying unresolved notes; processing is not an approval',()=>{
  const flow=items=>reviewFlow({task,target,round,frozen:true,items});
  assert.equal(flow([passed,changed,declined]).action,'check');
  assert.equal(flow([passed,waiting,declined]).action,'progress');
  assert.equal(flow([passed,declined]).action,'carry');
  assert.equal(flow([passed,passed]).action,'new');
  assert.equal(flow([passed,passed]).stage,3);
  assert.equal(flow([changed,changed]).complete,false);
});
test('sending, cancellation and returned-version editing remain distinct actions',()=>{
  assert.equal(reviewFlow({task,round:{state:'delivery-failed'},frozen:true}).label,'查看发送情况');
  assert.equal(reviewFlow({task,round:{state:'cancelled'},frozen:true}).action,'draft');
  assert.equal(reviewFlow({task,round,frozen:true,items:[changed]}).action,'progress');
  assert.equal(reviewFlow({task,target,round,items:[passed],notes:[{}]}).action,'send');
});
