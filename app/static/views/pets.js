/* views/pets.js – Tiere: Liste und Tier-Akte (Profil, Impfpass, Werte, Behandlungen) */
const GENL={female:'Weiblich',female_spayed:'Weiblich, kastriert',male:'Männlich',male_neutered:'Männlich, kastriert'};
const ta=(p,ph,rows=2)=>`<textarea rows="${rows}" data-b="${p}" placeholder="${esc(ph||'')}">${esc(getPath(p)||'')}</textarea>`;
const vacState=v=>{const today=new Date(nowIso().slice(0,10)+'T00:00');
  if(v.planned_date&&!v.date_given){const d=Math.round((new Date(v.planned_date+'T00:00')-today)/864e5);return{d,c:d<0?'bad':'ok',t:d<0?'überfällig':'geplant'}}
  if(v.no_expiry)return{d:null,c:'good',t:'kein Ablauf'};
  if(!v.valid_until)return null;const d=Math.round((new Date(v.valid_until+'T00:00')-today)/864e5);return d<0?{d,c:'bad',t:'abgelaufen'}:d<=30?{d,c:'ok',t:'läuft bald ab'}:{d,c:'good',t:'gültig'}};
A.openpet=d=>{S.tab='pets';S.pet=+d.id;S.pt='profile';S.np=null};
A.newpet=()=>{S.sh=null;S.tab='pets';S.pet=null;S.np={name:'',bd:''}};
A.petback=()=>{S.pet=null;S.np=null};
A.ptab=d=>{S.pt=d.v};
const petTabs=()=>[['profile','Profil','paw'],ft('vaccination')?['vac','Impfpass','syringe']:null,ft('values')?['val','Werte','ruler']:null,ft('treatment')?['treat','Behandlungen','pulse']:null].filter(Boolean);

function vPets(){
  if(S.np)return vNewPet();
  if(S.pet==null||!CATS.some(c=>c.id==S.pet))return vPetList();
  return vPetDetail(CATS.find(c=>c.id==S.pet))}
function vPetList(){
  const td=new Date(nowIso().slice(0,10)+'T00:00');
  const cards=CATS.map(c=>{const p=PRF[c.id]||{},bd=HF.birthdays[c.id]||p.birthday,b=[];
    if(ft('treatment')&&activeTR().some(t=>t.cat_id==c.id))b.push(pill('Behandlung läuft','bad'));
    if(ft('vaccination')&&VAC.some(v=>v.cat_id==c.id&&v.valid_until&&Math.round((new Date(v.valid_until+'T00:00')-td)/864e5)<=30))b.push(pill('Impfung fällig','ok'));
    return`<button class="card petcard" data-a="openpet" data-id="${c.id}">${pav(c,'lg')}<span class="grow"><b class="big">${esc(c.name)}</b><span class="muted">${c.sp=='dog'?'Hund':'Katze'}${c.sp!='dog'&&LIFE[c.life]?' · '+LIFE[c.life]:''}${p.breed?' · '+esc(p.breed):''}${bd?' · '+ageText(bd):''}</span><span class="chips">${b.join('')}</span></span>${ico('chev',18)}</button>`}).join('');
  return`<div class="row between pagehead"><h2 class="ph">Meine Tiere</h2><button class="btn sm primary" data-a="newpet">${ico('plus',16)} Neues Tier</button></div>${cards||empty('paw','Noch kein Tier','Lege dein erstes Tier an.',`<button class="btn primary" data-a="newpet">${ico('plus',18)} Tier anlegen</button>`)}`}
function vNewPet(){const td=nowIso().slice(0,10);
  return`<button class="back" data-a="petback">${ico('back',18)} Zurück</button>`+card('Neues Tier',`${field('Name',inp('np.name',{ph:'Name des Tieres'}))}${field('Geburtstag (optional)',`<input type="date" data-b="np.bd" value="${esc(S.np.bd)}" max="${td}">`)}
  <div class="grid2" style="margin-top:14px"><button class="btn primary" data-a="addpet" data-v="cat">${ico('paw',18)} Katze anlegen</button><button class="btn ghost" data-a="addpet" data-v="dog">${ico('paw',18)} Hund anlegen</button></div>
  <p class="muted fine">Alle weiteren Angaben (Rasse, Chip, Medizin …) ergänzt du danach in der Tier-Akte.</p>`)}
A.addpet=T(async d=>{const n=(S.np.name||'').trim();if(!n){toast('Bitte einen Namen eingeben');return}const r=await API('POST','/api/animals',{name:n,species:d.v,birthday:S.np.bd||null});S.np=null;
  return()=>{S.pet=r.id;S.pt='profile';toast('Willkommen, '+n+'!')}});

function vPetDetail(c){
  const tabs=petTabs();if(!tabs.some(x=>x[0]==S.pt))S.pt='profile';
  const body=S.pt=='vac'?pVac(c):S.pt=='val'?pVal(c):S.pt=='treat'?pTreat(c):pProfile(c);
  return`<button class="back" data-a="petback">${ico('back',18)} Alle Tiere</button><div class="pethead">${pav(c,'lg')}<div><h2 class="ph">${esc(c.name)}</h2><span class="muted">${c.sp=='dog'?'Hund':'Katze'}${c.sp!='dog'&&LIFE[c.life]?' · '+LIFE[c.life]:''}${(HF.birthdays[c.id]||(PRF[c.id]||{}).birthday)?' · '+ageText(HF.birthdays[c.id]||PRF[c.id].birthday):''}</span></div></div>${tabs.length>1?seg(tabs,S.pt,'ptab'):''}${body}`}

/* ----- Profil ----- */
const pf=(c,k,l,t='text')=>{const p=PRF[c.id]||{};return field(l,`<input type="${t}" data-e="pf" data-i="${c.id}" data-f="${k}" value="${esc(p[k]||'')}" ${t=='date'?`max="${nowIso().slice(0,10)}"`:''}>`)};
function pProfile(c){
  const p=PRF[c.id]||{},td=nowIso().slice(0,10),bd=p.birthday||HF.birthdays[c.id]||'';
  let o=card('Stammdaten',`<div class="grid2">${field('Name',`<input type="text" data-e="pname" data-i="${c.id}" value="${esc(c.name)}">`)}${field('Tierart',`<select data-e="pf" data-i="${c.id}" data-f="species"><option value="cat" ${c.sp!='dog'?'selected':''}>Katze</option><option value="dog" ${c.sp=='dog'?'selected':''}>Hund</option></select>`)}
   ${field('Position (1–'+CATS.length+')',`<input type="number" min="1" max="${CATS.length}" inputmode="numeric" data-e="psort" data-i="${c.id}" value="${CATS.indexOf(c)+1}">`)}${field('Avatar-Farbe',`<input type="color" class="cpick" data-e="pcolor" data-i="${c.id}" value="${ccol(c)}">`)}${pf(c,'birthday','Geburtstag','date')}${bd?field('Alter',`<div class="fstatic"><b>${ageText(bd)}</b></div>`):''}</div>
   <div class="lbl" style="margin-top:6px">Foto (ersetzt den Avatar in der Tierliste und der Tier-Akte)</div><div class="row nowrap photobtns">${pav(c,'lg')}<label class="photo">${ico('camera',20)}<span>Foto aufnehmen</span><input type="file" id="phcam" accept="image/*" capture="environment"></label><label class="photo">${ico('image',20)}<span>Aus Galerie wählen</span><input type="file" id="phpick" accept="image/*"></label></div>${c.photo?`<button class="btn sm ghost" data-a="phdel" style="margin-top:8px">Foto entfernen</button>`:''}`);
  o+=card('Identifikation',`<div class="grid2">${pf(c,'breed','Rasse')}${pf(c,'color','Farbe')}${c.sp!='dog'?field('Lebensart',`<select data-e="pf" data-i="${c.id}" data-f="lifestyle"><option value="">– nicht angegeben –</option>${Object.entries(LIFE).map(([k,l])=>`<option value="${k}" ${p.lifestyle==k?'selected':''}>${l}</option>`).join('')}</select>`):''}${field('Geschlecht',`<select data-e="pf" data-i="${c.id}" data-f="gender_fixed"><option value="">– nicht angegeben –</option>${Object.entries(GENL).map(([k,l])=>`<option value="${k}" ${p.gender_fixed==k?'selected':''}>${l}</option>`).join('')}</select>`)}${pf(c,'markings','Besondere Kennzeichen')}${pf(c,'chip_number','Chipnummer')}${pf(c,'chip_date','Implantationstag','date')}${pf(c,'chip_location','Implantationsstelle')}</div>`);
  if(ft('medical')){
    const e=S.em,fl=(k,l,ph)=>e?field(l,ta('em.'+k,ph)):`<div class="kv"><span class="lbl">${l}</span><div class="pre">${p[k]?esc(p[k]):'<span class="muted">Keine Angaben</span>'}</div></div>`;
    o+=`<section class="card emerg"><div class="row between"><h2>Notfall-Info</h2>${e?'':`<button class="chip sm" data-a="emedit">${ico('lock',14)} Bearbeiten</button>`}</div>${fl('allergies','Allergien / Unverträglichkeiten','z. B. Huhn, Penicillin')}${fl('conditions','Chronische Diagnosen / Vorerkrankungen','z. B. chronische Niereninsuffizienz')}${fl('permanent_meds','Dauerhafte Medikation & Hinweise','z. B. Nierendiät, 1 Tablette täglich')}
    ${e?`<div class="row nowrap" style="margin-top:12px"><button class="btn ghost" data-a="emcancel">Abbrechen</button><button class="btn primary" data-a="emsave">Speichern</button></div>`:'<p class="muted fine">Gespeichert und gesperrt – zum Ändern „Bearbeiten“ wählen.</p>'}</section>`;
    o+=vetCard(c,p)}
  o+=`<button class="btn ghost block dngtxt" data-a="delpet" data-id="${c.id}">${ico('trash',16)} ${esc(c.name)} entfernen</button>`;
  return o}
function vetCard(c,p){const v=VETS.find(x=>x.id==p.vet_clinic_id),tel=v&&v.phone?v.phone.replace(/[^\d+]/g,''):'',map=v&&v.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(v.address.replace(/\s*\n\s*/g,', ')):'';
  return card('Tierarzt',`<div class="grid2">${field('Praxis',`<select data-e="pf" data-i="${c.id}" data-f="vet_clinic_id"><option value="">– keine –</option>${VETS.map(x=>`<option value="${x.id}" ${p.vet_clinic_id==x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`)}${pf(c,'attending_doctor','Behandelnder Arzt')}</div>
  ${v?`<div class="vet"><b>${esc(v.name)}</b>${v.address?`<div class="muted pre">${esc(v.address)}</div>`:''}${v.phone?`<div class="muted">${esc(v.phone)}</div>`:''}${v.email?`<div class="muted">${esc(v.email)}</div>`:''}<div class="row" style="margin-top:10px">${tel?`<a class="btn sm primary" href="tel:${esc(tel)}">${ico('phone',16)} Anrufen</a>`:''}${v.email?`<a class="btn sm ghost" href="mailto:${esc(v.email)}">${ico('mail',16)} E-Mail senden</a>`:''}${map?`<a class="btn sm ghost" href="${map}" target="_blank" rel="noopener">${ico('pin',16)} Navigation starten</a>`:''}</div></div>`:''}
  ${VETS.length?'':'<p class="muted fine">Noch keine Praxis angelegt – das geht unter Mehr → Tierarztpraxen.</p>'}`)}
const E={};
E.pf=T(async t=>{await API('PUT','/api/animals/'+t.dataset.i+'/profile',{[t.dataset.f]:t.value})});
E.pname=T(async t=>{const c=CATS.find(x=>x.id==t.dataset.i),v=t.value.trim();if(!v||v==c.name)return;await API('PUT','/api/cats/'+c.id,{name:v});return()=>toast('Umbenannt')});
E.psort=T(async t=>{const n=Math.max(1,Math.min(CATS.length,parseInt(t.value)||1));await API('PUT','/api/animals/'+t.dataset.i+'/sort',{position:n})});
E.pcolor=t=>{PREFS.ui.cc=PREFS.ui.cc||{};PREFS.ui.cc[t.dataset.i]=t.value;savePrefs()};
A.emedit=()=>{const p=PRF[S.pet]||{};S.em={allergies:p.allergies||'',conditions:p.conditions||'',permanent_meds:p.permanent_meds||''}};
A.emcancel=()=>{S.em=null};
A.emsave=T(async()=>{const v=S.em;if(!v)return;await API('PUT','/api/animals/'+S.pet+'/profile',v);S.em=null;return()=>toast('Notfall-Info gespeichert')});
A.delpet=d=>{const c=CATS.find(x=>x.id==d.id);ask('Tier entfernen?',`„${c?c.name:''}“ wird aus der Auswahl entfernt. Die Historie bleibt erhalten.`,T(async()=>{await API('DELETE','/api/cats/'+d.id);S.pet=null;return()=>toast('Entfernt')}),'Ja, entfernen');return false};

/* ----- Impfpass ----- */
const vplanned=v=>!!(v.planned_date&&!v.date_given);
function pVac(c){const all=VAC.filter(v=>v.cat_id==c.id),vs=all.filter(v=>!vplanned(v)),pl=all.filter(vplanned).sort((a,b)=>a.planned_date<b.planned_date?-1:1),td=nowIso().slice(0,10),V=S.vac;
  if(!V.g)V.g=td;if(!V.t||(V.t!='__new'&&!VTYPES.some(x=>x.name==V.t)))V.t=VTYPES[0]?VTYPES[0].name:'__new';
  let o=card('Impfpass',vs.length?`<div class="scrollx"><table class="tbl"><thead><tr><th>Impfung</th><th>Gegeben</th><th>Gültig bis</th><th></th></tr></thead><tbody>${vs.map(v=>{const st=vacState(v);return`<tr><td><b>${esc(v.vaccine_name)}</b>${MULTI&&v.created_by_name?`<div class="muted">${esc(v.created_by_name)}</div>`:''}</td><td>${dFmt(v.date_given)}</td><td>${v.no_expiry?'unbegrenzt':dFmt(v.valid_until)}${st?`<div>${pill(st.t,st.c)}</div>`:''}</td><td><button class="ib dng" data-a="vdel" data-id="${v.id}" aria-label="Löschen">${ico('trash',16)}</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Noch keine Impfungen eingetragen.</p>');
  if(pl.length)o+=card('Geplante Impfungen',`<div class="rows">${pl.map(v=>{const st=vacState(v);return`<div class="li col"><div class="row between nowrap"><span><b>${esc(v.vaccine_name)}</b><small class="muted">geplant für ${dFmt(v.planned_date)}</small></span>${pill(st.t,st.c)}</div><div class="row"><button class="chip sm" data-a="vdone" data-id="${v.id}">${ico('check',14)} Verabreicht</button><button class="chip sm dngtxt" data-a="vdel" data-id="${v.id}">Löschen</button></div></div>`}).join('')}</div><p class="muted fine">Du wirst 14 Tage und 3 Tage vorher sowie am Tag selbst erinnert.</p>`);
  o+=card('Impfung hinzufügen',`${field('Impfart',sel('vac.t',[...VTYPES.map(x=>[x.name,x.name]),['__new','+ Neue Impfart …']],{r:true}))}${V.t=='__new'?field('Name der neuen Impfart',inp('vac.nt',{ph:'z. B. Leukose'})):''}
  ${sw('vac.plan','Zukünftige Impfung planen (mit Erinnerung)',true)}
  ${V.plan?field('Geplant für',`<input type="date" data-b="vac.pd" value="${esc(V.pd||'')}" min="${td}">`):`<div class="grid2">${field('Gegeben',`<input type="date" data-b="vac.g" value="${V.g}">`)}${V.noexp?'':field('Gültig bis',`<input type="date" data-b="vac.u" value="${V.u}">`)}</div>${sw('vac.noexp','Kein Ablaufdatum (Impfung läuft nie ab)',true)}`}
  <button class="btn primary block" data-a="vadd" data-c="${c.id}">${ico('check',18)} ${V.plan?'Impfung planen':'Impfung eintragen'}</button><p class="muted fine">Impfarten verwaltest du unter Mehr → Katalog → Impfungen. Läuft eine Impfung in den nächsten 30 Tagen ab, bekommst du eine Push-Erinnerung (7 Tage vorher und am Ablauftag nochmal).</p>`);
  return o}
A.vadd=T(async d=>{const V=S.vac;let n=V.t=='__new'?(V.nt||'').trim():V.t;if(!n){toast('Bitte die Impfart wählen oder eingeben');return}
  if(V.plan&&!V.pd){toast('Bitte ein Datum für die Planung wählen');return}
  if(V.t=='__new')await API('POST','/api/health/vaccine-types',{name:n});
  await API('POST','/api/health/vaccinations',{cat_id:+d.c,vaccine_name:n,date_given:V.plan?null:(V.g||null),valid_until:V.plan||V.noexp?null:(V.u||null),no_expiry:!!V.noexp&&!V.plan,planned_date:V.plan?V.pd:null});
  S.vac={t:'',nt:'',g:'',u:'',noexp:false,plan:false,pd:''};return()=>toast(V.plan?'Impfung geplant':'Impfung eingetragen')});
A.vdone=d=>{const v=VAC.find(x=>x.id==d.id);if(!v)return;const c=CATS.find(x=>x.id==v.cat_id)||{};S.sh={t:'vdone',id:v.id,name:v.vaccine_name,cat:c.name||'',g:nowIso().slice(0,10),u:'',noexp:false}};
A.vdel=d=>{const v=VAC.find(x=>x.id==d.id)||{};ask('Impfung löschen?',`„${v.vaccine_name||''}“ wird aus dem Impfpass entfernt.`,T(async()=>{await API('DELETE','/api/health/vaccinations/'+d.id)}));return false};

/* ----- Werte & Trend ----- */
const RNG=[[90,'3 Mon.'],[180,'6 Mon.'],[365,'1 Jahr'],[0,'Alles']];
const niceTicks=(lo,hi,n=4)=>{if(hi==lo){lo-=1;hi+=1}const raw=(hi-lo)/n,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(m=>m*mag).find(x=>x>=raw),t=[];let v=Math.floor(lo/st+1e-9)*st;for(let i=0;i<30;i++){t.push(+v.toFixed(6));if(v>=hi-1e-9)break;v+=st}return t};
const refBand=(f,c)=>/temp/i.test(f.name)||f.unit=='°C'?(c.sp=='dog'?[37.5,39.2]:[38,39.2]):null;
const isW=f=>/gewicht|weight/i.test(f.name)||f.unit=='kg';
function lineChart(vs,f,c){const W=360,H=210,L=44,R=14,T0=14,B1=28,pts=vs.map(v=>({t:new Date(v.ts).getTime(),v:v.value}));
  let t0=pts[0].t,t1=pts[pts.length-1].t;if(t0==t1){t0-=432e5;t1+=432e5}
  const ys=pts.map(q=>q.v),band=refBand(f,c);let lo=Math.min(...ys),hi=Math.max(...ys);if(band){lo=Math.min(lo,band[0]-.2);hi=Math.max(hi,band[1]+.2)}
  const tk=niceTicks(lo,hi),y0=tk[0],y1=tk[tk.length-1],sx=t=>L+(t-t0)/(t1-t0)*(W-L-R),sy=v=>T0+(1-(v-y0)/(y1-y0))*(H-T0-B1),long=(t1-t0)>3e10;
  const df=t=>new Date(t).toLocaleDateString(LOCALE(),long?{month:'short',year:'2-digit'}:{day:'2-digit',month:'2-digit'});
  const xs=[0,1,2,3].map(i=>t0+(t1-t0)*i/3),line=pts.map(q=>sx(q.t).toFixed(1)+','+sy(q.v).toFixed(1)).join(' '),last=pts[pts.length-1];
  return`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Verlauf ${esc(f.name)}">${band?`<rect x="${L}" y="${sy(band[1]).toFixed(1)}" width="${W-L-R}" height="${(sy(band[0])-sy(band[1])).toFixed(1)}" fill="var(--good)" opacity=".14"/><text x="${L+4}" y="${(sy(band[0])-4).toFixed(1)}" font-size="8.5" fill="var(--mut)">Normalbereich</text>`:''}
  ${tk.map(v=>`<line x1="${L}" x2="${W-R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" stroke="var(--line)"/><text x="${L-6}" y="${(sy(v)+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--mut)">${nf(v)}</text>`).join('')}
  ${xs.map((t,i)=>`<text x="${sx(t).toFixed(1)}" y="${H-8}" text-anchor="${i==0?'start':i==3?'end':'middle'}" font-size="10" fill="var(--mut)">${df(t)}</text>`).join('')}
  <polygon points="${sx(pts[0].t).toFixed(1)},${sy(y0)} ${line} ${sx(last.t).toFixed(1)},${sy(y0)}" fill="var(--acc)" opacity=".10"/><polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${line}"/>
  ${pts.length<=45?pts.map(q=>`<circle cx="${sx(q.t).toFixed(1)}" cy="${sy(q.v).toFixed(1)}" r="3" fill="var(--card)" stroke="var(--acc)" stroke-width="2"><title>${nf(q.v)} ${esc(f.unit)} · ${new Date(q.t).toLocaleDateString(LOCALE())}</title></circle>`).join(''):''}
  <circle cx="${sx(last.t).toFixed(1)}" cy="${sy(last.v).toFixed(1)}" r="5" fill="var(--acc)"/><text x="${Math.min(sx(last.t),W-R-4).toFixed(1)}" y="${(sy(last.v)-9).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="var(--ink)">${nf(last.v)}</text></svg>`}
function pVal(c){
  const flds=HF.fields;let o='';
  if(!flds.length)return card('Werte',empty('ruler','Keine Messfelder','Lege unten ein Feld an.'));
  const f=flds.find(x=>x.id==S.hv.f)||flds.find(isW)||flds[0];S.hv.f=f.id;
  const all=HV.filter(v=>v.cat_id==c.id&&v.field_id==f.id).sort((a,b)=>a.ts<b.ts?-1:1),cut=S.hv.r?Date.now()-S.hv.r*864e5:0,vs=all.filter(v=>new Date(v.ts).getTime()>=cut);
  let ch='';
  if(vs.length<2)ch=`<p class="muted">${all.length?'Im gewählten Zeitraum gibt es zu wenige Messwerte – für die Kurve werden mindestens zwei benötigt.':'Trage mindestens zwei Messwerte ein – dann erscheint hier die Verlaufskurve.'}</p>`;
  else{const a=vs[0],b=vs[vs.length-1],d=b.value-a.value,pc=a.value?d/a.value*100:0,days=Math.max(1,(new Date(b.ts)-new Date(a.ts))/864e5),n=vs.length,sg=x=>(x>0?'+':'')+nf(x);
    let sl;if(n>=3){const xs=vs.map(v=>new Date(v.ts).getTime()/864e5),mx=xs.reduce((p,q)=>p+q,0)/n,my=vs.reduce((p,q)=>p+q.value,0)/n;let nu=0,de=0;vs.forEach((v,i)=>{nu+=(xs[i]-mx)*(v.value-my);de+=(xs[i]-mx)**2});sl=de?nu/de*30.44:0}else sl=d/days*30.44;
    let hint='';const bnd=refBand(f,c);
    if(isW(f)&&days>=14&&Math.abs(pc)>=5)hint=`<div class="${pc<0?'warnbox':'infobox'}">${pc<0?'Gewichtsabnahme':'Gewichtszunahme'}: ${sg(pc)} % in ${Math.round(days)} Tagen – im Blick behalten, bei Auffälligkeiten tierärztlich abklären.</div>`;
    if(bnd){if(b.value>39.5)hint=`<div class="warnbox">Letzte Temperatur ${nf(b.value)} °C – erhöht (Fieber möglich). Bei anhaltend hohen Werten tierärztlich abklären.</div>`;else if(b.value>bnd[1])hint=`<div class="infobox">Letzte Temperatur leicht über dem Normalbereich (${nf(bnd[0])}–${nf(bnd[1])} °C).</div>`;else if(b.value<bnd[0])hint=`<div class="infobox">Letzte Temperatur unter dem Normalbereich (${nf(bnd[0])}–${nf(bnd[1])} °C).</div>`}
    ch=`${lineChart(vs,f,c)}<div class="stat4"><div><span class="muted">Veränderung</span><b>${sg(d)} ${esc(f.unit)}</b>${a.value?`<small class="muted">${sg(pc)} %</small>`:''}</div><div><span class="muted">Trend pro Monat</span><b>${sg(sl)} ${esc(f.unit)}</b></div><div><span class="muted">Min / Max</span><b>${nf(Math.min(...vs.map(v=>v.value)))} / ${nf(Math.max(...vs.map(v=>v.value)))}</b></div><div><span class="muted">Messungen</span><b>${n}</b></div></div>${hint}<p class="muted fine">${bnd?'Normalbereich nur als grobe Orientierung. ':''}Die Kurve ersetzt keine tierärztliche Untersuchung.</p>`}
  const last=all[all.length-1];
  o+=`<div class="chips scroll">${flds.map(x=>chip('hvf',x.id,x.id==f.id,esc(x.name))).join('')}</div>`;
  o+=card(esc(f.name)+(f.unit?' ('+esc(f.unit)+')':''),`${last?`<div class="big2"><b>${nf(last.value)}</b> ${esc(f.unit)} <span class="muted">· ${fmt(new Date(last.ts).getTime())}</span></div>`:''}<div class="chips" style="margin:10px 0">${RNG.map(([d,l])=>chip('hvr',d,S.hv.r==d,l)).join('')}</div>${ch}`);
  o+=card('Wert eintragen',`<button class="btn primary block" data-a="valadd" data-c="${c.id}" data-f="${f.id}">${ico('plus',18)} ${esc(f.name)} erfassen</button>${all.length?`<div class="rows" style="margin-top:12px">${[...all].reverse().slice(0,8).map(v=>`<div class="li"><span class="grow"><b>${nf(v.value)} ${esc(f.unit)}</b><small class="muted">${fmt(new Date(v.ts).getTime())}${v.note?' · '+esc(v.note):''}${v.created_by_name&&MULTI?' · '+esc(v.created_by_name):''}</small></span><button class="ib dng" data-a="hvdel" data-id="${v.id}" aria-label="Löschen">${ico('trash',16)}</button></div>`).join('')}</div>`:''}`);
  o+=card('Messfelder',`<div class="chips">${flds.map(x=>`<span class="chip static">${esc(x.name)}${x.unit?' ('+esc(x.unit)+')':''}${x.builtin?'':`<button class="x" data-a="hfdel" data-id="${x.id}" aria-label="Entfernen">${ico('x',12)}</button>`}</span>`).join('')}</div>
  <div class="grid2" style="margin-top:12px">${field('Neues Feld',inp('nfld.n',{ph:'Name, z. B. Puls'}))}${field('Einheit',inp('nfld.u',{ph:'Einheit'}))}</div><button class="btn ghost block" data-a="hfadd">Feld hinzufügen</button>`);
  return o}
A.hvf=d=>{S.hv.f=+d.v};A.hvr=d=>{S.hv.r=+d.v};
A.valadd=d=>{const c=CATS.find(x=>x.id==d.c);S.sh={...measInit(),cat:c.name,f:+d.f}};
A.hvdel=d=>{ask('Wert löschen?','Dieser Messwert wird endgültig gelöscht.',T(async()=>{await API('DELETE','/api/health/values/'+d.id)}));return false};
A.hfadd=T(async()=>{const n=(S.nfld.n||'').trim();if(!n)return;await API('POST','/api/health/fields',{name:n,unit:S.nfld.u||''});S.nfld={n:'',u:''};return()=>toast('Feld angelegt')});
A.hfdel=d=>{const f=HF.fields.find(x=>x.id==d.id)||{};ask('Feld löschen?',`„${f.name}“ wird ausgeblendet. Bereits erfasste Werte bleiben gespeichert.`,T(async()=>{await API('DELETE','/api/health/fields/'+d.id)}));return false};

/* ----- Behandlungen ----- */
const trLogList=t=>`<div class="rows">${t.logs.length?[...t.logs].reverse().map(l=>`<div class="li"><span class="grow"><span class="pill neutral">${esc(l.log_type)}</span> <small class="muted">${fmt(tms(l.timestamp))}${byT({by:l.created_by_name})}</small>${l.value_comment?`<div>${esc(l.value_comment)}</div>`:''}</span><button class="ib dng" data-a="tldel" data-t="${t.id}" data-id="${l.id}" aria-label="Löschen">${ico('trash',16)}</button></div>`).join(''):'<p class="muted">Noch keine Einträge.</p>'}</div>`;
const IVL=[['','Keine automatischen Intervalle'],['2','alle 2 Std.'],['3','alle 3 Std.'],['4','alle 4 Std.'],['6','alle 6 Std.'],['8','alle 8 Std.'],['12','alle 12 Std.'],['24','alle 24 Std.'],['custom','Eigener Wert …']];
function pTreat(c){
  const act=activeTR().filter(t=>t.cat_id==c.id),done=TR.filter(t=>!t.is_active&&t.cat_id==c.id),f=S.tf;
  let o=act.map(t=>trBanner(t,`<div class="row" style="margin-top:12px"><button class="chip sm" data-a="trlogs" data-id="${t.id}">${S.tx[t.id]?'Verlauf ausblenden':'Verlauf'} (${t.logs.length})</button><button class="chip sm" data-a="trdone" data-id="${t.id}">${ico('check',14)} Behandlung abschließen</button></div>${S.tx[t.id]?trLogList(t):''}`)).join('');
  const form=f?`${field('Bezeichnung',inp('tf.title',{ph:'z. B. Zahnsanierung & Extraktion'}))}${field('Startzeitpunkt',`<div class="inl"><input type="datetime-local" data-b="tf.start" value="${esc(f.start)}"><button type="button" class="btn sm ghost" data-a="tfnow">Jetzt</button></div>`)}${field('Erinnerungs-Intervall',sel('tf.int',IVL,{r:true}))}${f.int=='custom'?field('Intervall in Stunden (1–168)',`<input type="number" min="1" max="168" inputmode="numeric" data-b="tf.cint" value="${esc(f.cint)}">`):''}${field('Notizen / Anweisungen',ta('tf.notes','z. B. Kein Springen erlauben, Schmerzmittel alle 8 Std.',3))}<div class="row nowrap" style="margin-top:12px"><button class="btn ghost" data-a="tfclose">Abbrechen</button><button class="btn primary" data-a="tfsave" data-c="${c.id}">Behandlung starten</button></div>`:'';
  o+=card('Behandlungen',(f?'':`<button class="btn primary block" data-a="tfopen">${ico('plus',18)} Neue Behandlung / Post-Op-Phase starten</button>`)+form+(done.length?`<div class="lbl" style="margin-top:14px">Abgeschlossen</div><div class="rows">${done.map(t=>`<div class="li col"><div><b>${esc(t.title)}</b><small class="muted">${fmt(tms(t.start_timestamp))}${t.end_timestamp?' – '+fmt(tms(t.end_timestamp)):''} · ${t.logs.length} Einträge</small></div><div class="row"><button class="chip sm" data-a="trlogs" data-id="${t.id}">${S.tx[t.id]?'Verlauf ausblenden':'Verlauf'}</button><button class="chip sm" data-a="trreact" data-id="${t.id}">Wieder aktivieren</button><button class="chip sm dngtxt" data-a="trdel" data-id="${t.id}">Löschen</button></div>${S.tx[t.id]?trLogList(t):''}</div>`).join('')}</div>`:''));
  return o}
A.tfopen=()=>{S.tf={title:'',start:nowIso(),int:'4',cint:'',notes:''}};A.tfclose=()=>{S.tf=null};A.tfnow=()=>{if(S.tf)S.tf.start=nowIso()};
A.tfsave=T(async d=>{const f=S.tf;if(!f)return;const title=(f.title||'').trim();if(!title){toast('Bitte eine Bezeichnung eingeben');return}const iv=f.int=='custom'?parseInt(f.cint):(f.int?+f.int:null);if(f.int=='custom'&&!(iv>=1&&iv<=168)){toast('Intervall: 1 bis 168 Stunden');return}
  await API('POST','/api/health/treatments',{cat_id:+d.c,title,start_timestamp:f.start||null,interval_hours:iv||null,notes:f.notes});S.tf=null;return()=>toast('Behandlung gestartet')});
A.trlogs=d=>{S.tx[d.id]=!S.tx[d.id]};
A.trdone=d=>{const t=TR.find(x=>x.id==d.id)||{};ask('Behandlung abschließen?',`„${t.title||''}“ wird archiviert und bleibt für den Tierarztbericht erhalten.`,T(async()=>{await API('PUT','/api/health/treatments/'+d.id,{is_active:false});return()=>toast('Behandlung abgeschlossen und archiviert')}),'Abschließen',false);return false};
A.trreact=T(async d=>{await API('PUT','/api/health/treatments/'+d.id,{is_active:true})});
A.trdel=d=>{const t=TR.find(x=>x.id==d.id)||{};ask('Behandlung löschen?',`„${t.title||''}“ wird samt aller Log-Einträge endgültig gelöscht.`,T(async()=>{await API('DELETE','/api/health/treatments/'+d.id)}));return false};
A.tldel=d=>{ask('Eintrag löschen?','Dieser Log-Eintrag wird entfernt.',T(async()=>{await API('DELETE','/api/health/treatments/'+d.t+'/logs/'+d.id)}));return false};

/* Tierfoto: verkleinern und hochladen */
async function shrinkImg(file,max=640){const url=URL.createObjectURL(file);try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});const k=Math.min(1,max/Math.max(img.width,img.height)),cv=document.createElement('canvas');cv.width=Math.round(img.width*k);cv.height=Math.round(img.height*k);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return await new Promise(r=>cv.toBlob(r,'image/jpeg',.86))}finally{URL.revokeObjectURL(url)}}
const uploadPetPhoto=T(async(id,file)=>{if(!file)return;let blob=file;try{blob=(await shrinkImg(file))||file}catch(e){}const fd=new FormData();fd.append('image',blob,'pet.jpg');await API('POST','/api/animals/'+id+'/photo',undefined,fd);return()=>toast('Foto gespeichert')});
A.phdel=T(async()=>{await API('DELETE','/api/animals/'+S.pet+'/photo')});
