import test from 'node:test';import assert from 'node:assert/strict';import {demoWorkspace} from '../src/data/workspace.js';import {parseBackup,exportBackup} from '../src/services/workspaceBackup.js';import {filteredTasks,stats} from '../src/services/workspaceSelectors.js';import {addComment,toggleFollow,updateChecklist,removeTask} from '../src/services/workspaceActions.js';
test('backup roundtrip',()=>assert.equal(parseBackup(exportBackup(demoWorkspace)).tasks.length,2));
test('corrupt backup rejected',()=>assert.throws(()=>parseBackup('{"version":2}'),/bozuk/));
test('search filters',()=>assert.equal(filteredTasks(demoWorkspace,{query:'sevkiyat'}).length,1));
test('stats',()=>assert.equal(stats(demoWorkspace).total,2));
test('comment creates notification',()=>{const ws=addComment(demoWorkspace,'u2','t1','Kontrol edildi');assert.equal(ws.comments.length,1);assert.equal(ws.notifications.length,1);});
test('follow toggles',()=>{const ws=toggleFollow(demoWorkspace,'u3','t1');assert.ok(ws.tasks[0].followers.includes('u3'));});
test('checklist updates',()=>{const ws=updateChecklist(demoWorkspace,'u1','t1','c2',true);assert.equal(ws.tasks[0].checklist[1].done,true);});
test('dependent task deletion rejected',()=>assert.throws(()=>removeTask(demoWorkspace,'u1','t1'),/Bağımlı/));
