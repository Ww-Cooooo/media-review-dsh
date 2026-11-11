import React from 'react';
import { TYPERT_REMOTE } from '../lib/typert.remote-client.js';
import {ReviewPanel} from './review-panel.jsx';
import styles from './review.css';
import fonts from './fonts.generated.css';
const h=React.createElement;
function Icon(){return h('svg',{viewBox:'0 0 24 24',width:20,height:20,'aria-hidden':true},h('rect',{x:2,y:3,width:20,height:14,rx:3,fill:'none',stroke:'currentColor',strokeWidth:1.5}),h('path',{d:'m10 7 6 3-6 3zM5 21h8m4-1 2 2 4-5',fill:'none',stroke:'currentColor',strokeWidth:1.5}));}
export const inject=['remote','slots','locale','uiWorkspace'];
export async function apply(ctx){
  await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.inject(['remote.eh3MediaReview'],(ctx)=>{
    const remote=ctx.remote.eh3MediaReview;
    function Panel(){return h(ReviewPanel,{remote,openSession:id=>ctx.uiWorkspace.openSession(id)});}
    ctx.effect(()=>{const style=document.createElement('style');style.dataset.eh3MediaReview='';style.textContent=fonts+'\n'+styles;document.head.append(style);return()=>style.remove();});
    ctx.effect(()=>ctx.locale.register('eh3-media-review',{
      zh:{title:'Media Review DSH'},
      en:{title:'Media Review DSH'}
    }));
    const t=ctx.locale.bind('eh3-media-review');
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'eh3-media-review',locale:'eh3-media-review'},Panel));
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'eh3-media-review',order:35,locale:'eh3-media-review',label:()=>t('title')},Icon));
  });
}
