const KEY='pusula.modern.v1';
export function loadTasks(fallback){try{const data=JSON.parse(localStorage.getItem(KEY));return Array.isArray(data)?data:fallback;}catch{return fallback;}}
export function saveTasks(tasks){localStorage.setItem(KEY,JSON.stringify(tasks));}
export function clearTasks(){localStorage.removeItem(KEY);}
