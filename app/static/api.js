/* api.js – Hilfsfunktionen und REST-Aufrufe (nutzt ausschließlich die bestehenden Endpunkte) */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastT;
function toast(m){const t=$('#toast');t.innerHTML=`<span>${esc(m)}</span><button class="tx" data-a="tclose" aria-label="Schließen">${ico('x',14)}</button>`;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),4500)}
/* ---------- Datenzugriff ----------
   Die Oberfläche spricht nur über BACKEND mit den Daten. Anbindungen:
   - Browser/PWA: derselbe Server, Anmeldung per Cookie.
   - Android-App (window.APP_BUNDLED): Die Oberfläche steckt in der APK, die Daten kommen von der gespeicherten Server-Adresse,
     Anmeldung per Bearer-Token. Für den lokalen Modus kommt später eine weitere Anbindung mit denselben Methoden.
     BACKEND.url(pfad)                                   Adresse für Fotos, Downloads und Berichte
     BACKEND.raw(methode, pfad, {json, form, headers, timeout})   Response (Anmeldung, Dateien)
     BACKEND.request(methode, pfad, json, form, headers) JSON-Antwort; wirft bei Fehlern (ohne Verbindung: err.offline)
   MU(pfad) macht aus einem Pfad wie /uploads/x.jpg eine Adresse, die die Anbindung auflösen kann (in der App mit Foto-Schlüssel). */
const BACKEND={
  kind:'server',base:'',bundled:!!window.APP_BUNDLED,cfg:{server:'',token:'',key:''},
  load(){try{this.cfg={...this.cfg,...JSON.parse(localStorage.getItem('mm_cfg')||'{}')}}catch(e){}if(this.bundled)this.base=this.cfg.server||''},
  setCfg(o){Object.assign(this.cfg,o);try{localStorage.setItem('mm_cfg',JSON.stringify(this.cfg))}catch(e){}if(this.bundled)this.base=this.cfg.server||''},
  url(p){return /^(https?:|blob:|data:)/.test(p)?p:this.base+p},
  async raw(method,path,o){o=o||{};const init={method,credentials:this.bundled?'omit':'same-origin',headers:{...(o.headers||{})}};
    if(this.bundled&&this.cfg.token)init.headers['Authorization']='Bearer '+this.cfg.token;
    if(o.form)init.body=o.form;else if(o.json!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(o.json)}
    // In der App nie ewig auf einen nicht erreichbaren Server warten (Uploads ausgenommen)
    const tmo=o.timeout!==undefined?o.timeout:(this.bundled&&!o.form?12000:0);let ctl,t;
    if(tmo){ctl=new AbortController();init.signal=ctl.signal;t=setTimeout(()=>ctl.abort(),tmo)}
    try{return await fetch(this.url(path),init)}catch(e){if(e&&e.name=='AbortError')throw new TypeError('Zeitüberschreitung');throw e}finally{clearTimeout(t)}},
  async request(m,u,b,f,h){let r;
    try{r=await this.raw(m,u,{json:b,form:f,headers:h,timeout:(this.bundled&&u=='/api/bootstrap')?30000:undefined})}catch(e){const er=new Error('offline');er.offline=true;if(typeof setOffline=='function')setOffline(true);throw er}
    if(typeof setOffline=='function')setOffline(false);
    if(r.status==401&&u!='/api/login'){if(this.bundled)this.setCfg({token:''});showLogin(false);throw new Error('401')}
    if(!r.ok){let d='Fehler '+r.status;try{const j=await r.json();d=typeof j.detail=='string'?j.detail:d}catch(e){}toast(d);throw new Error(d)}
    return r.json()}
};
BACKEND.load();
async function API(m,u,b,f,h){return BACKEND.request(m,u,b,f,h)}
const MU=p=>{if(!p)return p;let u=BACKEND.url(p);if(BACKEND.bundled&&BACKEND.cfg.key&&/^\/(uploads|api\/media)\//.test(p))u+=(u.includes('?')?'&':'?')+'k='+encodeURIComponent(BACKEND.cfg.key);return u};
/* Datei speichern/teilen: in der App über Android (Teilen-Dialog), im Browser als Download */
async function saveBlob(blob,name){
  const P=window.Capacitor&&Capacitor.Plugins;
  if(BACKEND.bundled&&P&&P.Filesystem&&P.Share){
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob)});
    const f=await P.Filesystem.writeFile({path:name,data:b64,directory:'CACHE'});
    await P.Share.share({title:name,url:f.uri,dialogTitle:name});return}
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),6e4)}
async function download(path,name){
  if(!BACKEND.bundled){location.href=BACKEND.url(path);return}
  try{const r=await BACKEND.raw('GET',path,{timeout:90000});if(!r.ok)throw new Error('Fehler '+r.status);await saveBlob(await r.blob(),name)}catch(e){toast(e.message||'Download fehlgeschlagen')}}
