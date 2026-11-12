/* views/sheet.js – Eintragen-Sheet: Füttern (+Präparate), Präparat separat, Vorfall, Messwert, Behandlungs-Log und Bearbeiten */
const SH={};let shT=null;
const BR=[[1,'Harte, einzelne Klümpchen','Verstopfung'],[2,'Klumpige Wurst','leichte Verstopfung'],[3,'Wurst mit Rissen','normal'],[4,'Glatte, weiche Wurst','ideal'],[5,'Weiche Klümpchen','eher zu weich'],[6,'Breiig, ohne feste Form','leichter Durchfall'],[7,'Flüssig, ohne feste Stücke','Durchfall']];
const brc=n=>n==3||n==4?3:n==2||n==5?2:1;
const FK={skin:['Haut','eye'],wound:['Wunde','alert'],ear:['Ohren','eye'],other:['Sonstiges','edit']},FL={blood:'Blut',mucus:'Schleim',worms:'Würmer'};
const incTypes=()=>[['vomit','Spucken','drop'],['stool','Kot','stool'],['finding','Auffälligkeiten','eye']].filter(x=>ft(x[0]));
const sect=(t,b)=>`<div class="sect"><div class="lbl">${t}</div>${b}</div>`;

/* ---------- Öffnen ---------- */
const menuTiles=()=>{const t=[];
  if(ft('food')||ft('snack')||ft('drink'))t.push({k:'feed',i:'bowl',t:'Füttern',d:'Futter, Snack oder Getränk – auch mit Präparat'});
  if(ft('meds'))t.push({k:'meds',i:'pill',t:'Präparat',d:'Separat erfassen, ohne Fütterung'});
  if(incOn())t.push({k:'inc',i:'drop',t:'Vorfall',d:'Spucken, Kot oder Auffälligkeit'});
  if(ft('values'))t.push({k:'meas',i:'ruler',t:'Messwert',d:'Gewicht, Temperatur und eigene Werte'});
  if(ft('treatment')&&activeTR().length)t.push({k:'tlog',i:'pulse',t:'Behandlungs-Eintrag',d:'Log-Eintrag zur laufenden Behandlung'});
  if(ft('treatment')&&CATS.length)t.push({k:'tstart',i:'steth',t:'Behandlung starten',d:'Neue Behandlung oder Post-OP-Phase'});
  if(ft('petinfo')&&CATS.length)t.push({k:'pinfo',i:'paw',t:'Tierinfo',d:'Stammdaten, Impfstatus, Notfall-Info und Tierarzt (nur lesend)'});
  return t};
const feedInit=kind=>{const ks=['food','snack','drink'].filter(ft);kind=kind||ks[0]||'food';const ms=CAT[kind]||[];let m=ms[0],f=m&&m.foods[0];
  if(kind=='drink'){const x=ms.find(q=>q.foods.some(z=>z.name==DD));if(x){m=x;f=x.foods.find(z=>z.name==DD)}}
  return{t:'feed',kind,sel:selAll(),man:m?m.id:'',food:f?f.id:'',ts:nowIso(),note:'',dm:false,ms:{}}};
const medsInit=()=>({t:'meds',sel:selAll()&&Object.fromEntries(Object.keys(selAll()).map(k=>[k,1])),med:MEDS[0]?MEDS[0].id:'',dose:MEDS[0]?MEDS[0].dose:'',wf:false,ts:nowIso(),note:''});
const incInit=()=>{const ty=incTypes()[0];return{t:'inc',ty:ty?ty[0]:'vomit',cat:CATS[0]?CATS[0].name:'Unbekannt',vtype:'food',bristol:null,flags:{},fkind:'skin',loc:'',note:'',ts:nowIso(),files:[],pv:[]}};
const measInit=()=>({t:'meas',cat:CATS[0]?CATS[0].name:'',f:HF.fields[0]?HF.fields[0].id:'',val:'',ts:nowIso(),note:''});
const tlogInit=(tid,type)=>{const a=activeTR();return{t:'tlog',tid:tid||(a[0]&&a[0].id),type:type||'Allgemeinbefinden',comment:'',ts:nowIso()}};
A.addmenu=()=>{const tl=menuTiles();if(!tl.length){toast('Keine Eintragsart aktiv – unter Mehr → Funktionen einschalten');return}
  if(tl.length==1)return A['m_'+tl[0].k]();S.sh={t:'menu'}};
A.m_feed=()=>{S.sh=feedInit()};A.m_meds=()=>{S.sh=medsInit()};A.m_inc=()=>{S.sh=incInit()};A.m_meas=()=>{S.sh=measInit()};
A.m_pinfo=()=>{S.sh={t:'pinfo',cat:CATS[0].name,sec:'profile'}};
A.m_tstart=()=>{S.sh={t:'tstart',cat:CATS.length==1?CATS[0].name:'',title:'',start:nowIso(),int:'4',cint:'',notes:''}};
A.m_tlog=d=>{S.sh=tlogInit(d&&d.tid?+d.tid:null,d&&d.type)};
A.shclose=()=>{if(S.sh&&S.sh.pv)S.sh.pv.forEach(u=>URL.revokeObjectURL(u));S.sh=null};
function renderSheet(){const el=$('#sheet'),s=S.sh;
  if(!s){el.className='';el.innerHTML='';document.body.classList.remove('lock');shT=null;return}
  const old=el.querySelector('.body'),st=old&&shT==s.t?old.scrollTop:0,[title,body,foot]=SH[s.t](s);
  el.className='on';document.body.classList.add('lock');
  el.innerHTML=`<div class="backdrop" data-a="shclose"></div><div class="panel" role="dialog" aria-modal="true"><div class="head"><h3>${title}</h3>${iconBtn('shclose','x','Schließen')}</div><div class="body">${body}</div>${foot?`<div class="foot">${foot}</div>`:''}</div>`;
  const nb=el.querySelector('.body');if(nb)nb.scrollTop=st;shT=s.t}

/* ---------- Menü ---------- */
SH.menu=()=>['Was möchtest du tun?',`<div class="tiles">${menuTiles().map(t=>`<button class="tile" data-a="m_${t.k}" ${t.k=='tlog'?'':''}><span class="ti">${ico(t.i,26)}</span><b>${t.t}</b><small>${t.d}</small></button>`).join('')}</div>`,''];

/* ---------- Füttern ---------- */
const rateBlock=(s,t='Wie hat’s geschmeckt?')=>Object.keys(s.sel).length?sect(t,Object.keys(s.sel).map(n=>`<div class="rate"><b>${esc(n)}</b><div class="rts">${RL.map(r=>`<button type="button" class="rt r${rc(r.score)} ${s.sel[n]==r.score?'on':''}" data-a="frate" data-c="${esc(n)}" data-v="${r.score}">${r.emoji?`<span class="em">${esc(r.emoji)}</span>`:''}<span>${esc(r.label)}</span></button>`).join('')}</div></div>`).join('')):'';
const groupBtns=a=>{if(CATS.length<2)return'';const ca=CATS.filter(c=>c.sp!='dog'),dg=CATS.filter(c=>c.sp=='dog'),b=(k,l)=>`<button type="button" class="chip sm" data-a="${a}" data-v="${k}">${l}</button>`;
  return`<div class="row" style="margin-top:8px">${b('all','Alle ('+CATS.length+')')}${ca.length&&dg.length?(ca.length>1?b('cat','Alle Katzen'):'')+(dg.length>1?b('dog','Alle Hunde'):''):''}</div>`};
const medPicker=s=>{
  const chips=MEDS.map(m=>chip('fmed',m.id,m.id in s.ms,esc(m.name))).join('');
  const rows=Object.keys(s.ms).map(id=>{const m=MEDS.find(x=>x.id==id);return m?`<div class="medrow"><b>${esc(m.name)}</b><div class="inl"><input type="text" inputmode="decimal" data-b="sh.ms.${id}" value="${esc(s.ms[id])}" placeholder="Menge"><span class="unit">${esc(m.unit)}</span></div></div>`:''}).join('');
  return`<div class="row">${chips}${chip('nmedtog','',s.nmed,ico('plus',14)+' Neu','data-x')}</div>${s.nmed?newMedForm():''}${rows}${MEDS.length||s.nmed?'':'<p class="muted">Noch kein Präparat angelegt.</p>'}`};
const newMedForm=()=>`<div class="inl wrap">${inp('sh.nmn',{ph:'Name des Präparats'})}${inp('sh.nmd',{ph:'Menge, z. B. 1 oder 20'})}<input type="text" list="ulist" data-b="sh.nmu" value="${esc(S.sh.nmu||'')}" placeholder="Einheit, z. B. Tablette, mg">${unitList()}<button type="button" class="btn sm primary" data-a="newmed">OK</button></div>`;
SH.feed=s=>{
  const ks=['food','snack','drink'].filter(ft),KN={food:'Futter',snack:'Snacks',drink:'Getränke'},ms=CAT[s.kind]||[],m=ms.find(x=>x.id==s.man),fs=m?m.foods:[];
  const names=[...new Set([...CATS.map(c=>c.name),...Object.keys(s.sel)])];
  let b='';
  if(!s.edit&&ks.length>1)b+=seg(ks.map(k=>[k,KN[k],k=='food'?'bowl':k=='snack'?'cookie':'glass']),s.kind,'fkind');
  if(!CATS.length)return[s.edit?'Fütterung bearbeiten':'Füttern',empty('paw','Noch kein Tier','Lege zuerst ein Tier an.',`<button class="btn primary" data-a="newpet">Tier anlegen</button>`),''];
  b+=sect('Wer hat gefressen?',`<div class="chips">${names.map(n=>achip(n,n in s.sel,'fcat')).join('')}</div>${groupBtns('fgrp')}`);
  b+=sect(s.kind=='snack'?'Welcher Snack?':s.kind=='drink'?'Welches Getränk?':'Welches Futter?',
    `<select data-b="sh.man" data-ch="fman">${ms.map(x=>`<option value="${x.id}" ${x.id==s.man?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="new" ${s.man=='new'?'selected':''}>+ Neuen Hersteller anlegen …</option></select>`+
    (s.man=='new'||!ms.length?`<div class="inl">${inp('sh.nn',{ph:'Name des Herstellers'})}<button type="button" class="btn sm primary" data-a="fnewman">OK</button></div>`:'')+
    (m?`<div style="height:8px"></div><select data-b="sh.food" data-ch="ffood">${fs.map(x=>`<option value="${x.id}" ${x.id==s.food?'selected':''}>${esc(x.name)}</option>`).join('')}<option value="new" ${s.food=='new'?'selected':''}>+ Neue Sorte anlegen …</option></select>`:'')+
    (m&&(s.food=='new'||!fs.length)?`<div class="inl">${inp('sh.nfn',{ph:'Name der Sorte'})}<button type="button" class="btn sm primary" data-a="fnewfood">OK</button></div>`:''));
  b+=rateBlock(s);
  if(!s.edit&&ft('meds'))b+=sect('Präparat',sw('sh.dm','Präparat zusammen mit dieser Fütterung gegeben',true)+(s.dm?medPicker(s):'<p class="muted">Gabe ohne Fütterung erfasst du über Eintragen → Präparat.</p>'));
  b+=sect('Zeitpunkt & Notiz',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Notiz (optional), z. B. nur halbe Portion'})}`);
  const ok=Object.keys(s.sel).length&&s.food&&s.food!='new'&&s.man!='new';
  return[s.edit?'Fütterung bearbeiten':'Füttern',b,`<button class="btn primary block" data-a="fsave" ${ok?'':'disabled'}>${ico('check',18)} ${s.edit?'Änderungen speichern':'Fütterung speichern'}</button>`]};
A.fkind=d=>{S.sh=feedInit(d.v)};
A.fcat=d=>{const s=S.sh;d.v in s.sel?delete s.sel[d.v]:s.sel[d.v]=NR()};
A.fgrp=d=>{CATS.filter(c=>d.v=='all'||(d.v=='dog')==(c.sp=='dog')).forEach(c=>{S.sh.sel[c.name]=S.sh.sel[c.name]||NR()})};
A.frate=d=>{S.sh.sel[d.c]=+d.v};
A.fman=v=>{const s=S.sh,m=(CAT[s.kind]||[]).find(x=>x.id==v);s.food=m&&m.foods[0]?m.foods[0].id:''};
A.ffood=()=>{};
A.fnewman=T(async()=>{const s=S.sh,n=(s.nn||'').trim();if(!n)return;const r=await API('POST','/api/catalog/manufacturers',{name:n,kind:s.kind});return()=>{s.man=r.id;s.food='';s.nn=''}});
A.fnewfood=T(async()=>{const s=S.sh,n=(s.nfn||'').trim();if(!n||!s.man)return;const r=await API('POST','/api/foods',{manufacturer_id:+s.man,name:n});return()=>{s.food=r.id;s.nfn=''}});
A.fmed=d=>{const s=S.sh;if(d.v in s.ms)delete s.ms[d.v];else{const m=MEDS.find(x=>x.id==d.v);s.ms[d.v]=m?m.dose:''}};
A.nmedtog=()=>{S.sh.nmed=!S.sh.nmed};
A.newmed=T(async()=>{const s=S.sh,n=(s.nmn||'').trim();if(!n)return;const r=await API('POST','/api/meds',{name:n,dose:s.nmd||'',unit:s.nmu||''});return()=>{if(s.t=='feed')s.ms[r.id]=s.nmd||'';else{s.med=r.id;s.dose=s.nmd||''}s.nmed=false;s.nmn='';s.nmd='';s.nmu=''}});
A.fsave=T(async()=>{const s=S.sh,names=Object.keys(s.sel);if(!names.length||!s.food)return;const ts=s.ts||nowIso();
  const body={cat_ratings:s.sel,manufacturer_id:+s.man,food_id:+s.food,notes:s.note,timestamp:ts,kind:s.kind};
  if(s.edit)await API('PUT','/api/feedings/batch/'+encodeURIComponent(s.edit),body);else await API('POST','/api/feedings',body);
  if(!s.edit&&s.dm&&ft('meds'))for(const [id,dose] of Object.entries(s.ms))await API('POST','/api/med-logs',{cat_names:names,med_id:+id,dose:doseStr(MEDS.find(x=>x.id==id),dose),with_food:true,timestamp:ts,notes:''});
  const n=Object.keys(s.ms).length,all=Object.values(s.sel).every(r=>r==NR());S.sh=null;
  return()=>toast(s.edit?'Fütterung aktualisiert':(s.dm&&n?'Fütterung mit Präparat gespeichert':all?'Alle haben’s geliebt':'Fütterung gespeichert'))});

/* ---------- Präparat separat ---------- */
SH.meds=s=>{
  if(!CATS.length)return['Präparat',empty('paw','Noch kein Tier','',`<button class="btn primary" data-a="newpet">Tier anlegen</button>`),''];
  const b=sect('Wer bekommt es?',`<div class="chips">${CATS.map(c=>achip(c.name,c.name in s.sel,'mcat')).join('')}</div>${CATS.length>1?`<div class="row" style="margin-top:8px"><button type="button" class="chip sm" data-a="mall">Alle (${CATS.length})</button></div>`:''}`)+
   sect('Welches Präparat?',(MEDS.length?`<select data-b="sh.med" data-ch="medsel">${MEDS.map(x=>`<option value="${x.id}" ${x.id==s.med?'selected':''}>${esc(x.name)}</option>`).join('')}</select><div style="height:8px"></div>`:'<p class="muted">Noch kein Präparat angelegt.</p>')+
     `<div class="row">${chip('nmedtog','',s.nmed,ico('plus',14)+' Neues Präparat')}</div>${s.nmed?newMedForm():''}`+
     `<div style="height:8px"></div><div class="inl"><input type="text" inputmode="decimal" data-b="sh.dose" value="${esc(s.dose)}" placeholder="Menge"><span class="unit">${esc((MEDS.find(x=>x.id==s.med)||{}).unit||'')}</span></div>`+sw('sh.wf','Zusammen mit einer Fütterung gegeben'))+
   sect('Zeitpunkt & Anmerkung',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Anmerkung (optional), z. B. in Leckerli versteckt'})}`);
  return['Präparat geben',b,`<button class="btn primary block" data-a="msave" ${Object.keys(s.sel).length&&s.med?'':'disabled'}>${ico('check',18)} Präparat speichern</button>`]};
A.mcat=d=>{const s=S.sh;d.v in s.sel?delete s.sel[d.v]:s.sel[d.v]=1};
A.mall=()=>{CATS.forEach(c=>{S.sh.sel[c.name]=1})};
A.medsel=v=>{const m=MEDS.find(x=>x.id==v);if(m)S.sh.dose=m.dose};
A.msave=T(async()=>{const s=S.sh,names=Object.keys(s.sel),m=MEDS.find(x=>x.id==s.med);if(!names.length||!m)return;
  await API('POST','/api/med-logs',{cat_names:names,med_id:m.id,dose:doseStr(m,s.dose),with_food:!!s.wf,notes:s.note,timestamp:s.ts||nowIso()});S.sh=null;
  return()=>toast(m.name+' für '+names.join(', ')+' eingetragen')});

/* ---------- Vorfall ---------- */
const photoPick=(show,multi)=>show?`<div class="row nowrap photobtns"><label class="photo">${ico('camera',20)}<span>Foto aufnehmen</span><input type="file" id="xcam" accept="image/*" capture="environment"></label><label class="photo">${ico('image',20)}<span>Aus Galerie wählen</span><input type="file" id="ximg" accept="image/*" ${multi?'multiple':''}></label></div>`:'';
const photoBox=s=>`${s.pv.length?`<div class="thumbs">${s.pv.map((u,i)=>`<div class="th"><img src="${u}" alt="Vorschau" data-a="zoom" data-src="${u}"><button type="button" class="x" data-a="xrm" data-i="${i}" aria-label="Entfernen">${ico('x',12)}</button></div>`).join('')}</div>`:''}${photoPick(s.ty=='vomit'?!s.files.length:s.files.length<4,s.ty!='vomit')}`;
SH.inc=s=>{
  const ts=incTypes();let b='';
  if(!CATS.length)return['Vorfall',empty('paw','Noch kein Tier','',`<button class="btn primary" data-a="newpet">Tier anlegen</button>`),''];
  if(ts.length>1)b+=seg(ts,s.ty,'ity');
  b+=sect('Welches Tier?',`<div class="chips">${CATS.map(c=>achip(c.name,s.cat==c.name,'icat')).join('')}${chip('icat','Unbekannt',s.cat=='Unbekannt','Unbekannt')}</div>`);
  if(s.ty=='vomit')b+=sect('Was wurde erbrochen?',`<div class="grid2">${VT.filter(t=>!t.hidden).map(t=>`<button type="button" class="opt ${s.vtype==t.key?'on':''}" data-a="vtype" data-v="${t.key}"><b>${t.emoji?esc(t.emoji)+' ':''}${esc(t.label)}</b><small>${t.relevant?'futterrelevant':'nicht futterrelevant'}</small></button>`).join('')}</div>`);
  if(s.ty=='stool')b+=sect('Bristol-Stuhlform',`<div class="grid2">${BR.map(x=>`<button type="button" class="opt ${s.bristol==x[0]?'on':''}" data-a="xb" data-v="${x[0]}"><b>${x[0]} · ${x[1]}</b><small>${x[2]}</small></button>`).join('')}</div><div class="lbl" style="margin-top:12px">Auffälligkeiten (optional)</div><div class="chips">${Object.entries(FL).map(([k,l])=>chip('xflag',k,s.flags[k],l)).join('')}</div>`);
  if(s.ty=='finding')b+=sect('Was ist aufgefallen?',`<div class="grid2">${Object.entries(FK).map(([k,[l,i]])=>`<button type="button" class="opt ${s.fkind==k?'on':''}" data-a="xkind" data-v="${k}"><b>${l}</b></button>`).join('')}</div><div style="height:8px"></div>${inp('sh.loc',{ph:'Stelle (optional), z. B. linkes Ohr'})}`);
  b+=sect(s.ty=='vomit'?'Foto':'Fotos (bis zu 4)',photoBox(s));
  b+=sect('Zeitpunkt & Notiz',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Notiz (optional)'})}`);
  const ok=s.cat&&(s.ty!='stool'||s.bristol);
  return['Vorfall erfassen',b,`<button class="btn primary block" data-a="isave" ${ok?'':'disabled'}>${ico('check',18)} ${s.ty=='vomit'?'Spuck-Ereignis speichern':s.ty=='stool'?'Kot speichern':'Auffälligkeit speichern'}</button>`+(s.ty=='stool'?'<p class="muted fine">Die Bristol-Skala dient nur der Orientierung. Bei anhaltenden Auffälligkeiten oder Blut bitte tierärztlich abklären.</p>':'')]};
A.ity=d=>{const s=S.sh;s.ty=d.v;s.pv.forEach(u=>URL.revokeObjectURL(u));s.files=[];s.pv=[]};
A.icat=d=>{S.sh.cat=d.v};A.vtype=d=>{S.sh.vtype=d.v};A.xb=d=>{S.sh.bristol=+d.v};A.xflag=d=>{S.sh.flags[d.v]=!S.sh.flags[d.v]};A.xkind=d=>{S.sh.fkind=d.v};
A.xrm=d=>{const s=S.sh;URL.revokeObjectURL(s.pv[d.i]);s.files.splice(d.i,1);s.pv.splice(d.i,1)};
A.isave=T(async()=>{const s=S.sh,fd=new FormData();fd.append('cat_name',s.cat);fd.append('timestamp',s.ts||nowIso());fd.append('notes',s.note);
  if(s.ty=='vomit'){fd.append('vomit_type',s.vtype);if(s.files[0])fd.append('image',s.files[0]);const r=await API('POST','/api/vomits',undefined,fd);S.sh=null;return()=>{const v=V0.find(x=>x.id==r.id);if(v)S.sh={t:'res',v}}}
  fd.append('kind',s.ty=='stool'?'stool':s.fkind);if(s.ty=='stool'){fd.append('bristol',s.bristol);fd.append('details',Object.keys(s.flags).filter(k=>s.flags[k]).join(','))}else fd.append('location',s.loc);
  s.files.forEach(f=>fd.append('images',f));await API('POST','/api/findings',undefined,fd);const st=s.ty=='stool';S.sh=null;return()=>toast(st?'Kot dokumentiert':'Auffälligkeit dokumentiert')});
SH.res=s=>{const v=s.v,l=rel(v)?lk(v):[];
  return['Zuordnung',`<div class="card flat">${!rel(v)?'<p>Nicht futterrelevant – keine Mahlzeiten zugeordnet.</p>':l.length?`<p><b>Gefüttert in den 12 h davor:</b></p><ul class="plain">${l.map(b=>`<li>${hm(b.ts)} ${esc(b.man)} – ${esc(b.food)}</li>`).join('')}</ul>`:'<p>Keine Mahlzeit in den 12 h davor gefunden.</p>'}</div>`,`<button class="btn primary block" data-a="shclose">Fertig</button>`]};

/* ---------- Messwert ---------- */
SH.meas=s=>{const f=HF.fields.find(x=>x.id==s.f);
  if(!CATS.length)return['Messwert',empty('paw','Noch kein Tier','',`<button class="btn primary" data-a="newpet">Tier anlegen</button>`),''];
  return['Messwert',sect('Welches Tier?',`<div class="chips">${CATS.map(c=>achip(c.name,s.cat==c.name,'mecat')).join('')}</div>`)+
   sect('Was wurde gemessen?',sel('sh.f',HF.fields.map(x=>[x.id,x.name+(x.unit?' ('+x.unit+')':'')])))+
   sect('Wert',`<div class="inl"><input type="text" inputmode="decimal" data-b="sh.val" value="${esc(s.val)}" placeholder="Wert">${f&&f.unit?`<span class="unit">${esc(f.unit)}</span>`:''}</div><div style="height:8px"></div><input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Notiz (optional)'})}`),
   `<button class="btn primary block" data-a="measave" ${s.cat&&s.f?'':'disabled'}>${ico('check',18)} Wert speichern</button>`]};
A.mecat=d=>{S.sh.cat=d.v};
A.measave=T(async()=>{const s=S.sh,v=String(s.val).replace(',','.').trim(),c=catByName(s.cat);if(v===''||isNaN(+v)){toast('Bitte einen Wert eingeben');return}
  await API('POST','/api/health/values',{cat_id:c.id,field_id:+s.f,value:+v,ts:s.ts||nowIso(),note:s.note||''});S.sh=null;return()=>toast('Wert gespeichert')});

/* ---------- Behandlungs-Log ---------- */
SH.tlog=s=>{const a=activeTR(),lt=LOGT.find(x=>x[0]==s.type);
  if(!a.length)return['Behandlung',empty('pulse','Keine laufende Behandlung','Starte eine Behandlung in der Tier-Akte.',''),''];
  return['Behandlungs-Eintrag',sect('Behandlung',sel('sh.tid',a.map(t=>[t.id,t.title+' ('+t.cat_name+')'])))+
   sect('Art',`<div class="chips">${LOGT.map(([k,i])=>chip('tltype',k,s.type==k,ico(i,14)+' '+k)).join('')}</div>`)+
   sect('Beschreibung & Zeit',`${inp('sh.comment',{ph:lt?lt[2]:''})}<div style="height:8px"></div><input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}">`),
   `<button class="btn primary block" data-a="tlsave">${ico('check',18)} Eintrag speichern</button>`]};
A.tltype=d=>{S.sh.type=d.v};
A.tlsave=T(async()=>{const s=S.sh;await API('POST','/api/health/treatments/'+s.tid+'/logs',{log_type:s.type,value_comment:s.comment,timestamp:s.ts||null});S.sh=null;return()=>toast('Eintrag gespeichert')});

/* ---------- Bearbeiten (Verlauf) ---------- */
SH.emed=s=>['Präparat bearbeiten',`<p class="muted"><b>${esc(s.med)}</b> – ${esc(s.cats.join(', '))}</p>`+sect('Dosis',inp('sh.dose',{ph:'z. B. 1 Tablette'})+sw('sh.wf','Zusammen mit der Fütterung gegeben'))+sect('Zeitpunkt & Anmerkung',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Anmerkung (optional)'})}`),`<button class="btn primary block" data-a="emsave">Änderungen speichern</button>`];
A.emsave=T(async()=>{const s=S.sh;await API('PUT','/api/med-logs/batch/'+encodeURIComponent(s.id),{dose:s.dose,with_food:!!s.wf,timestamp:s.ts,notes:s.note});S.sh=null;return()=>toast('Präparat aktualisiert')});
SH.evomit=s=>{const names=[...new Set([...CATS.map(c=>c.name),'Unbekannt',s.cat])];
  return['Spuck-Ereignis bearbeiten',sect('Tier',sel('sh.cat',names.map(n=>[n,n])))+sect('Art',`<div class="grid2">${VT.filter(t=>!t.hidden||t.key==s.vtype).map(t=>`<button type="button" class="opt ${s.vtype==t.key?'on':''}" data-a="vtype" data-v="${t.key}"><b>${t.emoji?esc(t.emoji)+' ':''}${esc(t.label)}</b><small>${t.relevant?'futterrelevant':'nicht futterrelevant'}</small></button>`).join('')}</div>`)+
   sect('Zeitpunkt & Notiz',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Notiz (optional)'})}`)+
   sect('Foto',(s.img&&!s.rm?`<img class="thumb" src="${esc(s.img)}" alt="" data-a="zoom" data-src="${esc(s.img)}">`:'')+(s.files.length?`<p class="muted">Neues Foto: ${esc(s.files[0].name)}</p>`:'')+photoPick(true,false)+(s.img&&!s.rm&&!s.files.length?'<button type="button" class="btn sm ghost" data-a="vdrm" style="margin-top:8px">Foto entfernen</button>':'')),
   `<button class="btn primary block" data-a="evsave">Änderungen speichern</button>`]};
A.vdrm=()=>{S.sh.rm=true};
A.evsave=T(async()=>{const s=S.sh,fd=new FormData();fd.append('cat_name',s.cat);fd.append('vomit_type',s.vtype);fd.append('timestamp',s.ts);fd.append('notes',s.note);if(s.rm)fd.append('remove_image','1');if(s.files[0])fd.append('image',s.files[0]);
  await API('PUT','/api/vomits/'+s.id,undefined,fd);S.sh=null;return()=>toast('Spuck-Ereignis aktualisiert')});
SH.efind=s=>{const st=s.kind=='stool';
  return[st?'Kot bearbeiten':'Auffälligkeit bearbeiten',`<p class="muted"><b>${esc(s.cat)}</b></p>`+(st?sect('Bristol',`<div class="chips">${BR.map(x=>chip('xb',x[0],s.bristol==x[0],x[0],`title="${esc(x[1])}"`)).join('')}</div><div class="chips" style="margin-top:8px">${Object.entries(FL).map(([k,l])=>chip('xflag',k,s.flags[k],l)).join('')}</div>`):sect('Stelle',inp('sh.loc')))+
   sect('Zeitpunkt & Notiz',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}"><div style="height:8px"></div>${inp('sh.note',{ph:'Notiz (optional)'})}<p class="muted fine">Fotos bleiben unverändert.</p>`),`<button class="btn primary block" data-a="efsave">Änderungen speichern</button>`]};
A.efsave=T(async()=>{const s=S.sh,b={timestamp:s.ts,notes:s.note};if(s.kind=='stool'){b.bristol=s.bristol;b.details=Object.keys(s.flags).filter(k=>s.flags[k]).join(',')}else b.location=s.loc;
  await API('PUT','/api/findings/'+s.id,b);S.sh=null;return()=>toast('Eintrag aktualisiert')});
/* Öffnen aus dem Verlauf */
A.edit=d=>{
  if(d.k=='f'){const b=B0.find(x=>String(x.id)==String(d.id));if(!b)return;const ms=CAT[b.kind]||[];S.sh={t:'feed',edit:b.id,kind:b.kind,sel:{...b.cats},man:b.mid||(ms[0]&&ms[0].id)||'',food:b.fid||'',ts:toLocal(b.ts),note:b.note,dm:false,ms:{}}}
  else if(d.k=='m'){const m=MG0.find(x=>String(x.id)==String(d.id));if(m)S.sh={t:'emed',id:m.id,med:m.med,cats:m.cats,dose:m.dose,wf:m.wf,ts:toLocal(m.ts),note:m.note}}
  else if(d.k=='v'){const v=V0.find(x=>String(x.id)==String(d.id));if(v)S.sh={t:'evomit',id:v.id,cat:v.cat,vtype:v.type,ts:toLocal(v.ts),note:v.note,img:v.img,rm:false,files:[]}}
  else{const f=FD0.find(x=>String(x.id)==String(d.id));if(f)S.sh={t:'efind',id:f.id,kind:f.kind,cat:f.cat,bristol:f.bristol,flags:Object.fromEntries(f.flags.map(k=>[k,true])),loc:f.loc,note:f.note,ts:toLocal(f.ts)}}};
A.del=d=>{const url={f:'/api/feedings/batch/',m:'/api/med-logs/batch/',v:'/api/vomits/',s:'/api/findings/',b:'/api/findings/'}[d.k];
  ask('Eintrag löschen?','Dieser Eintrag wird endgültig gelöscht.',T(async()=>{await API('DELETE',url+encodeURIComponent(d.id));return()=>toast('Gelöscht')}));return false};
/* Schnell-Aktionen (Heute) */
const lastFood=()=>[...B0].filter(x=>x.kind=='food').sort((a,c)=>c.ts-a.ts)[0];
const repPost=T(async(b,sel,ts)=>{await API('POST','/api/feedings',{cat_ratings:sel,manufacturer_id:b.mid,food_id:b.fid,notes:'',timestamp:ts||nowIso(),kind:'food'});return()=>toast('Wie zuletzt gefüttert: '+b.food)});
A.repeat=()=>{const b=lastFood();if(!b)return;if(PREFS.repeatSkip){repPost(b,{...b.cats});return}S.sh={t:'rep',b,sel:{...b.cats},ts:nowIso(),skip:false}};
SH.rep=s=>['Wie zuletzt füttern',`<p class="muted"><b>${esc(s.b.food)}</b> · ${esc(s.b.man)}</p>`+rateBlock({sel:s.sel},'Wie war die Akzeptanz?')+
  sect('Zeitpunkt',`<input type="datetime-local" data-b="sh.ts" value="${esc(s.ts)}">`)+
  sw('sh.skip','Künftig nicht mehr fragen – Bewertung 1:1 übernehmen')+'<p class="muted fine">Das lässt sich jederzeit unter Mehr → Darstellung → Eingabe wieder einschalten.</p>',
  `<button class="btn primary block" data-a="repsave">${ico('check',18)} Fütterung speichern</button>`];
A.repsave=T(async()=>{const s=S.sh;await API('POST','/api/feedings',{cat_ratings:s.sel,manufacturer_id:s.b.mid,food_id:s.b.fid,notes:'',timestamp:s.ts||nowIso(),kind:'food'});if(s.skip){PREFS.repeatSkip=1;savePrefs()}S.sh=null;return()=>toast('Wie zuletzt gefüttert: '+s.b.food)});
A.stdDrink=T(async()=>{const n=Object.keys(selAll());if(!n.length){toast('Lege zuerst ein Tier an');return}const m=CAT.drink.find(x=>x.foods.some(f=>f.name==DD));if(!m)return;const f=m.foods.find(z=>z.name==DD);
  await API('POST','/api/feedings',{cat_ratings:Object.fromEntries(n.map(x=>[x,NR()])),manufacturer_id:m.id,food_id:f.id,timestamp:nowIso(),kind:'drink'});return()=>toast(DD+' eingetragen')});

/* ---------- Tierinfo (nur lesend) und Behandlung starten ---------- */
const petPick=(s,a)=>CATS.length>1?sect('Welches Tier?',`<div class="chips">${CATS.map(c=>achip(c.name,s.cat==c.name,a)).join('')}</div>`):'';
const kvr=(l,v)=>v?`<div class="kvr"><span class="muted">${l}</span><b>${v}</b></div>`:'';
SH.pinfo=s=>{
  const c=catByName(s.cat)||CATS[0],p=PRF[c.id]||{},bd=p.birthday||HF.birthdays[c.id]||'';
  const secs=[['profile','Stammdaten','paw'],ft('vaccination')?['vac','Impfstatus','syringe']:null,ft('medical')?['emerg','Notfall-Info','alert']:null,ft('medical')?['vet','Tierarzt','steth']:null].filter(Boolean);
  const sec=secs.some(x=>x[0]==s.sec)?s.sec:'profile';let b=petPick(s,'pcat')+seg(secs,sec,'psec'),body='';
  if(sec=='profile')body=kvr('Tierart',c.sp=='dog'?'Hund':'Katze')+(c.sp!='dog'?kvr('Lebensart',esc(LIFE[p.lifestyle]||'')):'')+kvr('Geburtstag',bd?dFmt(bd)+' · '+ageText(bd):'')+kvr('Rasse',esc(p.breed||''))+kvr('Geschlecht',esc(GENL[p.gender_fixed]||''))+kvr('Farbe',esc(p.color||''))+kvr('Kennzeichen',esc(p.markings||''))+kvr('Chipnummer',esc(p.chip_number||''))+kvr('Implantiert',[p.chip_date?dFmt(p.chip_date):'',esc(p.chip_location||'')].filter(Boolean).join(' · '));
  if(sec=='vac'){const vs=VAC.filter(v=>v.cat_id==c.id);body=vs.length?vs.map(v=>{const st=vacState(v);return`<div class="kvr"><span><b>${esc(v.vaccine_name)}</b><small class="muted">${vplanned(v)?'geplant für '+dFmt(v.planned_date):'gegeben '+dFmt(v.date_given)+(v.no_expiry?'':v.valid_until?' · gültig bis '+dFmt(v.valid_until):'')}</small></span>${st?pill(st.t,st.c):''}</div>`}).join(''):'<p class="muted">Noch keine Impfungen eingetragen.</p>'}
  if(sec=='emerg'){const f=(l,k)=>p[k]?`<div class="kv"><span class="lbl">${l}</span><div class="pre">${esc(p[k])}</div></div>`:'';body=(f('Allergien / Unverträglichkeiten','allergies')+f('Chronische Diagnosen / Vorerkrankungen','conditions')+f('Dauerhafte Medikation & Hinweise','permanent_meds'))||'<p class="muted">Keine Angaben.</p>';body=`<div class="card emerg flat">${body}</div>`}
  if(sec=='vet'){const v=VETS.find(x=>x.id==p.vet_clinic_id),tel=v&&v.phone?v.phone.replace(/[^\d+]/g,''):'',map=v&&v.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(v.address.replace(/\s*\n\s*/g,', ')):'';
    body=v||p.attending_doctor?(v?`<b>${esc(v.name)}</b>`:'')+(p.attending_doctor?`<div class="muted">Behandelnder Arzt: ${esc(p.attending_doctor)}</div>`:'')+(v&&v.address?`<div class="muted pre">${esc(v.address)}</div>`:'')+(v&&v.phone?`<div class="muted">${esc(v.phone)}</div>`:'')+(v&&v.email?`<div class="muted">${esc(v.email)}</div>`:'')+`<div class="row" style="margin-top:10px">${tel?`<a class="btn sm primary" href="tel:${esc(tel)}">${ico('phone',16)} Anrufen</a>`:''}${v&&v.email?`<a class="btn sm ghost" href="mailto:${esc(v.email)}">${ico('mail',16)} E-Mail senden</a>`:''}${map?`<a class="btn sm ghost" href="${map}" target="_blank" rel="noopener">${ico('pin',16)} Navigation starten</a>`:''}</div>`:'<p class="muted">Noch keine Praxis zugeordnet.</p>'}
  return['Tierinfo',b+`<div>${body}</div>`,`<button class="btn ghost block" data-a="pinfoopen">Tier-Akte öffnen</button>`]};
A.pcat=d=>{S.sh.cat=d.v};A.psec=d=>{S.sh.sec=d.v};
A.pinfoopen=()=>{const c=catByName(S.sh.cat);S.sh=null;if(c){S.tab='pets';S.pet=c.id;S.pt='profile'}};
SH.tstart=s=>['Behandlung starten',petPick(s,'tcat')+sect('Behandlung',field('Bezeichnung',inp('sh.title',{ph:'z. B. Zahnsanierung & Extraktion'}))+field('Startzeitpunkt',`<div class="inl"><input type="datetime-local" data-b="sh.start" value="${esc(s.start)}"><button type="button" class="btn sm ghost" data-a="tsnow">Jetzt</button></div>`)+field('Erinnerungs-Intervall',sel('sh.int',IVL,{r:true}))+(s.int=='custom'?field('Intervall in Stunden (1–168)',`<input type="number" min="1" max="168" inputmode="numeric" data-b="sh.cint" value="${esc(s.cint)}">`):'')+field('Notizen / Anweisungen',ta('sh.notes','z. B. Kein Springen erlauben, Schmerzmittel alle 8 Std.',3))),
  `<button class="btn primary block" data-a="tssave" ${s.cat&&(s.title||'').trim()?'':'disabled'}>${ico('check',18)} Behandlung starten</button>`];
A.tcat=d=>{S.sh.cat=d.v};A.tsnow=()=>{S.sh.start=nowIso()};
A.tssave=T(async()=>{const s=S.sh,c=catByName(s.cat),title=(s.title||'').trim();if(!c||!title)return;const iv=s.int=='custom'?parseInt(s.cint):(s.int?+s.int:null);if(s.int=='custom'&&!(iv>=1&&iv<=168)){toast('Intervall: 1 bis 168 Stunden');return}
  await API('POST','/api/health/treatments',{cat_id:c.id,title,start_timestamp:s.start||null,interval_hours:iv||null,notes:s.notes});S.sh=null;return()=>{S.tab='today';toast('Behandlung gestartet')}});
SH.vdone=s=>['Impfung verabreicht',`<p class="muted"><b>${esc(s.name)}</b> – ${esc(s.cat)}</p>`+sect('Verabreicht am',`<input type="date" data-b="sh.g" value="${esc(s.g)}" max="${nowIso().slice(0,10)}">`)+sect('Wie lange hält die Impfung?',durPick('sh',s.g)),`<button class="btn primary block" data-a="vdsave">${ico('check',18)} Als verabreicht eintragen</button>`];
A.vdsave=T(async()=>{const s=S.sh;await API('PUT','/api/health/vaccinations/'+s.id,{date_given:s.g||nowIso().slice(0,10),valid_until:durUntil(s.g,s.dur,s.u),no_expiry:s.dur=='none'});S.sh=null;return()=>toast('Impfung eingetragen')});
