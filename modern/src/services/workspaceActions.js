import {id,now,canEdit,member} from './workspaceRules.js';
export function updateChecklist(ws,userId,taskId,checkId,done){
 const task=ws.tasks.find(t=>t.id===taskId);if(!task||!canEdit(ws,userId,task))throw Error('İş düzenleme yetkisi yok');
 const time=now();return {...ws,tasks:ws.tasks.map(t=>t.id!==taskId?t:{...t,checklist:(t.checklist||[]).map(c=>c.id===checkId?{...c,done}:c),revision:(t.revision||0)+1,updatedAt:time}),audit:[...ws.audit,{id:id(),at:time,actorId:userId,kind:'checklist.updated',targetId:taskId,detail:checkId+' '+done}]};
}
export function addComment(ws,userId,taskId,text){
 const task=ws.tasks.find(t=>t.id===taskId);if(!member(ws,userId)?.active||!task)throw Error('Yorum eklenemedi');if(!text.trim())throw Error('Yorum boş olamaz');
 const time=now(),entry={id:id(),taskId,text:text.trim(),authorId:userId,createdAt:time};
 const recipients=[task.ownerId,...(task.followers||[])].filter(x=>x&&x!==userId);
 return {...ws,comments:[...ws.comments,entry],notifications:ws.settings.notificationOnComment?[...ws.notifications,...[...new Set(recipients)].map(x=>({id:id(),userId:x,taskId,text:'Yeni yorum: '+task.title,read:false,at:time}))]:ws.notifications,audit:[...ws.audit,{id:id(),at:time,actorId:userId,kind:'comment.created',targetId:taskId,detail:entry.text}]};
}
export function toggleFollow(ws,userId,taskId){
 const task=ws.tasks.find(t=>t.id===taskId);if(!task||!member(ws,userId)?.active)throw Error('İş bulunamadı');
 const followers=task.followers||[];return {...ws,tasks:ws.tasks.map(t=>t.id===taskId?{...t,followers:followers.includes(userId)?followers.filter(x=>x!==userId):[...followers,userId]}:t)};
}
export function removeTask(ws,userId,taskId){
 const task=ws.tasks.find(t=>t.id===taskId);if(!task||!canEdit(ws,userId,task))throw Error('Silme yetkisi yok');
 if(ws.tasks.some(t=>(t.dependencies||[]).includes(taskId)))throw Error('Bağımlı işleri olan görev silinemez');
 const time=now();return {...ws,tasks:ws.tasks.filter(t=>t.id!==taskId),audit:[...ws.audit,{id:id(),at:time,actorId:userId,kind:'task.deleted',targetId:taskId,detail:task.title}]};
}
