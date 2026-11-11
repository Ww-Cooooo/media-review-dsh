import React from 'react';
import {Button,Popover} from 'antd';
import {InfoCircleOutlined,CloseOutlined,RightOutlined} from '@ant-design/icons';
import {reviewHelp} from './review-flow.js';

const HelpContext=React.createContext(null);
export function HelpProvider({children}){
  const [active,setActive]=React.useState(null),[pinned,setPinned]=React.useState(false);
  const close=React.useCallback(()=>{setActive(null);setPinned(false);},[]);
  React.useEffect(()=>{
    if(!active)return;
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
    const outside=e=>{if(!e.target.closest('[data-mr-help],[data-mr-help-content]'))close();};
    document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',outside,true);
    return()=>{document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',outside,true);};
  },[active,close]);
  return <HelpContext.Provider value={{active,pinned,setActive,setPinned,close}}>{children}</HelpContext.Provider>;
}

export function HelpTip({topic,onMore,id=topic}){
  const h=React.useContext(HelpContext),copy=reviewHelp[topic],open=h.active===id;
  const show=next=>{if(h.pinned)return;if(next)h.setActive(id);else if(open)h.close();};
  const pin=()=>{if(open&&h.pinned)h.close();else{h.setActive(id);h.setPinned(true);}};
  const content=<div className="mr-help-card" data-mr-help-content={id}>
    <div className="mr-help-heading"><strong>{copy.title}</strong><Button type="text" size="small" aria-label={`关闭${copy.title}说明`} icon={<CloseOutlined/>} onClick={h.close}/></div>
    <p>{copy.body}</p>
    {copy.details&&onMore&&<Button type="link" size="small" onClick={()=>{h.close();onMore(copy.details);}}>了解这一步<RightOutlined/></Button>}
  </div>;
  return <Popover open={open} content={content} trigger={['hover','focus']} onOpenChange={show} mouseEnterDelay={.25} mouseLeaveDelay={.18} placement="top" classNames={{root:'mr-help-popover'}}>
    <Button className="mr-help-trigger" data-mr-help={id} type="text" size="small" aria-label={`${copy.title}说明`} aria-expanded={open} icon={<InfoCircleOutlined/>} onClick={pin}/>
  </Popover>;
}

export function WorkflowStrip({flow,onHelp}){
  const labels=['记录意见','等待修改','检查结果','完成'];
  return <div className="mr-flow-strip"><ol aria-label="审片步骤">{labels.map((label,i)=><li key={label} aria-current={i===flow.stage?'step':undefined} data-past={i<flow.stage}><span className="mr-step-dot"/>{label}{i<3&&<RightOutlined/>}</li>)}</ol><Button aria-label="使用帮助" type="text" size="small" icon={<InfoCircleOutlined/>} onClick={onHelp}>使用帮助</Button></div>;
}
