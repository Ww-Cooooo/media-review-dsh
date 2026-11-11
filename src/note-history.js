// Undo an operation's changed fields while preserving text entered afterwards.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=v=>v===undefined?undefined:structuredClone(v);
function applyFields(current,before,after,reverse){
  const from=reverse?after:before,to=reverse?before:after,result={...current};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    if(key==='id'||equal(before[key],after[key]))continue;
    if(key==='regions'){result.regions=applyList(current.regions||[],before.regions||[],after.regions||[],reverse);continue;}
    if(to[key]===undefined)delete result[key];else result[key]=clone(to[key]);
  }return result;
}
function applyList(current,before,after,reverse){
  const from=reverse?after:before,to=reverse?before:after,result=current.map(clone);
  for(const id of new Set([...before,...after].map(n=>n.id))){
    const a=from.find(n=>n.id===id),b=to.find(n=>n.id===id),at=result.findIndex(n=>n.id===id);
    if(!a&&b){if(at<0)result.splice(Math.min(to.findIndex(n=>n.id===id),result.length),0,clone(b));}
    else if(a&&!b){if(at>=0)result.splice(at,1);}
    else if(a&&b&&!equal(a,b)&&at>=0)result[at]=applyFields(result[at],before.find(n=>n.id===id),after.find(n=>n.id===id),reverse);
  }return result;
}
export const applyHistory=(current,entry,reverse=true)=>applyList(current,entry.before,entry.after,reverse);
export function regionHistory(before,after){
  const a=[],b=[];
  for(const note of after){const old=before.find(n=>n.id===note.id),left={id:note.id,regions:old?.regions||[],rect:old?.rect||null,regionSerial:old?.regionSerial||0},right={id:note.id,regions:note.regions||[],rect:note.rect||null,regionSerial:note.regionSerial||0};if(!equal(left,right)){a.push(clone(left));b.push(clone(right));}}
  return a.length?{before:a,after:b}:null;
}

