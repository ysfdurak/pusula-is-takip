import {useState,useEffect} from 'react';
import {demoWorkspace} from '../data/workspace.js';
import {validateWorkspace,parseBackup,exportBackup,freshWorkspace} from '../services/workspaceBackup.js';
const KEY='pusula.modern.workspace.v2';
const BAD=KEY+'.quarantine';
function initial(){
 try{
  const raw=localStorage.getItem(KEY);
  if(!raw)return freshWorkspace();
  return parseBackup(raw);
 }catch(e){
  // Preserve the original unreadable data. Never overwrite it with an empty workspace.
  return null;
 }
}
export function useWorkspace(){
 const [ws,setWs]=useState(initial);
 const [recovery,setRecovery]=useState(()=>ws===null);
 useEffect(()=>{if(ws&&!recovery)localStorage.setItem(KEY,exportBackup(ws));},[ws,recovery]);
 const reset=()=>{setWs(freshWorkspace());setRecovery(false);};
 const exportJson=()=>{const raw=ws?exportBackup(ws):localStorage.getItem(KEY)||'';const blob=new Blob([raw],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=ws?'pusula-demo-yedek.json':'pusula-bozuk-ham-kayit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const importJson=async(file)=>{const data=parseBackup(await file.text());setWs(data);setRecovery(false);};
 const discardCorrupt=()=>{const raw=localStorage.getItem(KEY);if(raw)localStorage.setItem(BAD,raw);reset();};
 return {ws,setWs,reset,exportJson,importJson,recovery,discardCorrupt};
}
