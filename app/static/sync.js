/* sync.js – Offline-Speicher (IndexedDB), Warteschlange für neue Einträge und Synchronisation.
   Der Server bleibt die einzige Wahrheit: lokal liegen nur eine Kopie der Startdaten und die noch nicht gesendeten Einträge. */
const SECURE=window.isSecureContext,HAVE_IDB=typeof indexedDB!='undefined';
let OFFLINE=false,PENDING=0,OPS=[],SYNCING=false,LASTSYNC=0,QN=false;
const setOffline=v=>{OFFLINE=v};
const uuid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c=='x'?r:(r&3|8)).toString(16)});
const IDB={db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('meowmetrics',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('kv');d.createObjectStore('outbox',{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async tx(store,mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction(store,mode);let q;try{q=fn(t.objectStore(store))}catch(e){rej(e);return}t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  get(k){return this.tx('kv','readonly',s=>s.get(k))},set(k,v){return this.tx('kv','readwrite',s=>s.put(v,k))},
  add(op){return this.tx('outbox','readwrite',s=>s.add(op))},all(){return this.tx('outbox','readonly',s=>s.getAll())},del(id){return this.tx('outbox','readwrite',s=>s.delete(id))}};
const toFD=entries=>{const f=new FormData();entries.forEach(([k,v])=>f.append(k,v));return f};
async function refreshPending(){try{OPS=HAVE_IDB?await IDB.all():[]}catch(e){OPS=[]}PENDING=OPS.length}

/* Eintrag senden – ohne Verbindung landet er in der Warteschlange (mit eindeutiger Kennung, damit er nie doppelt ankommt) */
async function mut(method,url,json,entries,pend){
  const cid=uuid();
  try{return await API(method,url,json,entries?toFD(entries):undefined,{'X-Client-Id':cid})}
  catch(e){if(!e.offline||!HAVE_IDB)throw e;
    await IDB.add({cid,method,url,json:json===undefined?null:json,entries:entries||null,pend,ts:Date.now()});
    QN=true;await refreshPending();return{queued:true}}}
const okMsg=m=>QN?'Offline gespeichert – wird synchronisiert, sobald eine Verbindung besteht':m;

/* Noch nicht gesendete Einträge sofort in den Listen anzeigen */
async function applyPending(){
  await refreshPending();const me=ME?ME.username:'';
  OPS.forEach(op=>{const p=op.pend;if(!p)return;const id='p'+op.id,ms=new Date(p.ts).getTime();
    if(p.t=='feed')B0.push({id,ts:ms,kind:p.kind,mid:p.mid,fid:p.fid,man:p.man,food:p.food,cats:{...p.cats},note:p.note||'',by:me,pending:true});
    else if(p.t=='med')MG0.push({id,ts:ms,med:p.med,dose:p.dose||'',wf:!!p.wf,note:p.note||'',by:me,cats:[...p.cats],pending:true});
    else if(p.t=='vomit')V0.push({id,ts:ms,cat:p.cat,type:p.type,note:p.note||'',by:me,img:null,pending:true});
    else if(p.t=='find')FD0.push({id,cat:p.cat,kind:p.kind,bristol:p.bristol||null,flags:p.flags||[],loc:p.loc||'',ts:ms,note:p.note||'',by:me,imgs:[],pending:true});
    else if(p.t=='val')HV.push({id,cat_id:p.cat_id,field_id:p.field_id,value:p.value,ts:p.ts,note:p.note||'',pending:true});
    else if(p.t=='tlog'){const t=TR.find(x=>x.id==p.tid);if(t)t.logs.push({id,treatment_id:p.tid,timestamp:p.ts,log_type:p.type,value_comment:p.comment||'',created_by_name:me,pending:true})}})}
const opLabel=op=>{const p=op.pend||{};return p.t=='feed'?`Fütterung: ${p.food} (${Object.keys(p.cats).join(', ')})`:p.t=='med'?`Präparat: ${p.med} (${p.cats.join(', ')})`:p.t=='vomit'?`Spucken: ${p.cat}`:p.t=='find'?`${p.kind=='stool'?'Kot':'Auffälligkeit'}: ${p.cat}`:p.t=='val'?`Messwert: ${p.label||''} ${nf(p.value)}`:p.t=='tlog'?`Behandlungs-Eintrag: ${p.type}`:op.url};

/* Synchronisation: Warteschlange der Reihe nach senden, danach neu laden */
async function syncOutbox(manual){
  if(SYNCING||!HAVE_IDB||!ME)return;
  await refreshPending();if(!OPS.length){if(manual)toast('Alles synchronisiert – keine ausstehenden Einträge');render();return}
  SYNCING=true;render();let ok=0;const failed=[];
  try{for(const op of [...OPS]){
    try{await API(op.method,op.url,op.json||undefined,op.entries?toFD(op.entries):undefined,{'X-Client-Id':op.cid});await IDB.del(op.id);ok++}
    catch(e){if(e.offline||e.message=='401')break;failed.push(e.message);await IDB.del(op.id)}}}   // vom Server abgelehnt: nicht endlos wiederholen
  finally{SYNCING=false}
  await refreshPending();
  if(ok||failed.length){LASTSYNC=Date.now();if(HAVE_IDB)IDB.set('lastsync',LASTSYNC).catch(()=>{});try{await load()}catch(e){}}
  render();
  if(ok)toast(`Synchronisiert: ${ok} ${ok==1?'Eintrag':'Einträge'} übertragen`+(failed.length?` · ${failed.length} vom Server abgelehnt`:''));
  else if(failed.length)toast(`${failed.length} Eintrag/Einträge vom Server abgelehnt: ${failed[0]}`);
  else if(manual&&OFFLINE)toast('Keine Verbindung zum Server – es wird später erneut versucht')}
A.syncnow=()=>{syncOutbox(true);return false};
A.opdel=d=>{ask('Ausstehenden Eintrag verwerfen?','Dieser Eintrag wurde noch nicht an den Server übertragen und geht dann verloren.',async()=>{await IDB.del(+d.id);await refreshPending();try{await load()}catch(e){}render();toast('Verworfen')},'Verwerfen');return false};
window.addEventListener('online',()=>{OFFLINE=false;render();syncOutbox()});
window.addEventListener('offline',()=>{OFFLINE=true;render()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncOutbox()});
setInterval(()=>{if(PENDING>0&&!SYNCING)syncOutbox()},30000);
