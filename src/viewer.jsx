import React from 'react';
import { Canvas, Rect } from 'fabric';
import { Chart } from '@antv/g2';
import { ReactLenis } from 'lenis/react';
import {gsap} from 'gsap';
import {theme} from 'antd';
export const time=(ms,precise=true)=>{const safe=Math.max(0,Math.round(ms||0)),s=Math.floor(safe/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}${precise?'.'+String(safe%1000).padStart(3,'0'):''}`;};
export function useReducedMotion(){const [reduced,set]=React.useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);React.useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),changed=()=>set(m.matches);m.addEventListener('change',changed);return()=>m.removeEventListener('change',changed);},[]);return reduced;}
export function OpinionScroll({children,reduced}){
  const ref=React.useRef(null);
  React.useEffect(()=>{const update=t=>{if(!document.hidden)ref.current?.lenis?.raf(t*1000);};gsap.ticker.add(update);return()=>gsap.ticker.remove(update);},[]);
  return <ReactLenis ref={ref} className="mr-opinion-scroll" options={{autoRaf:false,smoothWheel:!reduced,duration:.65,prevent:node=>!!node.closest('textarea,input,[role=dialog]')}}>{children}</ReactLenis>;
}
export function RegionLayer({rect,editable,onChange,video,selection}) {
  const element=React.useRef(null),box=React.useRef(null),fabric=React.useRef(null),callback=React.useRef(onChange);callback.current=onChange;
  const [size,setSize]=React.useState({width:0,height:0,left:0,top:0});
  React.useEffect(()=>{
    const parent=box.current.parentElement;
    const measure=()=>{const v=video.current;if(!v||!v.videoWidth)return;const scale=Math.min(parent.clientWidth/v.videoWidth,parent.clientHeight/v.videoHeight);setSize({width:v.videoWidth*scale,height:v.videoHeight*scale,left:(parent.clientWidth-v.videoWidth*scale)/2,top:(parent.clientHeight-v.videoHeight*scale)/2});};
    const ro=new ResizeObserver(measure);ro.observe(parent);video.current?.addEventListener('loadedmetadata',measure);measure();return()=>{ro.disconnect();video.current?.removeEventListener('loadedmetadata',measure);};
  },[video,selection]);
  React.useEffect(()=>{const c=new Canvas(element.current,{selection:false,renderOnAddRemove:true});fabric.current=c;
    const follow=({target})=>{if(!target)return;const back=c.getObjects()[0];if(back&&back!==target){back.set({left:target.left-2,top:target.top-2,width:target.width,height:target.height,scaleX:target.scaleX,scaleY:target.scaleY});back.setCoords();}};
    const changed=({target})=>{if(!target)return;const w=c.getWidth(),h=c.getHeight(),x=Math.max(0,Math.min(.999,target.left/w)),y=Math.max(0,Math.min(.999,target.top/h));callback.current?.({x,y,width:Math.max(.001,Math.min(1-x,target.width*target.scaleX/w)),height:Math.max(.001,Math.min(1-y,target.height*target.scaleY/h))});};
    c.on('object:moving',follow);c.on('object:scaling',follow);c.on('object:modified',changed);return()=>{fabric.current=null;c.dispose().catch(()=>{});};},[]);
  React.useEffect(()=>{const c=fabric.current;if(!c||!size.width)return;c.setDimensions({width:size.width,height:size.height});c.clear();if(rect){
    const geometry={originX:'left',originY:'top',left:rect.x*size.width,top:rect.y*size.height,width:rect.width*size.width,height:rect.height*size.height,fill:'transparent',strokeUniform:true};
    const back=new Rect({...geometry,left:geometry.left-2,top:geometry.top-2,stroke:'#111a20',strokeWidth:8,selectable:false,evented:false});
    const r=new Rect({...geometry,stroke:'#fff',strokeWidth:4,cornerColor:'#70f1d3',cornerStrokeColor:'#14201d',borderColor:'#70f1d3',borderScaleFactor:2,transparentCorners:false,cornerSize:12,touchCornerSize:24,selectable:editable,evented:editable,lockRotation:true,lockScalingFlip:true});r.setControlsVisibility({mtr:false});c.add(back,r);if(editable)c.setActiveObject(r);
    }c.requestRenderAll();},[size,rect,editable]);
  return <div ref={box} className="mr-regions" aria-hidden="true" style={{...size,pointerEvents:editable?'auto':'none'}}><canvas ref={element}/></div>;
}
export function OpinionTrack({notes,duration,selected,onSelect}){
  const {token}=theme.useToken();
  const host=React.useRef(null),chart=React.useRef(null),select=React.useRef(onSelect);select.current=onSelect;
  const [error,setError]=React.useState(false);
  React.useEffect(()=>{
    let c,disposed=false;const observer=new ResizeObserver(()=>{if(c||!host.current?.clientWidth)return;
      c=new Chart({container:host.current,autoFit:true,height:84,paddingTop:7,paddingRight:10,paddingBottom:20,paddingLeft:42});chart.current=c;c.on('element:click',e=>{const id=e.data?.data?.id;if(id)select.current(id);});update();
    });
    const update=()=>{if(!c||disposed)return;const rows=notes.filter(n=>n.startMs!==null).map(n=>({id:n.id,lane:{modify:'修改',keep:'保留',discuss:'讨论'}[n.kind],start:n.startMs/1000,end:(n.endMs??n.startMs)/1000,kind:n.kind}));
      const ink=token.colorTextSecondary;
      const common={scale:{y:{domain:[0,duration/1000]},color:{domain:['modify','keep','discuss'],range:['#b68428','#359e82','#7c72c0']}},legend:false,axis:{x:{title:false,labelFontFamily:'Noto Sans SC Variable',labelFontSize:12,labelFill:ink,labelOpacity:1},y:{title:false,tickCount:5,labelFormatter:v=>time(Number(v)*1000),labelFontFamily:'JetBrains Mono Variable',labelFontSize:12,labelFill:ink,labelOpacity:1}},coordinate:{transform:[{type:'transpose'}]}};
      c.options({...common,type:'view',children:[{type:'interval',data:rows.filter(n=>n.end>n.start),encode:{x:'lane',y:['end','start'],color:'kind'},style:{fillOpacity:d=>d.id===selected?1:.65,radius:3},animate:false},{type:'point',data:rows.filter(n=>n.end===n.start),encode:{x:'lane',y:'start',color:'kind'},style:{r:4},animate:false}],interaction:{tooltip:false}});c.render().catch(()=>!disposed&&setError(true));};
    observer.observe(host.current);
    return()=>{disposed=true;observer.disconnect();chart.current=null;c?.destroy();};
  },[notes,duration,selected,token.colorTextSecondary]);
  return <div className="mr-track" aria-label="意见时间分布"><div ref={host}/>{error&&<span className="mr-muted">意见轨暂不可用，请从右侧意见定位。</span>}</div>;
}
