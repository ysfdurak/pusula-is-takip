import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTask,visibleTasks } from '../src/services/taskRules.js';
import { members,initialTasks } from '../src/data/demo.js';
test('valid demo task',()=>assert.equal(validateTask(initialTasks[0],members),null));
test('empty title rejected',()=>assert.equal(validateTask({...initialTasks[0],title:' '},members),'Görev başlığı zorunlu'));
test('invalid assignee rejected',()=>assert.equal(validateTask({...initialTasks[0],ownerId:'missing'},members),'Geçerli sorumlu seçin'));
test('mine filter',()=>assert.deepEqual(visibleTasks(initialTasks,'mine','u1',members).map(x=>x.id),['t1']));
test('team filter',()=>assert.deepEqual(visibleTasks(initialTasks,'team','u1',members).map(x=>x.id),['t1','t2']));
