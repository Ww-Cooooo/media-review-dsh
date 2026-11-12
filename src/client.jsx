import React from 'react';
import { TYPERT_REMOTE } from '../lib/typert.remote-client.js';
import {ConversationReviewEntry,ConversationReviewSidebar,ConversationReviewMenu,createReviewEntryBridge,REVIEW_TAB,REVIEW_TAB_ID} from './conversation-entry.jsx';
import styles from './review.css';
import fonts from './fonts.generated.css';
const h=React.createElement;
export const inject=['remote','slots','locale','uiWorkspace','sidebarRight','sidebarRightTabs'];
export async function apply(ctx){
  await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.inject(['remote.eh3MediaReview'],(ctx)=>{
    const remote=ctx.remote.eh3MediaReview;
    const bridge=createReviewEntryBridge();
    ctx.effect(()=>{const style=document.createElement('style');style.dataset.eh3MediaReview='';style.textContent=fonts+'\n'+styles;document.head.append(style);return()=>style.remove();});
    ctx.effect(()=>ctx.locale.register('eh3-media-review',{
      zh:{title:'Media Review DSH',review:'审片',reopen:'打开审片台',close:'收起审片，回到对话',new:'新建审片',history:'审片记录',unavailable:'审片暂未连接'},
      en:{title:'Media Review DSH',review:'Review',reopen:'Open media review',close:'Close review and return to conversation',new:'New media review',history:'Review history',unavailable:'Review is temporarily unavailable'}
    }));
    const t=ctx.locale.bind('eh3-media-review');
    function Entry(props){return h(ConversationReviewEntry,{...props,remote,bridge,t,sidebar:ctx.sidebarRight});}
    function Sidebar(props){return h(ConversationReviewSidebar,{...props,remote,bridge,t,sidebar:ctx.sidebarRight,openSession:id=>ctx.uiWorkspace.openSession(id)});}
    function More(props){return h(ConversationReviewMenu,{...props,bridge,t});}
    ctx.effect(()=>ctx.sidebarRightTabs.register({id:REVIEW_TAB_ID,kind:REVIEW_TAB,title:()=>t('title')}));
    ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'eh3-media-review',order:40,locale:'eh3-media-review'},Entry));
    ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:REVIEW_TAB_ID,locale:'eh3-media-review'},Sidebar));
    ctx.slots.inject('conversation.session.header.views.actions',()=>ctx.slots.register({name:'conversation.session.header.views.actions',id:'eh3-media-review',order:35,locale:'eh3-media-review'},More));
  });
}
