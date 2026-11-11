// Local SRT / WebVTT parsing. Imported text is displayed as text, never HTML.
export function parseSubtitles(text,durationMs){
  if(typeof text!=='string'||text.length>2*1024*1024)throw new Error('字幕文件过大，请使用 2 MB 以内的 SRT 或 VTT。');
  const stamp=value=>{const p=value.replace(',','.').split(':').map(Number);return Math.round((p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1])*1000);};
  const cues=[];
  for(const block of text.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/)){
    const lines=block.split('\n'),at=lines.findIndex(line=>/-->/.test(line));if(at<0)continue;
    const match=lines[at].match(/((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{1,3})/);
    if(!match)throw new Error('字幕时间格式无法读取，请检查 SRT 或 VTT 文件。');
    const startMs=stamp(match[1]),endMs=stamp(match[2]),body=lines.slice(at+1).join('\n').replace(/<[^>]*>/g,'').trim();
    if(!body)continue;
    if(!Number.isSafeInteger(startMs)||startMs<0||endMs<=startMs||startMs>=durationMs||endMs>durationMs+1000)throw new Error('字幕时间超出当前作品，请核对是否为同一版。');
    if(body.length>3000||cues.length>=10000)throw new Error('字幕内容超出可读取范围。');
    cues.push({id:String(cues.length+1),startMs,endMs:Math.min(endMs,durationMs),text:body});
  }
  if(!cues.length)throw new Error('没有读到字幕，请选择带时间码的 SRT 或 VTT 文件。');
  return cues.sort((a,b)=>a.startMs-b.startMs);
}

export const regionsOf=note=>note?.regions||(note?.rect?[{id:1,rect:note.rect,text:''}]:[]);
export function withRegions(note,regions){
  const {rect,...rest}=note;
  const preserved=rect?regions.map(r=>r.id===1&&!r.text?.trim()?{...r,text:note.text}:r):regions;
  return {...rest,regions:preserved,regionSerial:Math.max(note.regionSerial||0,...regions.map(r=>r.id),0)};
}
export function prepareNotes(notes){
  return notes.map((note,index)=>{
    const regions=regionsOf(note);
    if(note.regions&&regions.some(r=>!r.text?.trim()))throw new Error(`请补充第 ${index+1} 条意见中每个框的说明。`);
    const text=note.text.trim();
    if(!text&&!regions.some(r=>r.text?.trim()))throw new Error(`请填写第 ${index+1} 条意见，或删除这条空草稿。`);
    return {...note,text};
  });
}
