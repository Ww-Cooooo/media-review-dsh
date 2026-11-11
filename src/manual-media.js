// Manual registration binds browser-observed metadata to the same full file hash.
export async function manualMedia(file){
  if(!file||file.size>512*1024*1024)throw Error('人工登记支持 512 MB 以内的文件；更大的文件请配置媒体信息工具。');
  const url=URL.createObjectURL(file),v=document.createElement('video');v.preload='metadata';
  try{
    await new Promise((resolve,reject)=>{const finish=e=>{clearTimeout(timer);v.onloadedmetadata=null;v.onerror=null;e?reject(e):resolve();},timer=setTimeout(()=>finish(Error('这份文件暂不能在客户端读取，请检查格式。')),15000);v.onloadedmetadata=()=>finish();v.onerror=()=>finish(Error('这份文件暂不能在客户端播放。'));v.src=url;});
    const durationMs=Math.round(v.duration*1000),width=v.videoWidth||0,height=v.videoHeight||0;if(!Number.isFinite(durationMs)||durationMs<1)throw Error('没有读取到有效时长。');
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return {durationMs,size:file.size,sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''),width,height};
  }finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
}
