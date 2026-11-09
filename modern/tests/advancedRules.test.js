import test from 'node:test';import assert from 'node:assert/strict';import {demoWorkspace} from '../src/data/workspace.js';import {canViewTask,claimTask,bulkStatus,taskFromTemplate} from '../src/services/advancedRules.js';
test('admin sees task',()=>assert.equal(canViewTask(demoWorkspace,'u1',demoWorkspace.tasks[0]),true));
test('unrelated team denied',()=>assert.equal(canViewTask(demoWorkspace,'u3',demoWorkspace.tasks[0]),false));
test('claim pool task',()=>{const ws={...demoWorkspace,tasks:[{...demoWorkspace.tasks[0],ownerId:''}]};assert.equal(claimTask(ws,'u2','t1').tasks[0].ownerId,'u2');});
test('bulk completion respects checklist',()=>assert.throws(()=>bulkStatus(demoWorkspace,'u1',['t1'],'Tamam'),/koşulları/));
test('bulk status updates revision',()=>assert.equal(bulkStatus(demoWorkspace,'u1',['t1'],'Devam').tasks[0].revision,2));
test('template generates unchecked steps',()=>assert.equal(taskFromTemplate(demoWorkspace.templates[0],'g1','u1').checklist[0].done,false));
