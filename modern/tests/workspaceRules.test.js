import test from 'node:test';import assert from 'node:assert/strict';import {demoWorkspace} from '../src/data/workspace.js';import {canEdit,validateTask,cycle,completionError,applyTask,taskScope} from '../src/services/workspaceRules.js';
test('owner can edit',()=>assert.equal(canEdit(demoWorkspace,'u1',demoWorkspace.tasks[0]),true));
test('unrelated member cannot edit',()=>assert.equal(canEdit(demoWorkspace,'u3',demoWorkspace.tasks[0]),false));
test('reject missing title',()=>assert.equal(validateTask(demoWorkspace,{...demoWorkspace.tasks[0],title:''}),'İş başlığı zorunlu'));
test('dependency cycle',()=>assert.equal(cycle(demoWorkspace,{...demoWorkspace.tasks[0],dependencies:['t2']}),true));
test('unfinished checklist blocks completion',()=>assert.match(completionError(demoWorkspace,{...demoWorkspace.tasks[0],status:'Tamam'}),/Kontrol/));
test('mine filter',()=>assert.equal(taskScope(demoWorkspace,'mine','u1').length,1));
test('updates create audit',()=>{const ws=applyTask(demoWorkspace,'u1',{...demoWorkspace.tasks[0],title:'Yeni başlık'});assert.equal(ws.audit.length,1);assert.equal(ws.tasks[0].revision,2);});

test('stale revision rejected',()=>{const old=demoWorkspace.tasks[0];assert.throws(()=>applyTask(demoWorkspace,'u1',{...old,revision:0}),/Kayıt başka/);});
test('unknown dependency rejected',()=>{const old=demoWorkspace.tasks[0];assert.equal(validateTask(demoWorkspace,{...old,dependencies:['missing']}),'Bağımlı iş bulunamadı');});
test('completed dependency required',()=>{const task={...demoWorkspace.tasks[1],status:'Tamam'};assert.match(completionError(demoWorkspace,task),/bağımlı/);});
test('assignment creates notification',()=>{const old=demoWorkspace.tasks[0];const next=applyTask(demoWorkspace,'u1',{...old,ownerId:'u2'});assert.equal(next.notifications.length,1);assert.equal(next.notifications[0].userId,'u2');});
