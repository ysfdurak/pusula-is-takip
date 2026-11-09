export function filteredTasks(ws,{view='all',userId=ws.currentUser,query='',status='',priority='',projectId='',overdue=false}={}){
 const u=ws.members.find(m=>m.id===userId);const today=new Date().toISOString().slice(0,10);
 return ws.tasks.filter(t=>{
  if(view==='mine'&&t.ownerId!==userId)return false;
  if(view==='team'&&t.teamId!==u?.teamId)return false;
  if(view==='following'&&!(t.followers||[]).includes(userId))return false;
  if(status&&t.status!==status)return false;
  if(priority&&t.priority!==priority)return false;
  if(projectId&&t.projectId!==projectId)return false;
  if(overdue&&(!t.due||t.due>=today||['Tamam','İptal'].includes(t.status)))return false;
  if(query&&!((t.title||'')+' '+(t.description||'')).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))return false;
  return true;
 });
}
export function stats(ws){return {total:ws.tasks.length,done:ws.tasks.filter(t=>t.status==='Tamam').length,blocked:ws.blockers.filter(b=>b.status!=='Çözüldü').length,open:ws.tasks.filter(t=>!['Tamam','İptal'].includes(t.status)).length};}
