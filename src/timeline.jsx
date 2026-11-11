import React from 'react';
import {Button,Checkbox,Popover,Select,Slider,Tooltip,theme} from 'antd';
import {PlayCircleOutlined,ZoomInOutlined,ZoomOutOutlined,LeftOutlined,RightOutlined,ReloadOutlined} from '@ant-design/icons';
import {Chart} from '@antv/g2';
import {time} from './viewer.jsx';
import {proportionalWaveform} from './waveform.js';

function WavePlot({peaks,start,end,duration,height}){
  const host=React.useRef(null),{token}=theme.useToken(),[failed,setFailed]=React.useState(false);
  const values=React.useMemo(()=>proportionalWaveform(peaks,start,end,duration,height),[peaks,start,end,duration,height]);
  React.useEffect(()=>{
    let chart,dead=false;const node=host.current;setFailed(false);
    const observer=new ResizeObserver(()=>{if(chart||!node.clientWidth||!node.clientHeight||!values.length)return;chart=new Chart({container:node,autoFit:true,height:node.clientHeight});
      const fill=parseInt(token.colorBgContainer.replace('#','').slice(0,2),16)<128?'#66d5bb':token.colorPrimary;
      chart.options({type:'interval',data:values,animate:false,padding:0,margin:0,inset:0,encode:{x:'i',y:'upper',y1:'lower'},scale:{x:{paddingInner:.25,paddingOuter:0},y:{domain:[-1.1,1.1],nice:false}},axis:false,legend:false,interaction:{tooltip:false},style:{fill,lineWidth:0,radius:0}});
      chart.render().catch(()=>{if(!dead)setFailed(true);});});observer.observe(node);
    return()=>{dead=true;observer.disconnect();chart?.destroy();};
  },[values,token.colorPrimary,token.colorBgContainer]);
  return <div className="mr-wave-plot" aria-hidden="true"><div ref={host}/>{failed&&<svg viewBox={`0 0 ${Math.max(1,values.length)*4} 100`} preserveAspectRatio="none">{values.map((v,i)=><rect key={i} x={i*4} y={50-v.upper*45} width="3" height={v.upper*90} fill="currentColor"/>)}</svg>}</div>;
}
export function ReviewTimeline({duration,current,peaks=[],analysis,selection,notes,selected,onSelect,onSeek,onRange,readOnly,onPlayRange,loop,onLoop,pad,onPad,onRetry,playing=false,fineStep=40,onViewport}){
  const [zoom,setZoom]=React.useState(1),[start,setStart]=React.useState(0),[height,setHeight]=React.useState(80),[heightOpen,setHeightOpen]=React.useState(false),[preview,setPreview]=React.useState(null),drag=React.useRef(null),host=React.useRef(null),heightButton=React.useRef(null);
  const [hover,setHover]=React.useState(null),viewport=React.useRef(null);
  const span=duration/zoom,end=Math.min(duration,start+span),range=preview||selection,pct=value=>Math.max(0,Math.min(100,(value-start)/span*100));
  viewport.current={zoom,start,span};
  React.useEffect(()=>{setZoom(1);setStart(0);setPreview(null);},[duration]);
  React.useEffect(()=>{onViewport?.({start,end});},[start,end,onViewport]);
  React.useEffect(()=>{if(playing&&zoom>1&&!drag.current&&current>end)setStart(Math.min(duration-span,Math.max(0,current-span*.2)));},[playing,current,end,span,zoom,duration]);
  React.useEffect(()=>{
    const node=host.current;if(!node||!duration)return;
    const wheel=e=>{if(e.ctrlKey||e.metaKey||drag.current)return;e.preventDefault();e.stopPropagation();
      const box=node.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),v=viewport.current;
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?node.clientHeight:1),next=Math.max(1,Math.min(32,v.zoom*Math.exp(-delta*.002))),point=v.start+v.span*fraction;
      const offset=Math.max(0,Math.min(duration-duration/next,point-duration/next*fraction));
      viewport.current={zoom:next,start:offset,span:duration/next};setZoom(next);setStart(offset);setHover(null);
    };node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
  },[duration]);
  const at=e=>{const box=host.current.getBoundingClientRect();return Math.round(Math.max(start,Math.min(end,start+(e.clientX-box.left)/box.width*span)));};
  const changeZoom=value=>{const next=Math.max(1,Math.min(32,value)),center=(start+end)/2;setZoom(next);setStart(Math.max(0,Math.min(duration-duration/next,center-duration/next/2)));};
  const closeHeight=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setHeightOpen(false);heightButton.current?.focus();}};
  const interval=(gesture,value)=>{
    if(gesture.handle==='start')return {start:Math.min(value,gesture.range.end-1),end:gesture.range.end};
    if(gesture.handle==='end')return {start:gesture.range.start,end:Math.max(value,gesture.range.start+1)};
    if(gesture.handle==='move'){const width=gesture.range.end-gesture.range.start,a=Math.max(0,Math.min(duration-width,gesture.range.start+value-gesture.at));return {start:a,end:a+width};}
    return {start:Math.min(gesture.at,value),end:Math.max(gesture.at,value)};
  };
  return <section className="mr-timeline" aria-label="波形与时间轴">
    <div className="mr-timeline-head"><span className="mr-muted">{readOnly?'点击定位':range?`${time(range.start)} — ${time(range.end)}`:'拖选一段，直接写意见'}</span><div className="mr-timeline-tools">
      <Tooltip title="时间轴向前"><Button size="small" aria-label="时间轴向前" icon={<LeftOutlined/>} disabled={zoom===1||start===0} onClick={()=>setStart(Math.max(0,start-span*.7))}/></Tooltip>
      <Tooltip title="时间轴向后"><Button size="small" aria-label="时间轴向后" icon={<RightOutlined/>} disabled={zoom===1||end>=duration} onClick={()=>setStart(Math.min(duration-span,start+span*.7))}/></Tooltip>
      <Tooltip title="缩小时间轴"><Button size="small" aria-label="缩小时间轴" icon={<ZoomOutOutlined/>} disabled={zoom===1} onClick={()=>changeZoom(zoom/2)}/></Tooltip>
      <Tooltip title="放大时间轴"><Button size="small" aria-label="放大时间轴" icon={<ZoomInOutlined/>} disabled={zoom===32} onClick={()=>{const next=Math.min(32,zoom*2);setZoom(next);setStart(Math.max(0,Math.min(duration-duration/next,current-duration/next/2)));}}/></Tooltip>
      <Tooltip title="在波形上滚轮缩放，鼠标指向的位置保持不动"><span className="mr-zoom-label mr-mono" aria-label="时间轴缩放倍数">{zoom.toFixed(1)}×</span></Tooltip>{zoom>1&&<Button size="small" aria-label="显示完整时间轴" onClick={()=>{setZoom(1);setStart(0);}}>全览</Button>}
      <Popover open={heightOpen} onOpenChange={setHeightOpen} trigger="click" placement="topRight" title="波形缩放" content={<div className="mr-wave-height" onKeyDown={closeHeight}><Slider ariaLabelForHandle="波形显示比例" min={25} max={100} step={5} value={height} onChange={setHeight} tooltip={{formatter:value=>`${value}%`}}/><span className="mr-muted">等比例显示，不改变音量</span></div>}><Button ref={heightButton} size="small" type="text" aria-label="波形缩放" aria-expanded={heightOpen} disabled={!peaks.length} onKeyDown={closeHeight}>波形缩放</Button></Popover>
    </div></div>
    <div ref={host} className="mr-wave" role="slider" tabIndex={0} aria-label="媒体时间轴" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={current} aria-valuetext={time(current)} data-zoom={zoom} data-start={start} data-end={end}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Escape'){drag.current=null;setPreview(null);return;}if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();onSeek(e.key==='Home'?start:e.key==='End'?end:current+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?fineStep:1000));}}}
      onPointerDown={e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();e.currentTarget.focus({preventScroll:true});const handle=e.target.closest('[data-grip]')?.dataset.grip||'';drag.current={id:e.pointerId,x:e.clientX,at:at(e),handle,range:selection};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{const ms=at(e);setHover({ms,rms:peaks[Math.min(peaks.length-1,Math.floor(ms/Math.max(1,duration)*peaks.length))]||0});const g=drag.current;if(!g||g.id!==e.pointerId)return;if(g.handle==='seek'||readOnly){onSeek(ms);return;}if(Math.abs(e.clientX-g.x)>4||g.handle)setPreview(interval(g,ms));}}
      onPointerUp={e=>{const g=drag.current;if(!g||g.id!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);const moved=Math.abs(e.clientX-g.x)>4;if(!moved||g.handle==='seek'||readOnly)onSeek(at(e));else{const r=interval(g,at(e));if(r.end>r.start)onRange(r.start,r.end,!!g.handle);}setPreview(null);}}
      onPointerCancel={()=>{drag.current=null;setPreview(null);}} onPointerLeave={()=>setHover(null)}>
      <WavePlot peaks={peaks} start={start} end={end} duration={duration} height={height}/><span className="mr-wave-center"/>
      {!peaks.length&&<span className="mr-wave-state">{['running','queued','waiting-resources'].includes(analysis?.state)?'正在本机生成波形…':analysis?.waveError||'暂无音轨波形，仍可拖选时间段'}</span>}
      {range&&range.end>start&&range.start<end&&<div className="mr-wave-selection" data-grip={!readOnly?'move':undefined} style={{left:`${pct(range.start)}%`,width:`${pct(range.end)-pct(range.start)}%`}}>{!readOnly&&<><span className="mr-wave-grip" data-grip="start" aria-label="选段起点"/><span className="mr-wave-grip end" data-grip="end" aria-label="选段终点"/></>}</div>}
      {current>=start&&current<=end&&<div className="mr-playhead" data-grip="seek" style={{left:`${pct(current)}%`}} aria-label="播放游标"><span/></div>}
      <div className="mr-wave-notes">{notes.filter(n=>n.startMs!==null&&n.startMs>=start&&n.startMs<=end).map(n=><button key={n.id} aria-label={`定位意见 ${time(n.startMs)} ${n.text.slice(0,30)}`} className={`mr-wave-note ${n.kind}`} data-active={selected===n.id} style={{left:`${pct(n.startMs)}%`}} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect(n.id)}/>)}</div>
      {hover&&!drag.current&&<span className="mr-wave-hover mr-mono" style={{left:`${Math.min(76,pct(hover.ms))}%`}}>{time(hover.ms)} · RMS {hover.rms.toFixed(3)}</span>}
    </div><div className="mr-wave-ticks">{[0,.25,.5,.75,1].map(f=><span key={f} className="mr-mono">{time(start+span*f)}</span>)}</div>
    {selection&&<div className="mr-audition"><Button size="small" aria-label="回放选段" icon={<PlayCircleOutlined/>} onClick={onPlayRange}>回放选段</Button><Select size="small" aria-label="回放前后上下文" value={pad} onChange={onPad} options={[{value:0,label:'仅选段'},{value:500,label:'前后 0.5 秒'},{value:1000,label:'前后 1 秒'},{value:2000,label:'前后 2 秒'}]}/><Checkbox checked={loop} onChange={e=>onLoop(e.target.checked)}>循环</Checkbox></div>}
    {analysis?.waveError&&!peaks.length&&<Button size="small" type="link" icon={<ReloadOutlined/>} onClick={onRetry}>重试波形</Button>}
  </section>;
}
