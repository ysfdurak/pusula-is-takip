import {demoWorkspace} from '../data/workspace.js';
const keys=['members','teams','projects','tasks','decisions','blockers','comments','timeEntries','templates','notifications','audit'];
export function validateWorkspace(value){
 if(!value||typeof value!=='object'||value.version!==2)throw Error('Desteklenmeyen yedek sürümü');
 for(const key of keys)if(!Array.isArray(value[key]))throw Error('Eksik veya bozuk kayıt grubu: '+key);
 if(!value.settings||typeof value.settings!=='object')throw Error('Ayarlar bulunamadı');
 for(const key of keys){const ids=new Set();for(const item of value[key]){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Geçersiz veya yinelenen kimlik: '+key);ids.add(item.id);}}
 const members=new Set(value.members.map(x=>x.id)),teams=new Set(value.teams.map(x=>x.id));
 if(!members.has(value.currentUser))throw Error('Aktif kullanıcı bulunamadı');
 for(const task of value.tasks){if(!teams.has(task.teamId))throw Error('Görevin ekibi bulunamadı');if(task.ownerId&&!members.has(task.ownerId))throw Error('Görevin sorumlusu bulunamadı');}
 return value;
}
export function parseBackup(raw){return validateWorkspace(JSON.parse(raw));}
export function exportBackup(ws){return JSON.stringify(validateWorkspace(ws),null,2);}
export function freshWorkspace(){return structuredClone(demoWorkspace);}
