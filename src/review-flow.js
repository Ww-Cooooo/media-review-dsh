/** A visible action describes what happens now, rather than an internal round. */
export function sameReviewNotes(draft,fixed){
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  return stable(draft)===stable(fixed);
}

export function reviewFlow({task,round,target,items=[],frozen=false,notes=[],completion=null}) {
  const confirmed=items.filter(i=>i.latest?.actor==='user'&&i.latest.status==='confirmed').length;
  const changes=items.filter(i=>(i.latest?.actor==='user'&&i.latest.status==='pending')||i.latest?.status==='clarify').length;
  const waiting=items.filter(i=>!i.latest||(!['changed','clarify'].includes(i.latest.status)&&i.latest.actor!=='user')).length;
  const unchecked=items.length-confirmed-changes-waiting;
  const complete=!!target&&items.length>0&&confirmed===items.length;
  const common={confirmed,changes,waiting,unchecked,total:items.length,complete};
  if(!task)return {...common,stage:0,title:'开始审片',action:'new',label:'新建审片',help:'start'};
  if(!frozen){
    if(completion&&!notes.length)return {...common,stage:3,title:'已完成',action:'new',label:'新建审片',help:'finished'};
    return {...common,stage:0,title:'记录意见',action:notes.length?'send':'finish',label:notes.length?'发送修改意见':'无需修改，结束',help:notes.length?'send':'finish'};
  }
  if(target){
    if(complete)return {...common,stage:3,title:'已完成',action:'new',label:'新建审片',help:'finished'};
    if(unchecked>0)return {...common,stage:2,title:'检查修改结果',action:'check',label:'查看修改结果',help:'review'};
    if(waiting>0)return {...common,stage:1,title:'等待修改',action:'progress',label:'查看修改进度',help:'waiting'};
    return {...common,stage:2,title:'需要继续修改',action:'carry',label:'整理修改意见',help:'carry'};
  }
  if(round?.state==='cancelled')return {...common,stage:0,title:'修改已停止',action:'draft',label:'继续写意见',help:'send'};
  if(['frozen','pending','delivery-failed'].includes(round?.state))return {...common,stage:1,title:'发送待确认',action:'progress',label:'查看发送情况',help:'waiting'};
  return {...common,stage:1,title:'等待修改',action:'progress',label:'查看修改进度',help:'waiting'};
}

export const reviewHelp={
  start:{title:'新建审片',body:'选择一个音视频，开始记录修改意见。已有审片会保留。',details:'start'},
  annotate:{title:'记录意见',body:'在波形上拖选时间，或暂停后在画面上拖框，选完就能写。',details:'annotate'},
  send:{title:'发送修改意见',body:'把这次意见交给负责制作的会话。确认发送后，会话才会开始处理。',details:'send'},
  waiting:{title:'等待修改',body:'这里显示制作会话的真实进度。返回新文件后，再检查是否改好。',details:'waiting'},
  review:{title:'检查修改结果',body:'对照修改前后的作品，逐条选择“已改好”或“还要修改”。',details:'review'},
  carry:{title:'整理修改意见',body:'把仍需处理的意见带到修改版。可以补充内容，再确认发送。',details:'carry'},
  finish:{title:'无需修改，结束',body:'确认这份作品没有问题后结束审片。现在还没有标记为完成。',details:'finished'},
  finished:{title:'本次审片已完成',body:'记录仍然保留，可以回看结果；发现新问题时也能补充意见。',details:'finished'},
  next:{title:'下一条意见',body:'跳到列表里的下一条意见和对应位置。不会新增、提交或标记通过。'},
  session:{title:'负责修改的会话',body:'选择 Harness 里负责制作这份作品的会话，沿用它的模型配置。',details:'start'},
  export:{title:'导出意见',body:'下载可离线阅读的意见清单和标注图片，不包含原音视频。'},
};

export const helpDetails={
  start:{title:'开始一次审片',lines:['点“新建审片”，选音视频文件。','选择它所在的工作区，以及负责修改的制作会话。','暂时没有工作区或会话时，先在 Harness 中创建，再回到这里。']},
  annotate:{title:'怎样写意见',lines:['拖选一段时间，松开后直接输入。','暂停后拖框，可以给同一帧的多个位置分别写意见。','点“添加意见”记录当前时刻；“整片意见”适用于整个作品。']},
  send:{title:'把意见交给制作会话',lines:['点“发送修改意见”，确认接收会话和这次允许改动的范围。','发送的意见会单独保存，之后改草稿不会改掉已发内容。','插件负责交接；制作会话实际修改并返回新的文件。']},
  waiting:{title:'修改期间',lines:['“等待接手”和“正在修改”表示不同进度。','可以打开制作会话查看情况；发送未确认时可重试。','收到实际新文件后，在这里检查修改结果。']},
  review:{title:'检查是否改好',lines:['点一条意见，播放器会定位到对应位置。','切换修改前后版本，选择“已改好”或“还要修改”。','“下一条意见”只移动位置，不会替你作出判断。']},
  carry:{title:'继续处理没改好的地方',lines:['点“整理修改意见”，将仍需处理的意见带到修改版。','核对并补充内容，再点“发送修改意见”。','已经通过的意见留在历史记录里，不会再次发送。']},
  finished:{title:'结束与继续',lines:['没有意见时，点“无需修改，结束”确认审片完成。','修改结果全部通过后，本次审片直接显示“已完成”。','需要检查别的文件就新建审片；发现新问题可以补充意见。']},
};
