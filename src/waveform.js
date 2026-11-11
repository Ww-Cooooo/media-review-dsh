// One scale for the entire recording, including after horizontal zoom/pan.
// Never boost quiet buckets independently: their height must retain RMS ratios.
export function proportionalWaveform(peaks,start,end,duration,height=80,columns=700){
  if(!peaks.length||!Number.isFinite(duration)||duration<=0||end<=start)return [];
  const first=Math.max(0,Math.floor(start/duration*peaks.length));
  const last=Math.min(peaks.length,Math.ceil(end/duration*peaks.length));
  const count=Math.min(columns,last-first),maximum=Math.max(0,...peaks);
  if(count<=0)return [];
  const gain=maximum>0?Math.max(25,Math.min(100,height))/100/maximum:0;
  return Array.from({length:count},(_,i)=>{
    const a=first+Math.floor(i*(last-first)/count),b=first+Math.ceil((i+1)*(last-first)/count);
    let sum=0;for(let j=a;j<b;j++)sum+=peaks[j]**2;
    const value=Math.sqrt(sum/(b-a))*gain;
    return {i:String(i),upper:value,lower:-value};
  });
}
