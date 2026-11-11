import React from 'react';
import {Button,InputNumber,Checkbox,Alert} from 'antd';
import {UploadOutlined,PlayCircleOutlined,PauseOutlined} from '@ant-design/icons';
import {time} from './viewer.jsx';

// A/B audition uses only user-selected local audio. It never uploads or edits it.
export function AudioCompare({url,duration,current,playing,onPause,onSeek}){
  const input=React.useRef(null),a=React.useRef(null),b=React.useRef(null),request=React.useRef(0);
  const [other,setOther]=React.useState(null),[start,setStart]=React.useState(0),[active,setActive]=React.useState(null),[heard,setHeard]=React.useState(0),[loop,setLoop]=React.useState(false),[error,setError]=React.useState('');
  const stop=()=>{request.current++;a.current?.pause();b.current?.pause();setActive(null);};
  React.useEffect(()=>{stop();setStart(Math.max(0,current-1000));setOther(null);setError('');},[url]);
  React.useEffect(()=>()=>{request.current++;a.current?.pause();b.current?.pause();if(other)URL.revokeObjectURL(other.url);},[other?.url]);
  React.useEffect(()=>{if(playing)stop();},[playing]);
  const common=Math.min(duration,other?.duration||0),end=Math.min(start+8000,common),available=!!other&&end-start>=500;
  const changeStart=value=>{stop();setStart(Math.max(0,Math.min(Math.round((value||0)*1000),common-500)));};
  async function play(side){if(!available)return;stop();onPause();onSeek(start);const id=++request.current,v=side==='A'?a.current:b.current;setError('');try{v.currentTime=start/1000;await v.play();if(id!==request.current){v.pause();return;}setHeard(start);setActive(side);}catch{setError('这份音频暂不能播放，请核对文件格式。');}}
  const update=(side,v)=>{if(active!==side)return;const ms=v.currentTime*1000;if(ms>=end-25){if(loop){v.currentTime=start/1000;v.play().catch(()=>setError('循环试听未能继续。'));setHeard(start);}else{v.pause();setHeard(end);setActive(null);}}else setHeard(ms);};
  return <div className="mr-audio-compare"><p className="mr-prose">同一段，切换听两版的区别。</p><Button icon={<UploadOutlined/>} onClick={()=>input.current.click()}>选择另一版音频</Button>
    <input ref={input} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" hidden aria-label="选择对照音频" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!file.type.startsWith('audio/')&&!/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(file.name)){setError('请选择音频文件。');return;}stop();setError('');setOther({name:file.name,url:URL.createObjectURL(file),duration:0});setStart(Math.max(0,current-1000));}}/>
    {other&&<><p className="mr-prose">A · 当前作品<br/>B · {other.name}</p><label>试听起点 <InputNumber aria-label="对照试听起点" min={0} max={Math.max(0,(common-500)/1000)} step={.1} precision={3} value={start/1000} onChange={changeStart}/></label><Button type="link" size="small" onClick={()=>changeStart(Math.max(0,current-1000)/1000)}>用当前播放点</Button>
    <div className="mr-detail-actions">{['A','B'].map(side=><Button key={side} aria-label={`试听 ${side}`} type={active===side?'primary':'default'} aria-pressed={active===side} disabled={!available} icon={<PlayCircleOutlined/>} onClick={()=>play(side)}>试听 {side}</Button>)}<Button icon={<PauseOutlined/>} aria-label="暂停对照试听" disabled={!active} onClick={stop}/><Checkbox checked={loop} onChange={e=>setLoop(e.target.checked)}>循环</Checkbox></div>
    <p className="mr-muted" role="status">{active?'正在听 '+active+' · '+time(heard):available?time(start)+' — '+time(end):'请将起点移到两份音频共有的范围。'}</p>
    {!!other.duration&&<p className="mr-muted">两版时长相差 {Math.abs(other.duration-duration)/1000} 秒。相同时间点可能不是同一句。</p>}</>}
    {error&&<Alert type="warning" title={error}/>}<p className="mr-muted">只在本机试听；不自动对齐内容或校准响度。</p>
    <audio ref={a} src={url||undefined} preload="metadata" onTimeUpdate={e=>update('A',e.currentTarget)} onEnded={e=>update('A',e.currentTarget)}/>
    {other&&<audio ref={b} src={other.url} preload="metadata" onLoadedMetadata={e=>{const seconds=e.currentTarget.duration;if(Number.isFinite(seconds)&&seconds>0)setOther(old=>({...old,duration:Math.round(seconds*1000)}));else setError('无法读取另一版音频的时长。');}} onTimeUpdate={e=>update('B',e.currentTarget)} onEnded={e=>update('B',e.currentTarget)} onError={()=>setError('另一版音频暂不能播放。')}/>}
  </div>;
}

