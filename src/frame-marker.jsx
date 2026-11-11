import React from 'react';
import {Canvas,Rect,FabricText} from 'fabric';

export function FrameMarker({video,mediaKey,regions,selected,drawing,onDraw,onSelect,onChange,onError}){
  const box=React.useRef(null),element=React.useRef(null),canvas=React.useRef(null),callbacks=React.useRef({}),drag=React.useRef(null),[size,setSize]=React.useState(null);
  callbacks.current={onDraw,onSelect,onChange,onError,drawing};
  const signature=JSON.stringify({regions,selected});
  React.useEffect(()=>{
    const parent=box.current.parentElement;
    const measure=()=>{const v=video.current;if(!v?.videoWidth)return;const scale=Math.min(parent.clientWidth/v.videoWidth,parent.clientHeight/v.videoHeight);setSize({width:v.videoWidth*scale,height:v.videoHeight*scale,left:(parent.clientWidth-v.videoWidth*scale)/2,top:(parent.clientHeight-v.videoHeight*scale)/2});};
    const ro=new ResizeObserver(measure);ro.observe(parent);const v=video.current;v?.addEventListener('loadedmetadata',measure);measure();return()=>{ro.disconnect();v?.removeEventListener('loadedmetadata',measure);};
  },[video,mediaKey]);
  React.useEffect(()=>{
    const c=new Canvas(element.current,{selection:false,preserveObjectStacking:true,renderOnAddRemove:false});canvas.current=c;
    c.on('mouse:down',event=>{
      if(event.target?.regionKey){callbacks.current.onSelect(event.target.regionKey);return;}
      if(!callbacks.current.drawing||event.e.button!==0)return;
      const p=c.getScenePoint(event.e),x=Math.max(0,Math.min(c.width,p.x)),y=Math.max(0,Math.min(c.height,p.y));
      const rect=new Rect({originX:'left',originY:'top',left:x,top:y,width:0,height:0,fill:'rgba(19,140,121,.12)',stroke:'#fff',strokeWidth:4,strokeUniform:true,selectable:false,evented:false});
      drag.current={x,y,rect};c.discardActiveObject();c.add(rect);
    });
    c.on('mouse:move',event=>{const g=drag.current;if(!g)return;const p=c.getScenePoint(event.e),x=Math.max(0,Math.min(c.width,p.x)),y=Math.max(0,Math.min(c.height,p.y));g.rect.set({left:Math.min(x,g.x),top:Math.min(y,g.y),width:Math.abs(x-g.x),height:Math.abs(y-g.y)});c.requestRenderAll();});
    c.on('mouse:up',()=>{const g=drag.current;if(!g)return;drag.current=null;c.remove(g.rect);if(g.rect.width>=5&&g.rect.height>=5)callbacks.current.onDraw({x:g.rect.left/c.width,y:g.rect.top/c.height,width:g.rect.width/c.width,height:g.rect.height/c.height});c.requestRenderAll();});
    const follow=({target})=>{if(!target?.regionKey)return;for(const o of c.getObjects())if(o.regionBack===target.regionKey)o.set({left:target.left,top:target.top,width:target.getScaledWidth(),height:target.getScaledHeight()});c.requestRenderAll();};
    c.on('object:moving',follow);c.on('object:scaling',follow);
    c.on('object:modified',({target})=>{if(!target?.regionKey)return;const x=Math.max(0,Math.min(.999,target.left/c.width)),y=Math.max(0,Math.min(.999,target.top/c.height));callbacks.current.onChange(target.regionKey,{x,y,width:Math.max(.001,Math.min(1-x,target.width*target.scaleX/c.width)),height:Math.max(.001,Math.min(1-y,target.height*target.scaleY/c.height))});});
    return()=>{drag.current=null;canvas.current=null;c.dispose().catch(()=>{});};
  },[]);
  React.useEffect(()=>{
    const c=canvas.current;if(!c||!size)return;drag.current=null;c.setDimensions({width:size.width,height:size.height});c.clear();
    for(const r of regions){
      const g={originX:'left',originY:'top',left:r.rect.x*size.width,top:r.rect.y*size.height,width:r.rect.width*size.width,height:r.rect.height*size.height,fill:'transparent',strokeUniform:true};
      const back=new Rect({...g,stroke:'#111',strokeWidth:8,selectable:false,evented:false});back.regionBack=r.key;
      const white=new Rect({...g,stroke:'#fff',strokeWidth:4,cornerColor:'#70f1d3',cornerStrokeColor:'#111',cornerSize:12,transparentCorners:false,borderColor:'#70f1d3',borderScaleFactor:2,lockRotation:true,lockScalingFlip:true,selectable:drawing,evented:true});white.regionKey=r.key;white.setControlsVisibility({mtr:false});
      const label=new FabricText(`#${r.id}${r.text?.trim()?' ✓':' ·'}`,{left:g.left+7,top:Math.max(0,g.top-26),fontSize:18,fontFamily:'JetBrains Mono Variable',fill:'#fff',stroke:'#111',strokeWidth:3,paintFirst:'stroke',selectable:false,evented:false});c.add(back,white,label);if(drawing&&r.key===selected)c.setActiveObject(white);
    }c.defaultCursor=drawing?'crosshair':'default';c.requestRenderAll();
  },[size,signature,drawing]);
  return <div ref={box} className="mr-regions mr-direct-frame" style={{...size,pointerEvents:drawing||regions.length?'auto':'none'}} aria-label="直接拖框标注画面"><canvas ref={element}/></div>;
}
