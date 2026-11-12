/** A registration cursor advances only after durable task creation. */
export function incomingReview(feed,seen){
  if(!feed?.cursor||feed.cursor===seen)return null;
  return feed.entries.find(entry=>entry.id===feed.cursor)||null;
}
export function resumeReview(feed,saved){
  if(saved?.workspaceId===feed.workspaceId&&feed.entries.some(e=>e.id===saved.taskId||e.taskId===saved.taskId))return saved;
  return feed.entries.at(-1)||{workspaceId:feed.workspaceId,taskId:'',viewTaskId:'',roundId:null};
}
