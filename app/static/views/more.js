/* views/more.js – Mehr: Katalog, Tierarztpraxen, Erinnerungen, Funktionen, Darstellung, Daten & Backup, Konto */
const FG=[
['Füttern','bowl',[['food','Futter','Fütterungen mit Bewertung je Tier'],['snack','Snacks','Leckerlis separat festhalten'],['drink','Getränke','Getränke und Standardgetränk'],['meds','Präparate','Medikamente, Pasten, Pulver und Supplemente mit Dosis']]],
['Vorfall','drop',[['vomit','Spucken','Spuck-Ereignisse mit Foto und Zuordnung zum Futter der letzten 12 Std.'],['stool','Kot','Kotbeschaffenheit mit Bristol-Skala und Fotos'],['finding','Auffälligkeiten','Haut, Wunden und Ohren mit Fotos']]],
['Gesundheit','pulse',[['medical','Medizin & Notfall-Info','Allergien, Vorerkrankungen und Dauermedikation'],['vaccination','Impfpass','Impfungen mit Ablaufdatum und Erinnerung'],['values','Messwerte & Trend','Gewicht, Größe, Temperatur und eigene Werte mit Verlaufskurve'],['treatment','Behandlungen','Post-OP- und Behandlungsphasen mit Protokoll und Erinnerungen'],['petinfo','Tierinfo im Eintragen-Menü','Stammdaten, Impfstatus, Notfall-Info und Tierarzt direkt abrufen (nur lesend)']]],
['Auswertung & Berichte','chart',[['stats','Auswertung','Lieblingsfutter und Verträglichkeits-Radar'],['report','Bericht','Druckfertiger Bericht für den Tierarzt (PDF)']]],
['Erinnerungen','bell',[['push','Push-Erinnerungen','Fütterung, Geburtstage, Impfungen und Behandlungen']]]];
const FKEYS=FG.flatMap(g=>g[2].map(x=>x[0]));
const moreItems=()=>[
  ['catalog','Katalog','Hersteller, Sorten, Präparate, Kategorien, Bewertung','book',feedOn()||ft('vomit')],
  ['vets','Tierarztpraxen','Adressbuch für Berichte und Tier-Akte','steth',ft('medical')||ft('report')],
  ['push','Erinnerungen','Push-Benachrichtigungen','bell',ft('push')],
  ['sync','Synchronisation','Verbindung und Offline-Einträge','repeat',true],
  ['features','Funktionen','Funktionen ein- und ausschalten','toggle',true],
  ['look','Darstellung','Design, Sprache, Header-Tier, Eingabe','palette',true],
  ['backup','Daten & Backup','CSV-Export und Datenbank-Sicherung','db',true],
  ['account','Konto & Benutzer','Anmeldung und weitere Benutzer','user',true]].filter(x=>x[4]);
A.mopen=d=>{S.more=d.v;if(d.v=='account')loadUsers();if(d.v=='sync')refreshPending().then(render)};A.mback=()=>{S.more=''};
const MT={sync:'Synchronisation',catalog:'Katalog',vets:'Tierarztpraxen',push:'Erinnerungen',features:'Funktionen',look:'Darstellung',backup:'Daten & Backup',account:'Konto & Benutzer'};
function vMore(){
  if(!S.more||!moreItems().some(x=>x[0]==S.more))S.more='';
  if(!S.more)return`<div class="rows list">${moreItems().map(([k,t,d,i])=>`<button class="li link big" data-a="mopen" data-v="${k}"><span class="ti">${ico(i,20)}</span><span class="grow"><b>${t}</b><small class="muted">${d}</small></span>${ico('chev',18)}</button>`).join('')}</div><p class="muted fine center">${esc(window.APP_NAME||'')}</p>${SECURE?'':`<p class="muted fine center">${ico('lock',12)} http-Verbindung: Offline-Start, Erinnerungen, Teilen und Zwischenablage funktionieren nur über https.</p>`}`;
  const body={sync:vSync,catalog:vCatalog,vets:vVets,push:pushCard,features:vFeatures,look:vLook,backup:vBackup,account:vAccount}[S.more]();
  return`<button class="back" data-a="mback">${ico('back',18)} Mehr</button><h2 class="ph">${MT[S.more]}</h2>${body}`}

/* ---------- Katalog ---------- */
const catKinds=()=>[['food','Futter','bowl',ft('food')],['snack','Snacks','cookie',ft('snack')],['drink','Getränke','glass',ft('drink')],['meds','Präparate','pill',ft('meds')],['vomit','Spuck-Kategorien','drop',ft('vomit')],['vacc','Impfungen','syringe',ft('vaccination')],['rating','Bewertung','star',ft('food')||ft('snack')||ft('drink')]].filter(x=>x[3]);
function vCatalog(){const ks=catKinds();if(!ks.some(x=>x[0]==S.ck))S.ck=ks[0]?ks[0][0]:'food';
  const k=S.ck;let o=`<div class="chips scroll">${ks.map(([id,l,i])=>chip('ck',id,k==id,ico(i,14)+' '+l)).join('')}</div>`;
  if(k=='food'||k=='snack'||k=='drink'){
    if(k=='drink')o+=card('Standardgetränk',sel('pr.dd',CAT.drink.flatMap(m=>m.foods).map(f=>[f.name,f.name]),{ch:'pdrink'}));
    o+=CAT[k].map(m=>{const open=S.co['m'+m.id];return`<section class="card man"><div class="row nowrap"><button class="ib" data-a="coll" data-id="m${m.id}" aria-label="Auf- oder zuklappen">${ico(open?'back':'chev',16)}</button><input type="text" class="b" data-e="manr" data-i="${m.id}" value="${esc(m.name)}"><span class="muted">${m.foods.length}</span><button class="ib dng" data-a="delman" data-id="${m.id}" aria-label="Löschen">${ico('trash',16)}</button></div>
    ${open?`<div class="sub">${m.foods.map(f=>`<div class="row nowrap"><input type="text" data-e="foodr" data-i="${f.id}" data-m="${m.id}" value="${esc(f.name)}"><button class="ib dng" data-a="delfood" data-id="${f.id}" data-n="${esc(f.name)}" aria-label="Löschen">${ico('x',14)}</button></div>`).join('')}<div class="inl">${inp('nv.f'+m.id,{ph:'Neue Sorte …'})}<button class="btn sm ghost" data-a="addfood" data-id="${m.id}">OK</button></div></div>`:''}</section>`}).join('')||'<p class="muted">Noch kein Eintrag.</p>';
    o+=card('Neuer Hersteller',`<div class="inl">${inp('nv.man',{ph:'Name des Herstellers'})}<button class="btn sm primary" data-a="addman">Anlegen</button></div>`)}
  if(k=='meds')o+=unitList()+MEDS.map(m=>card('',`<div class="row nowrap"><input type="text" class="b" data-e="medn" data-i="${m.id}" value="${esc(m.name)}"><button class="ib dng" data-a="delmed" data-id="${m.id}" aria-label="Löschen">${ico('trash',16)}</button></div><div class="grid2" style="margin-top:8px">${field('Standardmenge',`<input type="text" inputmode="decimal" data-e="medd" data-i="${m.id}" value="${esc(m.dose)}" placeholder="z. B. 1 oder 20">`)}${field('Einheit (fest)',`<input type="text" list="ulist" data-e="medu" data-i="${m.id}" value="${esc(m.unit)}" placeholder="z. B. Tablette, mg">`)}</div>`)).join('')+
    card('Neues Präparat',`${field('Name',inp('nv.mn',{ph:'Neues Präparat …'}))}<div class="grid2">${field('Standardmenge',inp('nv.md',{ph:'z. B. 1 oder 20'}))}${field('Einheit (fest)',`<input type="text" list="ulist" data-b="nv.mu" value="${esc(S.nv.mu||'')}" placeholder="z. B. Tablette, mg">`)}</div><button class="btn primary block" data-a="addmed">Anlegen</button><p class="muted fine">Die Einheit steht fest, beim Eintragen änderst du nur die Menge (z. B. 1 Tablette oder 20 mg). Löschen entfernt das Präparat nur aus der Auswahl; bisherige Einträge bleiben im Verlauf.</p>`);
  if(k=='vomit')o+=card('',`${VT.filter(t=>!t.hidden).map(t=>`<div class="row nowrap rowgap"><input type="text" class="em" data-e="vte" data-k="${t.key}" value="${esc(t.emoji)}" aria-label="Symbol"><input type="text" data-e="vtl" data-k="${t.key}" value="${esc(t.label)}"><label class="sw" title="futterrelevant"><input type="checkbox" data-e="vtr" data-k="${t.key}" ${t.relevant?'checked':''}><i></i></label>${t.key[0]=='c'?`<button class="ib dng" data-a="delvt" data-k="${t.key}" aria-label="Löschen">${ico('trash',16)}</button>`:''}</div>`).join('')}
    <div class="inl">${inp('nv.vte',{ph:'Symbol'}).replace('<input','<input class="em"')}${inp('nv.vtl',{ph:'Neue Kategorie …'})}<button class="btn sm primary" data-a="addvt">Anlegen</button></div><p class="muted fine">Schalter an = futterrelevant (zählt für die 12-h-Zuordnung).</p>`);
  if(k=='vacc')o+=card('Impfarten',`<p class="muted">Grundimmunisierung und Tollwut sind fest. Alle weiteren Impfarten legst du selbst an; sie stehen dann beim Eintragen im Impfpass zur Auswahl.</p>${VTYPES.map(t=>t.builtin?`<div class="row nowrap rowgap"><input type="text" value="${esc(t.name)}" disabled><span class="ti">${ico('lock',16)}</span></div>`:`<div class="row nowrap rowgap"><input type="text" data-e="vtn" data-i="${t.id}" value="${esc(t.name)}"><button class="ib dng" data-a="delvtype" data-id="${t.id}" aria-label="Löschen">${ico('trash',16)}</button></div>`).join('')}<div class="inl">${inp('nv.vt',{ph:'Neue Impfart …'})}<button class="btn sm primary" data-a="addvtype">Anlegen</button></div>`);
  if(k=='rating')o+=card('',`${RL.map(r=>`<div class="row nowrap rowgap"><input type="text" class="em" data-e="rte" data-i="${r.score}" value="${esc(r.emoji)}" aria-label="Symbol"><input type="text" data-e="rtl" data-i="${r.score}" value="${esc(r.label)}"><span class="muted">${r.score}</span></div>`).join('')}
    <div class="row"><button class="btn sm ghost" data-a="addrt">${ico('plus',14)} Stufe hinzufügen</button>${NR()>2?`<button class="btn sm ghost" data-a="delrt">Oberste Stufe entfernen</button>`:''}</div><p class="muted fine">Oben = beste Bewertung (${NR()}), unten = schlechteste (1).</p>`);
  return o}
A.ck=d=>{S.ck=d.v};A.coll=d=>{S.co[d.id]=!S.co[d.id]};
A.addman=T(async()=>{const n=(S.nv.man||'').trim();if(!n)return;await API('POST','/api/catalog/manufacturers',{name:n,kind:S.ck});S.nv.man='';return()=>toast('Hersteller angelegt')});
A.addfood=T(async d=>{const n=(S.nv['f'+d.id]||'').trim();if(!n)return;await API('POST','/api/foods',{manufacturer_id:+d.id,name:n});S.nv['f'+d.id]=''});
A.delman=d=>{const m=CAT[S.ck].find(x=>x.id==d.id);ask('Hersteller löschen?',`„${m?m.name:''}“ und alle ${m?m.foods.length:0} zugehörigen Sorten werden aus der Auswahl gelöscht.`,T(async()=>{await API('DELETE','/api/manufacturers/'+d.id)}));return false};
A.delfood=d=>{ask('Sorte löschen?',`„${d.n}“ wird aus der Auswahl gelöscht.`,T(async()=>{await API('DELETE','/api/foods/'+d.id)}));return false};
A.addmed=T(async()=>{const n=(S.nv.mn||'').trim();if(!n)return;await API('POST','/api/meds',{name:n,dose:S.nv.md||'',unit:S.nv.mu||''});S.nv.mn='';S.nv.md='';S.nv.mu='';return()=>toast('Präparat angelegt')});
A.delmed=d=>{const m=MEDS.find(x=>x.id==d.id)||{};ask('Präparat löschen?',`„${m.name||''}“ wird aus der Auswahl entfernt. Bisherige Einträge behalten ihren Namen.`,T(async()=>{await API('DELETE','/api/meds/'+d.id)}));return false};
A.addvt=T(async()=>{const l=(S.nv.vtl||'').trim();if(!l)return;await API('POST','/api/vomit-types',{label:l,emoji:S.nv.vte||'',relevant:true});S.nv.vtl='';S.nv.vte=''});
A.delvt=d=>{const t=vtl(d.k);ask('Kategorie löschen?',`„${t.label}“ wird aus der Auswahl entfernt. Bestehende Einträge behalten ihren Namen.`,T(async()=>{await API('DELETE','/api/vomit-types/'+d.k)}));return false};
A.addvtype=T(async()=>{const n=(S.nv.vt||'').trim();if(!n)return;await API('POST','/api/health/vaccine-types',{name:n});S.nv.vt='';return()=>toast('Impfart angelegt')});
A.delvtype=d=>{const t=VTYPES.find(x=>x.id==d.id)||{};ask('Impfart löschen?',`„${t.name||''}“ wird aus der Auswahl entfernt. Bestehende Impfpass-Einträge behalten den Namen.`,T(async()=>{await API('DELETE','/api/health/vaccine-types/'+d.id)}));return false};
const syncR=()=>API('PUT','/api/rating-levels',RL.map(x=>({score:x.score,label:x.label,emoji:x.emoji||''})));
A.addrt=T(async()=>{const n=NR()+1;if(n>7){toast('Maximal 7 Stufen');return}RL=[{score:n,label:'Neue Stufe',emoji:''},...RL];await syncR()});
A.delrt=T(async()=>{const n=NR();if(B0.some(b=>Object.values(b.cats).includes(n))){toast('Diese Stufe wird noch verwendet');return}RL=RL.filter(x=>x.score!=n);await syncR()});
Object.assign(E,{
  manr:T(async t=>{const m=CAT[S.ck].find(x=>x.id==t.dataset.i),v=t.value.trim();if(!m||!v||v==m.name)return;await API('PUT','/api/manufacturers/'+m.id,{name:v})}),
  foodr:T(async t=>{await API('PUT','/api/foods/'+t.dataset.i,{manufacturer_id:+t.dataset.m,name:t.value.trim()})}),
  medn:T(async t=>{const m=MEDS.find(x=>x.id==t.dataset.i),v=t.value.trim();if(!m||!v||v==m.name)return;await API('PUT','/api/meds/'+m.id,{name:v,dose:m.dose,unit:m.unit})}),
  medd:T(async t=>{const m=MEDS.find(x=>x.id==t.dataset.i);if(!m||t.value.trim()==m.dose)return;await API('PUT','/api/meds/'+m.id,{name:m.name,dose:t.value.trim(),unit:m.unit})}),
  medu:T(async t=>{const m=MEDS.find(x=>x.id==t.dataset.i);if(!m||t.value.trim()==m.unit)return;await API('PUT','/api/meds/'+m.id,{name:m.name,dose:m.dose,unit:t.value.trim()})}),
  vte:T(async t=>vtSave(t)),vtl:T(async t=>vtSave(t)),vtr:T(async t=>vtSave(t)),
  rte:T(async t=>{const x=RL.find(r=>r.score==t.dataset.i);x.emoji=[...t.value.trim()][0]||'';await syncR()}),
  rtl:T(async t=>{const x=RL.find(r=>r.score==t.dataset.i);if(t.value.trim())x.label=t.value.trim();await syncR()}),
  pdrink:T(async t=>{await API('PUT','/api/default-drink',{name:t.value})}),
  vtn:T(async t=>{const x=VTYPES.find(v=>v.id==t.dataset.i),v=t.value.trim();if(!x||!v||v==x.name)return;await API('PUT','/api/health/vaccine-types/'+x.id,{name:v})}),
  vetf:T(async t=>{const c=t.closest('[data-vet]'),g=k=>c.querySelector(`[data-vf=${k}]`).value;await API('PUT','/api/vets/'+t.dataset.i,{name:g('name'),address:g('address'),phone:g('phone'),email:g('email')})}),
  pall:t=>{PREFS.autoAll=t.checked?1:0;savePrefs()},
  ft:t=>{FT[t.dataset.k]=t.checked;ftSave()},
  wz:t=>{if(WZ)WZ[t.dataset.k]=t.checked}});
async function vtSave(t){const x=VT.find(v=>v.key==t.dataset.k);if(!x)return;const e=t.dataset.e;if(e=='vte')x.emoji=[...t.value.trim()][0]||'';if(e=='vtl'&&t.value.trim())x.label=t.value.trim();if(e=='vtr')x.relevant=t.checked;await API('PUT','/api/vomit-types/'+x.key,{label:x.label,emoji:x.emoji,relevant:x.relevant})}
S.pr={dd:''};
Object.defineProperty(S.pr,'dd',{get:()=>DD,set:v=>{DD=v},enumerable:true});

/* ---------- Tierarztpraxen ---------- */
function vVets(){return`<p class="muted">Das Adressbuch gilt für alle Tiere. Welche Praxis zu welchem Tier gehört, stellst du in der Tier-Akte ein.</p>
${VETS.map(v=>`<section class="card" data-vet="${v.id}"><div class="grid2">${field('Name der Praxis',`<input type="text" data-e="vetf" data-i="${v.id}" data-vf="name" value="${esc(v.name)}">`)}${field('Telefon',`<input type="tel" data-e="vetf" data-i="${v.id}" data-vf="phone" value="${esc(v.phone)}">`)}${field('E-Mail',`<input type="email" data-e="vetf" data-i="${v.id}" data-vf="email" value="${esc(v.email)}">`)}</div>${field('Adresse',`<textarea rows="2" data-e="vetf" data-i="${v.id}" data-vf="address">${esc(v.address)}</textarea>`)}<button class="btn ghost block dngtxt" data-a="delVet" data-id="${v.id}">${ico('trash',16)} Praxis entfernen</button></section>`).join('')}
${card('Neue Praxis',`<div class="grid2">${field('Name der Praxis',inp('nv.vn',{ph:'z. B. Tierarztpraxis Dr. Meier'}))}${field('Telefon',inp('nv.vp'))}${field('E-Mail',inp('nv.ve'))}</div>${field('Adresse',ta('nv.va','Straße, PLZ Ort'))}<button class="btn primary block" data-a="addVet">Praxis anlegen</button>`)}`}
A.addVet=T(async()=>{const n=(S.nv.vn||'').trim();if(!n){toast('Bitte den Namen der Praxis eingeben');return}await API('POST','/api/vets',{name:n,address:S.nv.va||'',phone:S.nv.vp||'',email:S.nv.ve||''});['vn','va','vp','ve'].forEach(k=>S.nv[k]='');return()=>toast('Praxis angelegt')});
A.delVet=d=>{const v=VETS.find(x=>x.id==d.id)||{};ask('Praxis entfernen?',`„${v.name||''}“ wird aus dem Adressbuch gelöscht. Tiere, die diese Praxis hatten, verlieren nur die Zuordnung.`,T(async()=>{await API('DELETE','/api/vets/'+d.id)}));return false};

/* ---------- Funktionen ---------- */
const ftRows=(g,src,attr)=>g[2].map(([k,l,d])=>swc(`data-e="${attr}" data-k="${k}"`,l,src[k]!==false,d)).join('');
function vFeatures(){return`<p class="muted">Blende Funktionen aus, die du nicht brauchst. Es wird nur die Anzeige ausgeblendet – alle gespeicherten Daten bleiben erhalten und sind nach dem Wieder-Einschalten sofort da.</p><div class="infobox">Diese Auswahl gilt nur für dein Konto – jeder Benutzer hat seine eigene Ansicht, auch beim Design.</div>
${FG.map((g,i)=>card(`<span class="h2i">${ico(g[1],16)}${g[0]}</span>`,ftRows(g,FT,'ft')+(g[2].length>1?`<div class="row" style="margin-top:10px"><button class="chip sm" data-a="ftgrp" data-g="${i}" data-v="1">Alle an</button><button class="chip sm" data-a="ftgrp" data-g="${i}" data-v="0">Alle aus</button></div>`:''))).join('')}
<p class="muted fine">Immer sichtbar: Verlauf, Tiere, Darstellung, Konto und die Datensicherung.</p>`}
let ftT=null;
const ftSave=()=>{clearTimeout(ftT);ftT=setTimeout(async()=>{try{await API('PUT','/api/features',{features:FT})}catch(e){try{FT=(await API('GET','/api/features')).features||{}}catch(_){}}render()},250)};
A.ftgrp=d=>{FG[+d.g][2].forEach(([k])=>{FT[k]=d.v=='1'});ftSave()};
/* Erst-Auswahl (einmalig pro Benutzer) */
let WZON=0;
function renderWizard(){const el=$('#wz');if(!WZ){el.className='';el.innerHTML='';return}el.className='on';
  el.innerHTML=`<div class="card wz"><div class="lbl">Sprache / Language</div><div class="chips">${Object.keys((window.I18N||{}).languages||{de:1}).map(k=>chip('wzlang',k,LANG==k,k.toUpperCase())).join('')}</div>
  <h2 class="ph" style="margin-top:16px">Willkommen${window.APP_NAME?' bei '+esc(window.APP_NAME):''}</h2><p>Diese App kann viel – aber nicht jeder Haushalt braucht alles. Wähle jetzt, welche Funktionen du nutzen möchtest.</p>
  <p class="muted">Nicht gewählte Funktionen werden nur ausgeblendet. Gespeicherte Daten gehen nie verloren. Diese Auswahl gilt nur für dein Konto – jeder Benutzer hat seine eigene Ansicht, auch beim Design.</p><div class="infobox">Du kannst das jederzeit unter Mehr → Funktionen ändern.</div>
  <div class="row" style="margin:14px 0"><button class="chip sm" data-a="wzall">Alles aktivieren</button><button class="chip sm" data-a="wzbasic">Nur Basis (Füttern & Spucken)</button></div>
  ${FG.map(g=>`<div class="wzg"><div class="lbl">${g[0]}</div>${ftRows(g,WZ,'wz')}</div>`).join('')}<button class="btn primary block" data-a="wzdone">Los geht’s</button></div>`}
A.wzall=()=>{FKEYS.forEach(k=>{WZ[k]=true})};A.wzbasic=()=>{FKEYS.forEach(k=>{WZ[k]=['food','snack','drink','vomit'].includes(k)})};A.wzlang=d=>{setLang(d.v)};
A.wzdone=async()=>{if(!WZ)return false;const f={...WZ};try{await API('PUT','/api/features',{features:f,setup_done:true})}catch(e){return false}FT=f;FT_DONE=true;WZ=null;render();toast('Gespeichert – später änderbar unter Mehr → Funktionen');return false};
function maybeWizard(){if(!FT_DONE&&ME&&!WZON){WZON=1;WZ=Object.fromEntries(FKEYS.map(k=>[k,ft(k)]));render()}}

/* ---------- Darstellung ---------- */
const NL={bg:'#fdfbff',card:'#ffffff',ink:'#1b1b1f',mut:'#5f5e66',line:'#e3e1ec',onacc:'#ffffff',good:'#1e7a3c',ok:'#1a5fb4',bad:'#b3261e'},ND={bg:'#121316',card:'#1d1e22',ink:'#e4e2e6',mut:'#c7c5d0',line:'#46464f',good:'#7ddb9a',ok:'#9fc4ff',bad:'#ffb4ab'};
const mkP=(name,a,hl,h2l,ad,oad,hd,h2d)=>({name,light:{...NL,acc:a,hg1:hl,hg2:h2l},dark:{...ND,acc:ad,onacc:oad,hg1:hd,hg2:h2d}});
const PRESETS=[{name:'Standard (warm)',sw:'#c8563a'},mkP('Material Violett','#6750a4','#eaddff','#e8def8','#d0bcff','#381e72','#4f378b','#4a4458'),mkP('Material Blau','#1a73e8','#d3e3fd','#c2e7ff','#a8c7fa','#062e6f','#0842a0','#004a77'),mkP('Material Grün','#1e8e3e','#c4eed0','#d3e8d3','#6dd58c','#0a3818','#0f5223','#1d4b2c'),mkP('Material Türkis','#00696b','#9cf1f2','#cce8e7','#4cdada','#003737','#004f50','#324b4b'),mkP('Material Orange','#9a4600','#ffdcc2','#ffe1c4','#ffb784','#4f2500','#733600','#5b4235'),mkP('Material Rot','#b3261e','#ffdad6','#f9dedc','#ffb4ab','#690005','#93000a','#5c3f3d'),mkP('Material Rosa','#984061','#ffd9e2','#fde0e8','#ffb1c8','#5e1133','#7b2949','#5b3f45'),mkP('Material Graphit','#455a64','#cfd8dc','#eceff1','#b0bec5','#263238','#37474f','#455a64')];
A.preset=d=>{const p=PRESETS[+d.v];if(p.light){PREFS.ui.light={...p.light};PREFS.ui.dark={...p.dark}}else{delete PREFS.ui.light;delete PREFS.ui.dark}PREFS.ui.preset=p.name;delete PREFS.ui.tc;applyTheme();savePrefs()};
const hexc=x=>{x=(x||'').trim();return/^#[0-9a-f]{6}$/i.test(x)?x:'#888888'};
const hpvIdx=()=>{const sel=PREFS.ui.hs&&PREFS.ui.hs.length?PREFS.ui.hs:[PREFS.ui.cat||0];return S.hpv!=null&&ART[S.hpv]?S.hpv:sel[0]};
function vLook(){const U=PREFS.ui,th=PREFS.theme||'auto',dk=isDark(),cs=getComputedStyle(document.documentElement),on=i=>(U.hs||[U.cat||0]).includes(i),pi=hpvIdx();
  const rg=(a,b)=>Array.from({length:b-a},(_,k)=>chip('hs',a+k,on(a+k),ART[a+k][0])).join('');
  const fs=(k,L,d,t)=>`<label class="cp"><span>${t}</span><select data-e="font" data-k="${k}">${L.map(n=>`<option ${(U[k]||d)==n?'selected':''}>${n}</option>`).join('')}</select></label>`;
  return card('Erscheinungsbild',`${seg([['auto','Automatisch','theme'],['light','Hell','theme'],['dark','Dunkel','theme']],th,'theme')}<p class="muted" style="margin:0">Du bearbeitest gerade den <b>${dk?'Dunkelmodus':'Hellmodus'}</b>. Beide Modi haben getrennte Farben.</p>`)+
  card('Navigation',`${seg([['','Automatisch'],['web','Seitenleiste'],['pwa','Untere Leiste']],U.view||'','view')}<p class="muted fine">Automatisch: im Browser als Seitenleiste, in der installierten App als untere Leiste.</p>`)+
  card('Farbthemen',`<p class="muted">Wähle ein Farbthema (angelehnt an Material Design). Darunter kannst du jede Farbe weiter individuell anpassen.</p><div class="chips">${PRESETS.map((p,i)=>`<button type="button" class="chip ${(U.preset||'Standard (warm)')==p.name?'on':''}" data-a="preset" data-v="${i}"><i class="sdot" style="background:${p.sw||p.light.acc}"></i>${p.name}</button>`).join('')}</div>${U.preset=='custom'?'<p class="muted fine">Eigene Anpassung aktiv.</p>':''}`)+
  card('Farben',CK.map(([k,l])=>`<label class="cp"><span>${l}</span><input type="color" data-col="${k}" value="${hexc(cs.getPropertyValue('--'+k))}"></label>`).join('')+`<label class="cp"><span>Logo- & Statusleistenfarbe<small class="muted">Standard: Farbe der Navigationsleiste</small></span><input type="color" data-tc value="${navColor()}"></label>`)+
  card('Schrift',fs('fh',FHL,'Fraunces','Überschriften')+fs('fb',FBL,'Inter','Fließtext')+`<label class="cp"><span>Schriftgröße <output id="fso">${U.fs||15}px</output></span><input type="range" min="13" max="19" step="1" value="${U.fs||15}" data-fs></label>`)+
  card('Sprache',`<p class="muted">Sprache der Oberfläche und der Exporte.</p><div class="chips">${Object.entries((window.I18N||{}).languages||{de:'Deutsch'}).map(([k,n])=>chip('setlang',k,LANG==k,esc(n))).join('')}</div>`)+
  card('Eingabe',swc('data-e="pall"','Alle Tiere beim Füttern vorauswählen',PREFS.autoAll!==0&&PREFS.autoAll!==false)+swc('data-e="prskip"','Bei „Wie zuletzt füttern“ die Bewertung abfragen',!PREFS.repeatSkip,'Aus: Die Bewertungen der letzten Fütterung werden 1:1 übernommen'))+
  card('Tierbilder',swc('data-e="pphoto"','Tierfotos statt Avatare verwenden',!!PREFS.photoAv,'Zeigt das Foto überall dort, wo sonst der Avatar mit Initiale steht (sofern ein Foto hinterlegt ist)'))+
  card('Header-Tier',`<p class="muted">Wähle ein oder mehrere Tiere für die Startseite. Beim Öffnen wechselt die App zufällig zwischen ihnen. Tippe ein Tier an, um die Vorschau zu sehen.</p><div class="lbl">Katze</div><div class="chips">${rg(0,CATD.length)}</div><div class="lbl" style="margin-top:12px">Hund</div><div class="chips">${rg(CATD.length,CATD.length+DOGD.length)}</div><div class="lbl" style="margin-top:12px">Ohne Tier</div><div class="chips">${chip('hs',ART.length-1,on(ART.length-1),'Keine')}</div>
  ${ART[pi]&&ART[pi][1]?`<div class="cpvs">${[['sleepy','Morgens'],['wake','Tagsüber'],['happy','Abends'],['sleep','Nachts']].map(([s,l])=>`<div class="cpvw"><div class="cpv" data-i="${pi}" data-s="${s}"></div>${l}</div>`).join('')}</div>`:''}`)+
  `<button class="btn ghost block" data-a="dreset">Design zurücksetzen</button>`}
A.theme=d=>{PREFS.theme=d.v;applyTheme();savePrefs()};
A.view=d=>{if(d.v)PREFS.ui.view=d.v;else delete PREFS.ui.view;applyTheme();savePrefs()};
A.togtheme=()=>{PREFS.theme=isDark()?'light':'dark';applyTheme();savePrefs()};
A.dreset=()=>{['light','dark','fh','fb','fs','tc','preset'].forEach(k=>delete PREFS.ui[k]);applyTheme();savePrefs();toast('Design zurückgesetzt')};
A.setlang=d=>{setLang(d.v)};
A.hs=d=>{const i=+d.v;S.hpv=i;const s=new Set(PREFS.ui.hs||[PREFS.ui.cat||0]);if(s.has(i)){if(s.size>1)s.delete(i)}else s.add(i);PREFS.ui.hs=[...s];HI=null;savePrefs()};
Object.assign(E,{font:t=>{PREFS.ui[t.dataset.k]=t.value;applyTheme();savePrefs()},pphoto:t=>{PREFS.photoAv=t.checked?1:0;savePrefs()},prskip:t=>{PREFS.repeatSkip=t.checked?0:1;savePrefs()}});

/* ---------- Backup & Konto ---------- */
function vBackup(){return card('Datensicherung',`<p class="muted">Lädt eine vollständige Sicherung der Datenbank (.db) herunter: Tiere, Einträge, Gesundheitsdaten, Einstellungen und Benutzerkonten. Hochgeladene Fotos liegen im Ordner data/uploads und werden separat gesichert.</p>${ME&&ME.is_admin?`<button class="btn primary block" data-a="dbdump">${ico('download',18)} Datenbank sichern</button>`:'<p class="muted">Die Datensicherung ist nur für Administratoren verfügbar.</p>'}`)+
  card('Export',`<p class="muted">Alle Fütterungen als CSV (Semikolon-getrennt, direkt in Excel nutzbar).</p><button class="btn ghost block" data-a="expCsv">${ico('download',18)} CSV exportieren</button>`)}
A.dbdump=()=>{location.href='/api/export/db';return false};A.expCsv=()=>{location.href='/api/export/csv?lang='+LANG;return false};
let USERS=[];
async function loadUsers(){if(!ME||!ME.is_admin)return;try{USERS=await API('GET','/api/users')}catch(e){}render()}
const userEdit=(u,me)=>`<div class="ue">${field('Benutzername',inp('ue.name'))}${field('Neues Passwort',`<input type="password" data-b="ue.pw" value="${esc(S.ue.pw||'')}" placeholder="leer lassen = unverändert (mind. 8 Zeichen)" autocomplete="new-password">`)}${sw('ue.admin','Administrator')}<p class="muted fine">Ein neues Passwort meldet alle Geräte dieses Benutzers ab.</p><div class="row nowrap" style="margin-top:8px"><button class="btn primary" data-a="usave">Speichern</button>${me?'':`<button class="btn ghost dngtxt" data-a="udel" data-id="${u.id}">${ico('trash',16)} Löschen</button>`}</div></div>`;
function vAccount(){
  let o=card('Konto',`<p>Angemeldet als <b>${esc(ME?ME.username:'')}</b>${ME&&ME.is_admin?' (Administrator)':''}</p><button class="btn ghost block" data-a="logout">${ico('logout',18)} Abmelden</button>`);
  const pwi=(p,ac)=>`<input type="password" data-b="${p}" value="${esc(getPath(p)||'')}" autocomplete="${ac}">`;
  o+=card('Passwort ändern',`${field('Aktuelles Passwort',pwi('pw.cur','current-password'))}${field('Neues Passwort (mind. 8 Zeichen)',pwi('pw.n1','new-password'))}${field('Neues Passwort wiederholen',pwi('pw.n2','new-password'))}<button class="btn primary block" data-a="pwsave">Passwort ändern</button><p class="muted fine">Alle anderen Geräte werden dabei abgemeldet.</p>`);
  if(ME&&ME.is_admin){
    o+=card('Benutzer verwalten',`<div class="rows">${USERS.map(u=>{const me=u.id==ME.id,op=S.uedit==u.id;return`<div class="li col"><div class="row between nowrap"><span class="row nowrap"><span class="ti">${ico('user',18)}</span><span><b>${esc(u.username)}</b>${me?' <small class="muted">(du)</small>':''}</span></span><span class="row nowrap">${u.is_admin?pill('Administrator','ok'):pill('Benutzer')}<button class="chip sm" data-a="uedit" data-id="${u.id}">${op?'Schließen':'Bearbeiten'}</button></span></div>${op?userEdit(u,me):''}</div>`}).join('')||'<p class="muted">Lade …</p>'}</div>`);
    o+=card('Neuen Benutzer anlegen',`${field('Benutzername',inp('nv.un',{x:'autocomplete="off"'}))}${field('Passwort (mind. 8 Zeichen)',`<input type="password" data-b="nv.up" value="${esc(S.nv.up||'')}" autocomplete="new-password">`)}<button class="btn primary block" data-a="addUser">Anlegen</button>`)}
  return o}
A.pwsave=async()=>{const p=S.pw;if(!p.cur||!p.n1)return false;if(p.n1.length<8){toast('Neues Passwort mind. 8 Zeichen');return false}if(p.n1!=p.n2){toast('Die neuen Passwörter stimmen nicht überein');return false}
  try{await API('PUT','/api/me/password',{current:p.cur,new:p.n1});toast('Passwort geändert');S.pw={cur:'',n1:'',n2:''}}catch(e){}render();return false};
A.uedit=d=>{if(S.uedit==d.id){S.uedit=null;return}const u=USERS.find(x=>x.id==d.id);S.uedit=u.id;S.ue={name:u.username,pw:'',admin:u.is_admin}};
async function refreshMe(){try{const st=await fetch('/api/auth/status',{credentials:'same-origin'}).then(r=>r.json());if(st.user)ME=st.user}catch(e){}}
A.usave=async()=>{const u=USERS.find(x=>x.id==S.uedit),e=S.ue,b={};if(!u)return false;
  if(e.name.trim()&&e.name.trim()!=u.username)b.username=e.name.trim();if(e.pw)b.password=e.pw;if(!!e.admin!=u.is_admin)b.is_admin=!!e.admin;
  if(!Object.keys(b).length){toast('Keine Änderung');return false}
  try{await API('PUT','/api/users/'+u.id,b);toast('Benutzer aktualisiert');S.uedit=null;await refreshMe();await loadUsers()}catch(x){}return false};
A.udel=d=>{const u=USERS.find(x=>x.id==d.id)||{};ask('Benutzer löschen?',`„${u.username||''}“ wird samt Anmeldung entfernt. Bereits erfasste Einträge bleiben erhalten.`,async()=>{try{await API('DELETE','/api/users/'+d.id);S.uedit=null;toast('Benutzer gelöscht');await loadUsers()}catch(x){}});return false};
A.logout=async()=>{try{await API('POST','/api/logout')}catch(e){}location.reload();return false};
A.addUser=async()=>{const u=(S.nv.un||'').trim(),p=S.nv.up||'';if(!u||!p)return false;try{await API('POST','/api/users',{username:u,password:p});toast('Benutzer „'+u+'“ angelegt');S.nv.un='';S.nv.up='';await loadUsers()}catch(e){}render();return false};

/* ---------- Push-Erinnerungen ---------- */
const PUSH={ok:false,avail:false,key:null,sub:false,slots:[]};
const b64u=s=>{const r=atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
const pushSend=s=>{const j=s.toJSON();return API('POST','/api/push/subscribe',{endpoint:j.endpoint,keys:j.keys,lang:LANG,tz:-new Date().getTimezoneOffset()})};
async function pushInit(){PUSH.ok=!!(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
  try{const st=await API('GET','/api/push/status');PUSH.avail=st.available;PUSH.key=st.public_key;if(st.available)PUSH.slots=await API('GET','/api/push/preview')}catch(e){}
  if(PUSH.ok&&PUSH.avail){try{const reg=await navigator.serviceWorker.getRegistration('/'),s=reg&&await reg.pushManager.getSubscription();PUSH.sub=!!s;if(s&&Notification.permission=='granted')await pushSend(s)}catch(e){}}}
A.pushOn=async()=>{try{const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;if(await Notification.requestPermission()!='granted'){toast('Benachrichtigungen wurden nicht erlaubt');return}
  const s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(PUSH.key)});await pushSend(s);PUSH.sub=true;toast('Erinnerungen aktiviert')}catch(e){console.warn(e);toast('Aktivierung fehlgeschlagen')}render()};
A.pushOff=async()=>{try{const reg=await navigator.serviceWorker.getRegistration('/'),s=reg&&await reg.pushManager.getSubscription();if(s){await API('POST','/api/push/unsubscribe',{endpoint:s.endpoint});await s.unsubscribe()}PUSH.sub=false;toast('Erinnerungen deaktiviert')}catch(e){console.warn(e)}render()};
const pushTest=k=>async()=>{try{const r=await API('POST','/api/push/test'+(k?'?kind='+k:''));toast(r.sent?'Testnachricht gesendet':'Keine Nachricht gesendet')}catch(e){}return false};
Object.assign(A,{pushTest:pushTest(''),pushTestB:pushTest('birthday'),pushTestV:pushTest('vaccination'),pushTestT:pushTest('treatment')});
function pushCard(){let b;
  if(!PUSH.ok)b='<p class="muted">Benachrichtigungen funktionieren nur über HTTPS und in der installierten App (iPhone: „Zum Home-Bildschirm“, ab iOS 16.4).</p>';
  else if(!PUSH.avail)b='<p class="muted">Der Server hat noch keine Push-Unterstützung. Installiere im Container das Paket „pywebpush“.</p>';
  else b=`<p class="muted">Erinnerung ca. 2 Stunden nach den üblichen Fütterungszeiten, falls bis dahin kein Futter eingetragen wurde (Snacks und Getränke zählen nicht). Dazu kommen Geburtstags-Nachrichten (zwei Wochen vorher und am Geburtstag um 09:00 Uhr) und Impf-Erinnerungen. ${PUSH.slots.length?`Erkannte Zeiten: <b>${PUSH.slots.map(s=>s.time+' → '+s.reminder).join(', ')}</b>.`:'Noch keine Fütterungszeiten erkannt (mindestens 3 Tage Daten nötig).'}</p><div class="row">${PUSH.sub?'<button class="btn sm ghost" data-a="pushTest">Test: Futter</button><button class="btn sm ghost" data-a="pushTestB">Test: Geburtstag</button><button class="btn sm ghost" data-a="pushTestV">Test: Impfung</button><button class="btn sm ghost" data-a="pushTestT">Test: Behandlung</button><button class="btn sm ghost" data-a="pushOff">Deaktivieren</button>':'<button class="btn sm primary" data-a="pushOn">Erinnerungen aktivieren</button>'}</div>`;
  return card('',b)}

/* ---------- Synchronisation ---------- */
const httpsNote=()=>SECURE?'':`<p class="muted fine">${ico('lock',12)} Du nutzt eine unverschlüsselte Verbindung (http). Der Offline-Start der App, Erinnerungen, App-Installation, Teilen und das Kopieren in die Zwischenablage funktionieren nur über https. Ein Eintrag, den du bei geöffneter App ohne Verbindung machst, wird trotzdem gespeichert und später gesendet.</p>`;
function vSync(){
  let o=card('Verbindung',`<div class="kvr"><span class="muted">Status</span><b>${OFFLINE?'Offline':'Online'}</b></div><div class="kvr"><span class="muted">Ausstehende Einträge</span><b>${PENDING}</b></div><div class="kvr"><span class="muted">Letzte Synchronisation</span><b>${LASTSYNC?fmt(LASTSYNC):'–'}</b></div><button class="btn primary block" style="margin-top:12px" data-a="syncnow" ${SYNCING?'disabled':''}>${ico('repeat',18)} Jetzt synchronisieren</button><p class="muted fine">Neue Einträge (Füttern, Präparat, Vorfall, Messwert, Behandlungs-Eintrag) werden ohne Verbindung auf dem Gerät gespeichert und automatisch gesendet, sobald der Server wieder erreichbar ist. Bearbeiten, Löschen und Stammdaten benötigen eine Verbindung.</p>${httpsNote()}`);
  if(OPS.length)o+=card('Wartet auf Synchronisation',`<div class="rows">${OPS.map(op=>`<div class="li"><span class="grow"><b>${esc(opLabel(op))}</b><small class="muted">${fmt(op.ts)}</small></span><button class="ib dng" data-a="opdel" data-id="${op.id}" aria-label="Verwerfen">${ico('trash',16)}</button></div>`).join('')}</div>`);
  return o}
