export const STATUSES=['Başlanmadı','Devam','Tamam','İptal'];
export const PRIORITIES=['Düşük','Orta','Yüksek'];
export function validateTask(task,members){if(!task.title?.trim())return 'Görev başlığı zorunlu';if(!members.some(m=>m.id===task.ownerId))return 'Geçerli sorumlu seçin';if(!STATUSES.includes(task.status))return 'Geçersiz durum';if(!PRIORITIES.includes(task.priority))return 'Geçersiz öncelik';if(task.due&&!/^\d{4}-\d{2}-\d{2}$/.test(task.due))return 'Geçersiz tarih';return null;}
export function visibleTasks(tasks,view,memberId,members){if(view==='mine')return tasks.filter(t=>t.ownerId===memberId);if(view==='team'){const team=members.find(m=>m.id===memberId)?.team;return tasks.filter(t=>t.team===team);}return tasks;}
