/* api.js – Hilfsfunktionen und REST-Aufrufe (nutzt ausschließlich die bestehenden Endpunkte) */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastT;
function toast(m){const t=$('#toast');t.innerHTML=`<span>${esc(m)}</span><button class="tx" data-a="tclose" aria-label="Schließen">${ico('x',14)}</button>`;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),4500)}
/* ---------- Datenzugriff ----------
   Die Oberfläche spricht nur über BACKEND mit den Daten (Server). Aktuell gibt es genau eine Anbindung: REST.
   Für den lokalen Modus der Android-App kommt später eine zweite Anbindung mit denselben Methoden.
     BACKEND.url(pfad)                                   Adresse für Fotos, Downloads und Berichte
     BACKEND.raw(methode, pfad, {json, form, headers})   Response (Anmeldung, Dateien)
     BACKEND.request(methode, pfad, json, form, headers) JSON-Antwort; wirft bei Fehlern (ohne Verbindung: err.offline)
   MU(pfad) macht aus einem Pfad wie /uploads/x.jpg eine Adresse, die die Anbindung auflösen kann. */
const BACKEND={
  kind:'server',base:'',
  url(p){return /^(https?:|blob:|data:)/.test(p)?p:this.base+p},
  raw(method,path,o){o=o||{};const init={method,credentials:'same-origin',headers:{...(o.headers||{})}};
    if(o.form)init.body=o.form;else if(o.json!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(o.json)}
    return fetch(this.url(path),init)},
  async request(m,u,b,f,h){let r;
    try{r=await this.raw(m,u,{json:b,form:f,headers:h})}catch(e){const er=new Error('offline');er.offline=true;if(typeof setOffline=='function')setOffline(true);throw er}
    if(typeof setOffline=='function')setOffline(false);
    if(r.status==401&&u!='/api/login'){showLogin(false);throw new Error('401')}
    if(!r.ok){let d='Fehler '+r.status;try{const j=await r.json();d=typeof j.detail=='string'?j.detail:d}catch(e){}toast(d);throw new Error(d)}
    return r.json()}
};
async function API(m,u,b,f,h){return BACKEND.request(m,u,b,f,h)}
const MU=p=>p?BACKEND.url(p):p;
