import React from 'react';
import {Button,Radio,Tag} from 'antd';
import {regionsOf} from './subtitles.js';
import {time} from './viewer.jsx';
function Summary({note}){
  return !note?<p className="mr-muted">这份记录没有此条意见。</p>:<><Tag>{({modify:'修改',keep:'保留',discuss:'讨论'})[note.kind]}</Tag><span className="mr-mono">{note.startMs===null?'整片':time(note.startMs)+(note.endMs!==null?' — '+time(note.endMs):'')}</span><p className="mr-prose">{note.text||'无整条说明'}</p>{note.reference&&<p className="mr-muted">参考帧 {time(note.reference.frameMs)}</p>}{regionsOf(note).map(r=><div className="mr-difference-region" key={r.id}><strong>框 #{r.id}</strong><p className="mr-prose">{r.text||'无单独说明'}</p><small>横 {+(r.rect.x*100).toFixed(1)}% · 纵 {+(r.rect.y*100).toFixed(1)}% · 宽 {+(r.rect.width*100).toFixed(1)}% · 高 {+(r.rect.height*100).toFixed(1)}%</small></div>)}</>;
}
export function NoteDifference({local,saved,onMerge,localLabel='本次输入',savedLabel='已保存内容'}){
  const [choices,setChoices]=React.useState({});
  const ids=[...new Set([...local,...saved].map(n=>n.id))],changed=ids.filter(id=>JSON.stringify(local.find(n=>n.id===id))!==JSON.stringify(saved.find(n=>n.id===id)));
  return <div className="mr-difference"><p className="mr-muted">{changed.length} 条有差异。逐条选择后，仍需保存。</p>{changed.map((id,index)=><section key={id}><div className="mr-detail-actions"><strong>差异 {index+1}</strong><Radio.Group aria-label={'差异 '+(index+1)+' 保留哪份'} value={choices[id]||'local'} onChange={e=>setChoices(old=>({...old,[id]:e.target.value}))}><Radio.Button value="local">{localLabel}</Radio.Button><Radio.Button value="saved">{savedLabel}</Radio.Button></Radio.Group></div><div className="mr-difference-columns"><div><h4>{localLabel}</h4><Summary note={local.find(n=>n.id===id)}/></div><div><h4>{savedLabel}</h4><Summary note={saved.find(n=>n.id===id)}/></div></div></section>)}<Button type="primary" onClick={()=>onMerge(ids.flatMap(id=>{const n=(choices[id]==='saved'?saved:local).find(n=>n.id===id);return n?[n]:[];}))}>采用逐条选择</Button></div>;
}

