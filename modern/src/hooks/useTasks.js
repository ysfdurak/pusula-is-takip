import { useEffect,useState } from 'react';
import { initialTasks } from '../data/demo.js';
import { loadTasks,saveTasks,clearTasks } from '../services/storage.js';
export function useTasks(){const [tasks,setTasks]=useState(()=>loadTasks(initialTasks));useEffect(()=>saveTasks(tasks),[tasks]);return {tasks,upsert(task){setTasks(old=>old.some(t=>t.id===task.id)?old.map(t=>t.id===task.id?task:t):[...old,task]);},remove(id){setTasks(old=>old.filter(t=>t.id!==id));},reset(){clearTasks();setTasks(initialTasks);}};}
