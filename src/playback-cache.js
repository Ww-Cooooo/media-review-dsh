// The 0.2.2 desktop carrier strips Content-Length. Chromium therefore treats
// its custom-scheme media as unseekable. Keep authenticated transport, stream
// once to an origin-private disk file, then let Chromium seek that local File.
// HTTP clients continue using the authenticated Range endpoint directly.
const LIMIT = 2 * 1024 ** 3;
const entries = new Map();
let directoryPromise;
let preparation = Promise.resolve();
let generation = 0;
async function directory() {
  return directoryPromise ??= (async () => {
    if (!navigator.storage?.getDirectory) throw new Error('当前客户端不支持本地播放缓存。请使用 Harness Web Client 打开此作品。');
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('eh3-media-review-playback', {create:true});
    // Only this plugin's disposable cache namespace. Interrupted copies from
    // a previous desktop process are never reused as authoritative media.
    for await (const [name, handle] of dir.entries()) if (handle.kind === 'file' && /^(media-|probe-video-)/.test(name)) await dir.removeEntry(name);
    return dir;
  })();
}
async function drop(entry) {
  if (entries.get(entry.key) === entry) entries.delete(entry.key);
  entry.controller.abort();
  if (entry.url) URL.revokeObjectURL(entry.url);
  if (entry.name) await (await directory()).removeEntry(entry.name).catch(() => {});
}
export function acquirePlayback(source, media) {
  const key = source;
  let entry = entries.get(key);
  if(entry?.controller.signal.aborted){entries.delete(key);entry=null;}
  if (!entry) {
    const epoch = generation;
    entry = {key, bytes:media.size, refs:0, used:Date.now(), controller:new AbortController(), url:null, name:null};
    entries.set(key, entry);
    const current = entry;
    current.promise = preparation.catch(() => {}).then(async () => {
      const signal = current.controller.signal;
      signal.throwIfAborted();
      if (!Number.isSafeInteger(media.size) || media.size < 1 || media.size > LIMIT) throw new Error('桌面播放缓存最多容纳 2 GB。请用 Harness Web Client 打开这份较大的作品。');
      const dir = await directory();
      for (const old of [...entries.values()].sort((a,b) => a.used-b.used)) {
        const total = [...entries.values()].filter(e => e.name || e === current).reduce((n,e) => n+e.bytes,0);
        if (total <= LIMIT) break;
        if (old !== current && old.refs === 0) await drop(old);
      }
      if ([...entries.values()].filter(e => e.name || e === current).reduce((n,e) => n+e.bytes,0) > LIMIT) throw new Error('播放缓存空间不足。请先关闭并排对照，再打开这份作品。');
      signal.throwIfAborted();
      const response = await fetch(source, {signal});
      if (!response.ok) throw new Error(response.status === 409 ? '原文件已变化，请登记新版；意见仍保留。' : '媒体暂不可读，请检查原文件后重新打开。');
      if (!response.body) throw new Error('媒体没有返回内容。请重新打开作品。');
      current.etag = response.headers.get('etag');
      current.name = 'media-'+crypto.randomUUID()+'.bin';
      const handle = await dir.getFileHandle(current.name,{create:true});
      const writer = await handle.createWritable();
      let bytes = 0;
      const measured = new TransformStream({transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > media.size) throw new Error('媒体大小已变化，请登记新版。');
        controller.enqueue(chunk);
      }});
      await response.body.pipeThrough(measured).pipeTo(writer,{signal});
      if (bytes !== media.size) throw new Error('媒体读取不完整，请重新打开作品。');
      signal.throwIfAborted();
      if (epoch !== generation) throw new DOMException('Disposed','AbortError');
      const file = await handle.getFile();
      current.url = URL.createObjectURL(file.slice(0,file.size,media.type));
      return current.url;
    }).catch(async error => {await drop(current);throw error;});
    preparation = current.promise;
  }
  entry.refs++;
  entry.used=Date.now();
  const current=entry;
  // Even a disk-cache hit must revalidate through the authenticated Host.
  const ready = current.promise.then(async url => {
    const check = await fetch(source,{method:'HEAD',signal:current.controller.signal});
    if (!check.ok || check.headers.get('etag') !== current.etag) {
      await drop(current);
      throw new Error('原文件已变化或不可读，请重新打开或登记新版；意见仍保留。');
    }
    return url;
  });
  let released=false;
  return {ready, release() {if(released)return;released=true;current.refs--;if(!current.url&&current.refs===0)current.controller.abort();}};
}
export async function clearPlaybackCache() {
  generation++;
  const pending=[...entries.values()];
  for (const entry of pending) entry.controller.abort();
  await Promise.allSettled(pending.map(entry=>entry.promise));
  await Promise.allSettled(pending.map(drop));
}
