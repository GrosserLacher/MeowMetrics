const {JSDOM,VirtualConsole}=require('jsdom');
const BASE='http://127.0.0.1:8123';
let cookie='';
const api=async(m,u,b)=>{const r=await fetch(BASE+u,{method:m,headers:{'Content-Type':'application/json',Cookie:cookie},body:b?JSON.stringify(b):undefined});
  const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return r.json()};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{console.log((c?'  OK  ':' FEHL ')+m);if(!c)fails++};
(async()=>{
  await api('POST','/api/setup-admin',{username:'admin',password:'geheim1234'});
  if(!cookie)await api('POST','/api/login',{username:'admin',password:'geheim1234'});
  await api('POST','/api/animals',{name:'Mia',species:'cat',birthday:'2020-05-01'});
  await api('POST','/api/animals',{name:'Rex',species:'dog'});
  const cat=await api('GET','/api/catalog?kind=food');
  await api('PUT','/api/features',{features:{},setup_done:true});
  const errors=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push('jsdomError: '+(e.detail&&e.detail.message||e.message)));vc.on('error',e=>errors.push('console.error: '+e));
  const dom=await JSDOM.fromURL(BASE+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      w.matchMedia=q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
      w.scrollTo=()=>{};Object.defineProperty(w.navigator,'language',{value:'de-DE'});
      w.fetch=(u,o={})=>fetch(new URL(u,BASE).href,{...o,headers:{...(o.headers||{}),Cookie:cookie}});
      w.HTMLElement.prototype.scrollIntoView=()=>{};
      w.window.addEventListener('error',e=>errors.push('window error: '+e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
    }});
  const w=dom.window,$=s=>w.document.querySelector(s),ev=s=>w.eval(s);
  await wait(1500);
  ok(ev('typeof BACKEND')=='object' && ev('typeof ID')=='function','BACKEND und ID sind definiert');
  ok(ev('CATS.length')==2,'Daten geladen: '+ev('CATS.map(c=>c.name).join(", ")'));
  ok($('#app').innerHTML.includes('Mia'),'Startseite zeigt die Tiere');
  // Tab-Wechsel per Klick
  for(const [v,txt] of [['pets','Meine Tiere'],['more','Katalog'],['today','Heute bisher']]){
    $(`#nav [data-v="${v}"]`).click();await wait(100);
    ok($('#app').innerHTML.includes(txt),`Tab ${v}`);
  }
  // Tierakte öffnen, ID-Umwandlung
  $('#nav [data-v="pets"]').click();await wait(50);
  $('#app [data-a="openpet"]').click();await wait(100);
  ok(ev('typeof S.pet')=='number','Tier-ID bleibt eine Zahl (ID())');
  ok($('#app').innerHTML.includes('Stammdaten'),'Tierakte offen');
  // Zurück-Navigation: History-Eintrag vorhanden, Zurück schließt die Tierakte
  ok(ev('EXTRA')===true,'Verlaufseintrag für die Tierakte angelegt');
  w.history.back();await wait(150);
  ok(ev('S.pet')===null,'Zurück schließt die Tierakte');
  ok(ev('EXTRA')===false&&ev('atRoot()')===true || ev('S.tab')=='pets','Zustand nach Zurück konsistent (Tab '+ev('S.tab')+')');
  w.history.back();await wait(150);
  ok(ev('S.tab')=='today','Zurück führt zu Heute');
  // Aktionen-Menü und Füttern über die Oberfläche
  $('[data-a="addmenu"]').click();await wait(100);
  ok(ev('S.sh&&S.sh.t')=='menu','Aktionen-Menü offen');
  w.history.back();await wait(150);
  ok(ev('S.sh')===null,'Zurück schließt das Menü');
  $('[data-a="addmenu"]').click();await wait(50);$('.tile[data-a="m_feed"]').click();await wait(100);
  const sh=ev('S.sh');ok(sh&&sh.t=='feed','Füttern-Blatt offen');
  // Hersteller anlegen, damit gefüttert werden kann
  const m=await api('POST','/api/catalog/manufacturers',{name:'Testfutter',kind:'food'});
  await api('POST','/api/foods',{manufacturer_id:m.id,name:'Huhn'});
  await ev('load()');
  w.eval('S.sh=feedInit("food");render()');await wait(100);
  ok($('#sheet').innerHTML.includes('Huhn'),'Futter im Blatt sichtbar');
  w.eval('A.fsave()');await wait(800);
  const feed=await api('GET','/api/feedings');
  ok(feed.length>=1,'Fütterung wurde über BACKEND gespeichert ('+feed.length+')');
  // Anmeldeseite: Enter-Hinweise
  w.eval('showLogin(false)');
  ok($('#lu').getAttribute('enterkeyhint')=='next'&&$('#lp').getAttribute('enterkeyhint')=='go','Anmeldung: enterkeyhint gesetzt');
  // Android-Brücke: setBars wird aufgerufen
  let bars=null;w.MMNative={setBars:d=>{bars=d}};w.eval('applyTheme()');
  ok(bars===false,'applyTheme ruft MMNative.setBars(isDark) auf');
  // Navigation-Karte in der App ausgeblendet
  const real=errors.filter(e=>!/fonts\.(googleapis|gstatic)/.test(e));
  ok(real.length==0,'keine JavaScript-Fehler ('+real.length+')');
  real.forEach(e=>console.log('   !',e));
  console.log(fails?`\n${fails} FEHLER`:'\nalles ok');
  w.close();process.exit(fails?1:0);
})().catch(e=>{console.error('Abbruch',e);process.exit(2)});
