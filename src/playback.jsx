import React from 'react';
import {acquirePlayback} from './playback-cache.js';
export function usePlaybackSource(source,media) {
  const desktop=location.protocol==='dsh-app:';
  const [state,setState]=React.useState({source:null,url:null,error:''});
  React.useEffect(()=>{
    if(!desktop||!source||!media)return;
    let live=true;
    setState({source,url:null,error:''});
    const lease=acquirePlayback(source,media);
    lease.ready.then(url=>{if(live)setState({source,url,error:''});}).catch(error=>{if(live&&error.name!=='AbortError')setState({source,url:null,error:error.name==='QuotaExceededError'?'本机缓存空间不足。请释放磁盘空间后重新打开作品。':error.message});});
    return()=>{live=false;lease.release();};
  },[desktop,source,media?.size,media?.fingerprint]);
  if(!desktop)return {url:source,preparing:false,error:''};
  return {url:state.source===source?state.url:null,preparing:!!source&&(state.source!==source||(!state.url&&!state.error)),error:state.source===source?state.error:''};
}
