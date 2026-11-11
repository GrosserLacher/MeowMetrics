/* app.js – Rendering, Navigation, Ereignisse, Sprache, Anmeldung, Start */
const SUBTITLE={today:'',hist:'Verlauf',pets:'Tiere',more:'Mehr'};
const histOn=()=>histKinds().length>0||ft('stats')||ft('report');
const navTabs=()=>[['today','Heute','home'],histOn()?['hist','Verlauf','list']:null,'fab',['pets','Tiere','paw'],['more','Mehr','more']].filter(Boolean);
const PWA=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const CK=[['bg','Hintergrund'],['card','Karten'],['ink','Text'],['mut','Zweittext'],['acc','Akzent / Buttons'],['onacc','Text auf Akzent'],['line','Linien & Rahmen'],['hg1','Header-Verlauf Start'],['hg2','Header-Verlauf Ende'],['good','Bewertung gut'],['ok','Bewertung okay'],['bad','Bewertung schlecht / Warnung']],SOFT={acc:'accs',good:'goods',ok:'oks',bad:'bads'};
const FHL=['Fraunces','Playfair Display','Lora','Georgia','Poppins','Inter','system-ui'],FBL=['Inter','DM Sans','Nunito','Poppins','system-ui'];
const isDark=()=>{const r=document.documentElement;return r.dataset.theme?r.dataset.theme=='dark':matchMedia('(prefers-color-scheme:dark)').matches};
const loadFont=n=>{if(n=='Georgia'||n=='system-ui'||document.getElementById('f-'+n))return;const l=document.createElement('link');l.id='f-'+n;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+n.replace(/ /g,'+')+':wght@400;500;600;700&display=swap';document.head.append(l)};
const fam=n=>`'${n}',${/Fraunces|Playfair|Lora|Georgia/.test(n)?'Georgia,serif':'system-ui,sans-serif'}`;
const navColor=()=>{const U=PREFS.ui,c=getComputedStyle(document.documentElement).getPropertyValue('--card').trim();return U.tc||(/^#[0-9a-f]{6}$/i.test(c)?c:(isDark()?'#241c18':'#fffdfa'))};
function applyTheme(){const r=document.documentElement,st=r.style,U=PREFS.ui;
  if(PREFS.theme&&PREFS.theme!='auto')r.dataset.theme=PREFS.theme;else delete r.dataset.theme;
  CK.forEach(([k])=>st.removeProperty('--'+k));['accs','goods','oks','bads'].forEach(k=>st.removeProperty('--'+k));
  Object.entries(U[isDark()?'dark':'light']||{}).forEach(([k,v])=>{st.setProperty('--'+k,v);if(SOFT[k])st.setProperty('--'+SOFT[k],`color-mix(in srgb,${v} 16%,var(--card))`)});
  ['fh','fb'].forEach(k=>{if(U[k]){loadFont(U[k]);st.setProperty('--'+k,fam(U[k]))}else st.removeProperty('--'+k)});
  document.body.style.fontSize=(U.fs||15)+'px';
  r.classList.toggle('pwa',U.view=='pwa'||(U.view!='web'&&PWA));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',navColor())}
A.tab=d=>{S.tab=d.v;S.pet=null;S.np=null;S.more='';S.sh=null;window.scrollTo(0,0)};
A.lang=()=>{const ks=Object.keys((window.I18N||{}).languages||{de:1});setLang(ks[(ks.indexOf(LANG)+1)%ks.length])};

function render(){
  if(!ME)return;
  if(S.tab=='hist'&&!histOn())S.tab='today';
  const tabs=navTabs();
  $('#top').innerHTML=`<div class="topbar"><div class="brand">${S.tab=='today'?`<span class="logo">${ico('paw',18)}</span><b>${esc(window.APP_NAME||'')}</b>`:`<b>${SUBTITLE[S.tab]}</b>`}</div><div class="row nowrap">${iconBtn('togtheme','theme','Hell/Dunkel wechseln')}<button class="ib txt" data-a="lang" aria-label="Sprache">${LANG.toUpperCase()}</button></div></div>`;
  const a=$('#app');
  a.style.setProperty('--catimg',S.tab=='today'?heroArt():'none');
  a.className=(S.tab=='today'&&heroArt()=='none'?'nocat ':'')+'view';
  a.innerHTML={today:vToday,hist:vHist,pets:vPets,more:vMore}[S.tab]();
  const canAdd=menuTiles().length>0&&CATS.length>=0;
  $('#nav').innerHTML=`<div class="navi">${tabs.map(t=>t=='fab'?(canAdd?`<button class="fab" data-a="addmenu" aria-label="Eintragen">${ico('plus',28)}<span>Eintragen</span></button>`:'<span class="fabgap"></span>'):`<button class="${S.tab==t[0]?'on':''}" data-a="tab" data-v="${t[0]}" aria-label="${t[1]}">${ico(t[2],22)}<span>${t[1]}</span></button>`).join('')}</div>`;
  $$('.cpv').forEach(e=>{const x=ART[+e.dataset.i];if(x&&x[1])e.style.backgroundImage=x[1](e.dataset.s)});
  renderSheet();renderDlg();renderWizard();xoRender();renderLb()}

/* ---------- Ereignisse ---------- */
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(!t||t.disabled)return;const f=A[t.dataset.a];if(!f)return;if(f(t.dataset,t)!==false)render()});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.b&&t.type!='checkbox'&&t.tagName!='SELECT')setPath(t.dataset.b,t.value)});
document.addEventListener('change',e=>{const t=e.target,d=t.dataset;
  if((t.id=='ximg'||t.id=='xcam')&&S.sh){const s=S.sh,fl=[...t.files];t.value='';
    if(s.t=='evomit'){s.files=fl.slice(0,1)}
    else if(s.ty=='vomit'){s.pv.forEach(u=>URL.revokeObjectURL(u));s.files=fl.slice(0,1);s.pv=s.files.map(f=>URL.createObjectURL(f))}
    else{const room=4-s.files.length;fl.slice(0,room).forEach(f=>{s.files.push(f);s.pv.push(URL.createObjectURL(f))});if(fl.length>room)toast('Maximal 4 Fotos pro Eintrag')}
    render();return}
  if(t.id=='phcam'||t.id=='phpick'){const f=t.files[0];t.value='';if(f&&S.pet!=null)uploadPetPhoto(S.pet,f);return}
  if(d.b){setPath(d.b,t.type=='checkbox'?t.checked:t.value);if(d.ch&&A[d.ch])A[d.ch](t.value,t);if('r' in d||d.ch)render();return}
  if(d.e&&E[d.e]){E[d.e](t);render();return}
  if('hd' in d){HD=t.checked;PREFS.hd=HD?1:0;applyHide();savePrefs();render();return}
  if(d.xo&&XO)XO.sel[d.xo]=t.checked});
A.pdrink=T(async v=>{await API('PUT','/api/default-drink',{name:v})});
document.addEventListener('input',e=>{const t=e.target,d=t.dataset;
  if(d.col){PREFS.ui.preset='custom';const m=isDark()?'dark':'light';PREFS.ui[m]=PREFS.ui[m]||{};PREFS.ui[m][d.col]=t.value;applyTheme();savePrefs()}
  else if(d.fs!==undefined){PREFS.ui.fs=+t.value;const o=$('#fso');if(o)o.textContent=t.value+'px';applyTheme();savePrefs()}
  else if(d.tc!==undefined){PREFS.ui.tc=t.value;applyTheme();savePrefs()}});
/* Vollbild-Ansicht für Fotos */
A.zoom=(d,t)=>{const g=t.closest('.card,.panel')||document,l=[...g.querySelectorAll('[data-a=zoom]')].map(e=>e.dataset.src);S.lb={list:l,i:Math.max(0,l.indexOf(d.src))}};
A.lbc=()=>{S.lb=null};A.lbp=()=>{const l=S.lb;l.i=(l.i-1+l.list.length)%l.list.length};A.lbnx=()=>{const l=S.lb;l.i=(l.i+1)%l.list.length};
function renderLb(){const el=$('#lb'),l=S.lb;if(!l){el.className='';el.innerHTML='';return}el.className='on';const n=l.list.length;
  el.innerHTML=`<div class="lbbg" data-a="lbc"></div><button class="lbx" data-a="lbc" aria-label="Schließen">${ico('x',24)}</button>${n>1?`<button class="lbn l" data-a="lbp" aria-label="Zurück">${ico('back',28)}</button><button class="lbn r" data-a="lbnx" aria-label="Weiter">${ico('chev',28)}</button><div class="lbc">${l.i+1} / ${n}</div>`:''}<img src="${esc(l.list[l.i])}" alt="Foto">`}
document.addEventListener('keydown',e=>{if(!S.lb)return;if(e.key=='ArrowLeft'){A.lbp();render()}else if(e.key=='ArrowRight'){A.lbnx();render()}},true);
document.addEventListener('keydown',e=>{if(e.key=='Escape'){if(S.lb){S.lb=null;render();return}if(S.dlg)A.dno();else if(S.sh){A.shclose();render()}}});
setInterval(()=>$$('[data-tick]').forEach(e=>{e.textContent=tickTxt(e.dataset.tick,+e.dataset.ts)}),30000);
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{applyTheme();render()});

/* ---------- Sprache (Texte in /static/i18n.js) ---------- */
const L10N=window.I18N||{languages:{de:'Deutsch'},locale:{de:'de-DE'},de:{}};
const ATTRS=['placeholder','title','aria-label','alt'];
let EX=Object.create(null),SUBK=[],RX=[],BUSY=false;
function prepLang(){EX=Object.assign(Object.create(null),L10N[LANG]||{});SUBK=Object.keys(EX).filter(k=>k.length>=7||k.includes(' ')||k[0]=='~').sort((a,b)=>b.length-a.length);RX=(((L10N.rx||{})[LANG])||[]).map(([p,r])=>[new RegExp(p,'g'),r])}
function trStr(s){const t=s.trim();if(!t)return s;const i=s.indexOf(t),lead=s.slice(0,i),trail=s.slice(i+t.length);if(EX[t]!==undefined)return lead+EX[t]+trail;let o=t;RX.forEach(([r,x])=>{o=o.replace(r,x)});for(const k of SUBK){const kk=k[0]=='~'?k.slice(1):k;if(o.includes(kk))o=o.split(kk).join(EX[k])}return o==t?s:lead+o+trail}
function trNode(n,re){const v=n.nodeValue;if(!re&&n.__t!==undefined&&n.__t===v)return;if(!(re&&n.__o!==undefined))n.__o=v;const out=trStr(n.__o);n.__t=out;if(out!==v)n.nodeValue=out}
function trAttr(el,a,re){const v=el.getAttribute(a);if(v==null)return;el.__a=el.__a||{};const r=el.__a[a];if(!re&&r&&r.t===v)return;const o=re&&r?r.o:v,out=trStr(o);el.__a[a]={o,t:out};if(out!==v)el.setAttribute(a,out)}
function trTree(root,re){const go=n=>{if(n.nodeType==3)trNode(n,re);else if(n.nodeType==1&&!/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName)){ATTRS.forEach(a=>{if(n.hasAttribute(a))trAttr(n,a,re)});n.childNodes.forEach(go)}};go(root)}
new MutationObserver(ms=>{if(BUSY)return;BUSY=true;try{ms.forEach(m=>{if(m.type=='childList')m.addedNodes.forEach(n=>trTree(n));else if(m.type=='characterData')trNode(m.target);else if(m.type=='attributes')trAttr(m.target,m.attributeName)})}finally{BUSY=false}}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
function setLang(l,init){if(!L10N[l])l='de';LANG=l;prepLang();document.documentElement.lang=l;BUSY=true;try{trTree(document.body,true)}finally{BUSY=false}if(!init){PREFS.lang=l;savePrefs();render()}}
const detectLang=()=>{const n=(navigator.language||'de').slice(0,2).toLowerCase();return L10N[n]&&n!='de'?n:'de'};

/* ---------- Anmeldung und Start ---------- */
function showLogin(setup){let el=$('#login');if(!el){document.body.insertAdjacentHTML('beforeend','<div id="login"></div>');el=$('#login')}
  el.innerHTML=`<div class="card logincard"><div class="brandbig"><span class="logo">${ico('paw',22)}</span><b>${esc(window.APP_NAME||'')}</b></div><h2 class="ph">${setup?'Willkommen! Administrator anlegen':'Anmelden'}</h2><p class="muted">${setup?'Der erste Benutzer wird Administrator. Weitere Benutzer legst du später in den Einstellungen an.':'Dieses Gerät bleibt danach angemeldet.'}</p>
  <input type="text" id="lu" placeholder="Benutzername" autocomplete="username"><div style="height:8px"></div><input type="password" id="lp" placeholder="Passwort${setup?' (mind. 8 Zeichen)':''}" autocomplete="${setup?'new-password':'current-password'}"><div id="le" class="warnbox" hidden></div><button class="btn primary block" id="lb" style="margin-top:12px">${setup?'Konto anlegen':'Anmelden'}</button></div>`;
  const go=async()=>{const r=await fetch(setup?'/api/setup-admin':'/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#lu').value,password:$('#lp').value})});
    if(!r.ok){let d='Anmeldung fehlgeschlagen';try{d=(await r.json()).detail||d}catch(e){}const x=$('#le');x.hidden=false;x.textContent=d;return}el.remove();await initApp()};
  $('#lb').onclick=go;$('#lp').onkeydown=e=>{if(e.key=='Enter')go()};$('#lu').focus()}
async function initApp(){
  const st=await fetch('/api/auth/status',{credentials:'same-origin'}).then(r=>r.json());ME=st.user;if(!ME){showLogin(false);return}
  const p=await API('GET','/api/prefs');PREFS={...p,ui:{...(p.ui||{})}};HD=!!p.hd;
  if(p.lang&&L10N[p.lang])setLang(p.lang,true);
  applyTheme();await load();render();pushInit().then(()=>render())}
(async()=>{try{setLang(detectLang(),true);const st=await fetch('/api/auth/status',{credentials:'same-origin'}).then(r=>r.json());if(st.needs_setup)showLogin(true);else if(!st.user)showLogin(false);else await initApp()}catch(e){console.error(e)}})();
