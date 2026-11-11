import React from 'react';
import {Button,Empty,Spin} from 'antd';
import {LeftOutlined,RightOutlined,ReloadOutlined,PauseOutlined} from '@ant-design/icons';
import {time} from './viewer.jsx';

export function FrameIndex({url,duration,onSeek,viewRange}){
  const [page,setPage]=React.useState(0),[frames,setFrames]=React.useState([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[retry,setRetry]=React.useState(0),cancel=React.useRef(null),cache=React.useRef(new Map());
  const start=viewRange?.start||0,end=Math.min(duration,viewRange?.end||duration),span=Math.max(1,end-start),interval=Math.max(40,span/12),pages=Math.max(1,Math.ceil(span/(interval*6)));
  React.useEffect(()=>{setPage(0);},[url,start,end]);
  React.useEffect(()=>{cache.current.clear();},[url]);
  React.useEffect(()=>{
    if(!url)return;const controller=new AbortController(),signal=controller.signal;cancel.current=controller;let dead=false;
    const v=document.createElement('video'),canvas=document.createElement('canvas');v.muted=true;v.preload='metadata';setFrames([]);setBusy(true);setError('');
    const ready=event=>new Promise((resolve,reject)=>{const finish=err=>{clearTimeout(timer);v.removeEventListener(event,done);v.removeEventListener('error',fail);signal.removeEventListener('abort',abort);err?reject(err):resolve();},done=()=>finish(),fail=()=>finish(Error('当前文件暂不能生成缩略图。')),abort=()=>finish(Error('已停止，可重试生成。')),timer=setTimeout(()=>finish(Error('画面索引生成超时，可重试。')),8000);v.addEventListener(event,done,{once:true});v.addEventListener('error',fail,{once:true});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
    (async()=>{try{const loaded=ready('loadedmetadata');v.src=url;await loaded;canvas.width=320;canvas.height=Math.max(1,Math.round(320*v.videoHeight/v.videoWidth));for(let i=0;i<6;i++){const ms=Math.min(end-1,Math.round(start+(page*6+i+.5)*interval));if(ms<start||ms>=end||signal.aborted)break;let src=cache.current.get(ms);if(!src){const sought=ready('seeked');v.currentTime=Math.min(ms/1000,Math.max(0,v.duration-.001));await sought;canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);src=canvas.toDataURL('image/jpeg',.7);cache.current.set(ms,src);if(cache.current.size>96)cache.current.delete(cache.current.keys().next().value);}if(!dead)setFrames(old=>[...old,{ms,src}]);}}catch(e){if(!dead)setError(e.message);}finally{v.removeAttribute('src');v.load();if(!dead)setBusy(false);}})();
    return()=>{dead=true;controller.abort();};
  },[url,duration,start,end,page,retry]);
  return <div className="mr-frame-index"><div className="mr-frame-tools"><Button aria-label="上一页画面" icon={<LeftOutlined/>} disabled={!page||busy} onClick={()=>setPage(p=>p-1)}/><span>{page+1} / {pages}</span><Button aria-label="下一页画面" icon={<RightOutlined/>} disabled={page>=pages-1||busy} onClick={()=>setPage(p=>p+1)}/><Button icon={busy?<PauseOutlined/>:<ReloadOutlined/>} onClick={()=>busy?cancel.current?.abort():setRetry(n=>n+1)}>{busy?'停止':'重新生成'}</Button></div><p className="mr-muted">{time(start)} — {time(end)}</p>{busy&&<Spin size="small"/>}{error&&<p role="status">{error}</p>}<div className="mr-frame-grid">{frames.map(f=><button key={f.ms} onClick={()=>onSeek(f.ms)}><img src={f.src} alt={`画面 ${time(f.ms)}`}/><span className="mr-mono">{time(f.ms)}</span></button>)}</div>{!busy&&!frames.length&&!error&&<Empty description="暂无画面"/>}</div>;
}
