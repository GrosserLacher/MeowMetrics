// Android-App mit gebündelter Oberfläche: Erststart, Anmeldung per Token, Zwischenspeicher, Offline-Start, Offline-Eintrag, Abgleich.
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');
const http=require('http'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const SERVER='http://127.0.0.1:8123',APP='http://127.0.0.1:8124';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{console.log((c?'  OK  ':' FEHL ')+m);if(!c)fails++};
const until=async(f,ms=4000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(await f())return true}catch(e){}await wait(50)}return false};
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
(async()=>{
  // Oberfläche wie für die APK bauen und unter einer eigenen Adresse ausliefern (andere Herkunft als der Server)
  const out=process.env.WWW_OUT||fs.mkdtempSync(path.join(require('os').tmpdir(),'www-'));
  execFileSync('node',[path.join(__dirname,'../../mobile/scripts/build-www.mjs')],{env:{...process.env,WWW_OUT:out}});
  const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p=='/')p='/index.html';const f=path.join(out,p);
    if(!f.startsWith(out)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
    r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))}).listen(8124);
  const errors=[];let online=true,delay=0;
  const open=async(store)=>{
    const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.detail&&e.detail.message||e.message)));
    const dom=await JSDOM.fromURL(APP+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
      w.matchMedia=q=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){}});w.scrollTo=()=>{};
      Object.defineProperty(w.navigator,'language',{value:'de-DE'});w.HTMLElement.prototype.scrollIntoView=()=>{};
      w.indexedDB=indexedDB;w.IDBKeyRange=IDBKeyRange;if(store)w.localStorage.setItem('mm_cfg',store);
      // fetch von Node statt der Seite; das AbortSignal der Seite (jsdom) wird auf ein Node-Signal abgebildet (neuere Node-Versionen prüfen es streng)
      w.fetch=(u,o={})=>{const url=new URL(u,APP).href;if(!online&&url.startsWith(SERVER))return Promise.reject(new TypeError('Failed to fetch'));
        const slow=delay&&url.startsWith(SERVER)&&(url.includes('/api/bootstrap')||(o.method=='POST'&&url.includes('/api/feedings')));
        const {signal,...rest}=o;if(signal){const ac=new AbortController();signal.addEventListener('abort',()=>ac.abort());rest.signal=ac.signal}
        return slow?new Promise(r=>setTimeout(r,delay)).then(()=>fetch(url,rest)):fetch(url,rest)}}});
    return dom.window};
  const text=w=>w.document.body.textContent.replace(/\s+/g,' ');
  // 1) Erststart
  let w=await open();
  ok(await until(()=>text(w).includes('Wie möchtest du MeowMetrics nutzen?')),'Erststart zeigt die Wahl Server/Lokal');
  ok(w.document.querySelector('#mloc').disabled,'Lokal ist noch gesperrt');
  w.document.querySelector('#mser').click();await wait(50);
  w.document.querySelector('#su').value='kein-server';w.document.querySelector('#sok').click();
  ok(await until(()=>!w.document.querySelector('#se').hidden),'ungültige oder nicht erreichbare Adresse wird gemeldet');
  w.document.querySelector('#su').value=SERVER;w.document.querySelector('#sok').click();
  const loginShown=await until(()=>w.document.querySelector('#lu'));
  ok(loginShown,'Server erreichbar, Anmeldung erscheint'+(loginShown?'':' (Meldung: '+((w.document.querySelector('#se')||{}).textContent||'-')+')'));
  if(!loginShown){srv.close();process.exit(1)}
  ok(!!w.document.querySelector('#lno'),'Anmeldung hat einen Abbrechen-Knopf (App)');
  w.document.querySelector('#lu').value='admin';w.document.querySelector('#lp').value='geheim1234';w.document.querySelector('#lb').click();
  ok(await until(()=>w.eval('typeof CATS!="undefined"&&CATS.length>0')),'Anmeldung klappt, Daten sind geladen');
  const cfg=w.localStorage.getItem('mm_cfg'),c=JSON.parse(cfg);
  ok(c.server==SERVER&&c.token.length>20&&c.key.length>=20,'Server, Token und Foto-Schlüssel gespeichert');
  ok(w.eval('MU("/uploads/a.png")').startsWith(SERVER+'/uploads/a.png?k='),'Foto-Adressen zeigen auf den Server und tragen den Schlüssel');
  ok(!!(await w.eval('IDB.get("bootstrap")')),'Daten liegen im Zwischenspeicher');
  w.close();
  // 2) Neustart ohne Netz: sofort aus dem Zwischenspeicher
  online=false;const t0=Date.now();w=await open(cfg);
  ok(await until(()=>w.eval('typeof CATS!="undefined"&&CATS.length>0')&&text(w).includes('Mia'),3000),'Start ohne Netz zeigt die Daten aus dem Zwischenspeicher ('+(Date.now()-t0)+' ms)');
  ok(!w.document.querySelector('#login'),'keine Anmelde- oder Fehlerseite ohne Netz');
  ok(await until(()=>w.eval('OFFLINE')===true),'App merkt sich: offline');
  // 3) Eintrag ohne Netz
  w.eval('S.sh=feedInit("food");render()');await wait(50);
  w.eval('A.fsave()');
  ok(await until(()=>w.eval('PENDING')===1),'Eintrag ohne Netz wird in der Warteschlange gespeichert');
  const n0=(await (await fetch(SERVER+'/api/bootstrap',{headers:{Authorization:'Bearer '+c.token}})).json()).feedings.length;
  w.close();
  // 4) Wieder online: Neustart gleicht ab
  online=true;w=await open(cfg);
  // Der Zähler steht unmittelbar nach dem Öffnen noch auf 0: erst auf den Server schauen, dann auf die Warteschlange
  const count=async()=>(await (await fetch(SERVER+'/api/bootstrap',{headers:{Authorization:'Bearer '+c.token}})).json()).feedings.length;
  ok(await until(async()=>(await count())>n0,10000),'Server hat den Offline-Eintrag erhalten ('+n0+' -> '+(await count())+' Zeilen)');
  ok(await until(()=>w.eval('PENDING')===0&&w.eval('OFFLINE')===false,6000),'Online: Warteschlange ist leer');
  // 4b) Langsamer Server: Speichern schließt das Blatt sofort, der Abgleich läuft im Hintergrund
  delay=3000;const n1=await count();
  w.eval('S.sh=feedInit("food");render()');await wait(50);
  const t1=Date.now();await w.eval('A.fsave()');const dt=Date.now()-t1;
  ok(dt<800&&w.eval('S.sh')===null,'langsamer Server: Blatt schließt sofort ('+dt+' ms)');
  const msg=w.document.querySelector('#toast').textContent;
  ok(w.eval('PENDING')===1&&msg.trim().length>3&&!/Offline/.test(msg),'Eintrag liegt lokal vor, Erfolgsmeldung ohne Wartezeit und ohne Offline-Hinweis ("'+msg.trim()+'")');
  ok(await until(async()=>(await count())>n1,12000),'Server erhält den Eintrag trotzdem ('+n1+' -> '+(await count())+')');
  delay=0;
  // 5) Abmelden entfernt Token und Schlüssel
  w.eval('A.logout()');await wait(300);
  const c2=JSON.parse(w.localStorage.getItem('mm_cfg'));ok(c2.token===''&&c2.key==='','Abmelden löscht Token und Schlüssel');
  const real=errors.filter(e=>!/fonts\.(googleapis|gstatic)|Not implemented: navigation/.test(e));
  ok(real.length==0,'keine JavaScript-Fehler ('+real.length+')');real.forEach(e=>console.log('   !',e));
  console.log(fails?`\n${fails} FEHLER`:'\nalles ok');
  srv.close();process.exit(fails?1:0);
})().catch(e=>{console.error('Abbruch',e);process.exit(2)});
