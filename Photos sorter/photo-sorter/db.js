const DB_NAME='photo-sorter-v1',DB_VERSION=1,STORE_META='meta',STORE_THUMB='thumbs';
let _db=null;
function openDB(){
  if(_db)return Promise.resolve(_db);
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(STORE_META))db.createObjectStore(STORE_META);
      if(!db.objectStoreNames.contains(STORE_THUMB))db.createObjectStore(STORE_THUMB);
    };
    req.onsuccess=e=>{_db=e.target.result;res(_db);};
    req.onerror=()=>rej(req.error);
  });
}
function fileKey(f){return f.name+'|'+f.size+'|'+f.lastModified;}
async function getMeta(file){
  const db=await openDB(),key=fileKey(file);
  return new Promise(r=>{
    const req=db.transaction(STORE_META,'readonly').objectStore(STORE_META).get(key);
    req.onsuccess=()=>r(req.result||null);req.onerror=()=>r(null);
  });
}
async function setMeta(file,meta){
  const db=await openDB(),key=fileKey(file);
  return new Promise(r=>{
    const tx=db.transaction(STORE_META,'readwrite');
    tx.objectStore(STORE_META).put(meta,key);
    tx.oncomplete=r;tx.onerror=r;
  });
}
async function getThumb(file){
  const db=await openDB(),key=fileKey(file);
  return new Promise(r=>{
    const req=db.transaction(STORE_THUMB,'readonly').objectStore(STORE_THUMB).get(key);
    req.onsuccess=()=>r(req.result||null);req.onerror=()=>r(null);
  });
}
async function setThumb(file,blob){
  const db=await openDB(),key=fileKey(file);
  return new Promise(r=>{
    const tx=db.transaction(STORE_THUMB,'readwrite');
    tx.objectStore(STORE_THUMB).put(blob,key);
    tx.oncomplete=r;tx.onerror=r;
  });
}
