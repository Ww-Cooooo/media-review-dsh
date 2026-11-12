import React from 'react';
import {Button,Tooltip,ConfigProvider} from 'antd';
import {PlayCircleOutlined,PlusOutlined,HistoryOutlined} from '@ant-design/icons';
import {ReviewPanel} from './review-panel.jsx';
import {incomingReview,resumeReview} from './conversation-state.js';

export const REVIEW_TAB='eh3-media-review';
export const REVIEW_TAB_ID='media-review-dsh/review';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Host backup remains authoritative. */}};

/** Composer, native sidebar and More share session-scoped state, not DOM ownership. */
export function createReviewEntryBridge(){
  let current=null,serial=0;const listeners=new Set(),sessions=new Map();
  const emit=()=>listeners.forEach(fn=>fn());
  return {subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>current,
    getSession:id=>sessions.get(id)||null,
    update(id,patch){const old=sessions.get(id)||{};if(Object.keys(patch).every(key=>old[key]===patch[key]))return;sessions.set(id,{...old,...patch});emit();},
    request(id,entry,intent='resume'){this.update(id,{request:{...entry,intent,serial:++serial},context:null});},
    bind(value){current=value;emit();return()=>{if(current===value){current=null;emit();}};}};
}

export function ConversationReviewEntry({sessionId,remote,bridge,sidebar,t}){
  const [feed,setFeed]=React.useState(null),[error,setError]=React.useState('');
  const trigger=React.useRef(null),latestFeed=React.useRef(null);
  const state=React.useSyncExternalStore(bridge.subscribe,()=>bridge.getSession(sessionId));
  const seenKey=`eh3-mr-seen:${sessionId}`,resumeKey=`eh3-mr-conversation:${sessionId}`;
  const show=React.useCallback((entry,intent='resume')=>{
    bridge.request(sessionId,entry,intent);sidebar.openTab(REVIEW_TAB);setError('');
  },[bridge,sessionId,sidebar]);
  const open=React.useCallback((intent='resume')=>{
    const value=latestFeed.current;if(!value)return;
    if(intent==='resume'&&bridge.getSession(sessionId)?.request){sidebar.openTab(REVIEW_TAB);return;}
    show(resumeReview(value,read(resumeKey,null)),intent);
  },[bridge,sessionId,sidebar,resumeKey,show]);
  React.useEffect(()=>bridge.bind({sessionId,open,focus:()=>trigger.current?.focus()}),[bridge,sessionId,open]);
  React.useEffect(()=>{
    let disposed=false,inflight=false;
    setFeed(null);latestFeed.current=null;
    const poll=async()=>{
      if(disposed||inflight||document.hidden)return;inflight=true;
      try{
        const result=await remote.conversation({sessionId});if(!result.ok)throw result.error;
        if(disposed)return;const value=result.value;
        latestFeed.current=value;setFeed(value);setError('');
        const entry=incomingReview(value,read(seenKey,''));
        if(entry){show(entry);write(seenKey,value.cursor);}
        else if(!bridge.getSession(sessionId)?.request)bridge.request(sessionId,resumeReview(value,read(resumeKey,null)));
      }catch(e){if(!disposed)setError(e.message||t('unavailable'));}
      finally{inflight=false;}
    };
    void poll();const timer=setInterval(poll,1800);
    document.addEventListener('visibilitychange',poll);
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
  },[sessionId,remote,bridge,sidebar,seenKey,resumeKey,show,t]);
  const visited=!!feed?.entries.length||!!read(resumeKey,null);
  if(!visited)return null;
  return <ConfigProvider theme={{token:{colorPrimary:'#138c79',borderRadius:7,fontFamily:'inherit'}}}>
    <div className="mr-conversation-dock" data-media-review-session={sessionId}>
      <Tooltip title={error||undefined}><Button ref={trigger} className="mr-conversation-trigger" icon={<PlayCircleOutlined/>} aria-label={t('reopen')} aria-expanded={!!state?.visible} onClick={()=>open()}>{t('reopen')}{error&&<span aria-label={t('unavailable')}> ·</span>}</Button></Tooltip>
    </div>
  </ConfigProvider>;
}

/** The host owns the slide, resize handle, chat allocation, focus and docking. */
export function ConversationReviewSidebar({sessionId,useTabInfo,remote,bridge,sidebar,openSession,t}){
  const {tab}=useTabInfo();
  const state=React.useSyncExternalStore(bridge.subscribe,()=>bridge.getSession(sessionId));
  const request=state?.request;
  React.useEffect(()=>{bridge.update(sessionId,{visible:tab.visible});return()=>bridge.update(sessionId,{visible:false});},[bridge,sessionId,tab.visible]);
  const onContextChange=React.useCallback(value=>{
    const current=bridge.getSession(sessionId);
    if(current?.request?.serial!==request?.serial)return;
    write(`eh3-mr-conversation:${sessionId}`,value);
    if(JSON.stringify(current.context)!==JSON.stringify(value))bridge.update(sessionId,{context:value});
  },[bridge,sessionId,request?.serial]);
  const close=()=>{sidebar.hide(tab.id);const entry=bridge.getSnapshot();if(entry?.sessionId===sessionId)entry.focus();};
  return <div className="mr-conversation-surface" aria-label="Media Review DSH">
    {request&&<ReviewPanel key={`${sessionId}:${request.serial}`} remote={remote} initialContext={state.context||request} entryIntent={state.context?'resume':request.intent} active={tab.visible} contextSessionId={sessionId} onContextChange={onContextChange} onClose={close} closeLabel={t('close')} openSession={id=>{close();openSession(id);}}/>}
  </div>;
}

export function ConversationReviewMenu({bridge,onDismiss,t}){
  const active=React.useSyncExternalStore(bridge.subscribe,bridge.getSnapshot);
  if(!active)return null;
  const choose=intent=>{active.open(intent);onDismiss?.();};
  return <div className="mr-conversation-menu" role="group" aria-label="Media Review DSH">
    <Button type="text" role="menuitem" aria-label={t('new')} icon={<PlusOutlined/>} onClick={()=>choose('new')}>{t('new')}</Button>
    <Button type="text" role="menuitem" aria-label={t('history')} icon={<HistoryOutlined/>} onClick={()=>choose('library')}>{t('history')}</Button>
  </div>;
}
