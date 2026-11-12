/* views/today.js – Startseite "Heute" */
const dayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
function trBanner(t,extra){
  const nx=trNext(t),last=t.logs[t.logs.length-1];
  return`<section class="card alert"><div class="row between"><div class="row"><span class="dot"></span><b class="big">${esc(t.title)}</b></div>${pill(esc(t.cat_name||''))}</div>
  <p class="muted">Läuft seit <b data-tick="since" data-ts="${tms(t.start_timestamp)}">${tickTxt('since',tms(t.start_timestamp))}</b>${byT({by:t.created_by_name})}</p>
  <p>${nx?`Nächste Erinnerung: <b data-tick="next" data-ts="${nx}" ${nx<=Date.now()?'class="neg"':''}>${tickTxt('next',nx)}</b>`:'<span class="muted">Keine automatischen Intervalle</span>'}</p>
  ${last?`<p class="muted">Zuletzt: ${esc(last.log_type)} · ${fmt(tms(last.timestamp))}${last.value_comment?' · '+esc(last.value_comment):''}</p>`:''}
  ${t.notes?`<div class="note">${esc(t.notes)}</div>`:''}
  <div class="lbl" style="margin-top:12px">Log-Eintrag hinzufügen</div>
  <div class="chips">${LOGT.map(([k,i])=>`<button type="button" class="chip sm" data-a="m_tlog" data-tid="${t.id}" data-type="${k}">${ico(i,14)} ${k}</button>`).join('')}</div>
  ${extra||''}</section>`}
function dueItems(){const out=[],td=nowIso().slice(0,10),today=new Date(td+'T00:00');
  if(ft('treatment'))activeTR().forEach(t=>{const nx=trNext(t);if(nx&&nx<=Date.now())out.push({i:'pulse',c:'bad',t:`Behandlung „${t.title}“ (${t.cat_name}): Kontrolle überfällig`})});
  if(ft('vaccination'))VAC.filter(vplanned).forEach(v=>{const d=Math.round((new Date(v.planned_date+'T00:00')-today)/864e5),c=CATS.find(x=>x.id==v.cat_id);if(!c||d>14)return;out.push({i:'syringe',c:d<0?'bad':'ok',t:`Geplante Impfung ${v.vaccine_name} (${c.name}): ${d<0?'seit '+(-d)+' Tagen überfällig':d==0?'heute':'in '+d+' Tagen'}`,go:c.id})});
  if(ft('vaccination')){const newest={};VAC.forEach(v=>{if(!v.valid_until||vplanned(v)||v.no_expiry)return;const k=v.cat_id+'|'+v.vaccine_name.toLowerCase();if(!newest[k]||v.valid_until>newest[k].valid_until)newest[k]=v});
    Object.values(newest).forEach(v=>{const d=Math.round((new Date(v.valid_until+'T00:00')-today)/864e5),c=CATS.find(x=>x.id==v.cat_id);if(!c||d>30)return;out.push({i:'syringe',c:d<0?'bad':'ok',t:`Impfung ${v.vaccine_name} (${c.name}): ${d<0?'seit '+(-d)+' Tagen abgelaufen':d==0?'läuft heute ab':'läuft in '+d+' Tagen ab'}`,go:c.id})})}
  CATS.forEach(c=>{const b=HF.birthdays[c.id]||(PRF[c.id]||{}).birthday;if(!b)return;const bd=new Date(b+'T00:00');let n=new Date(today.getFullYear(),bd.getMonth(),bd.getDate());if(n<today)n=new Date(today.getFullYear()+1,bd.getMonth(),bd.getDate());const d=Math.round((n-today)/864e5);
    if(d<=14&&n.getFullYear()-bd.getFullYear()>=1)out.push({i:'cake',c:'good',t:d==0?`${c.name} hat heute Geburtstag`:`${c.name} hat in ${d} Tagen Geburtstag`})});
  return out}
function vToday(){
  const h=new Date().getHours(),k=h<5||h>=22?'n':h<11?'m':h<17?'d':'e',G={m:'Guten Morgen!',d:'Hallo, schön dich zu sehen!',e:'Guten Abend!',n:'Noch wach?'};
  const lv=[...V].sort((a,b)=>b.ts-a.ts)[0],ds=dayStart(),fedToday=B.some(b=>b.ts>=ds&&b.kind!='drink');
  let sub=CATS.map(c=>c.name).join(' · ')+' — euer Futter-Tagebuch';
  if(ft('vomit')&&lv&&rel(lv)&&Date.now()-lv.ts<24*H)sub=`Letztes Spucken: ${lv.cat}, ${fmt(lv.ts)} – wir behalten es im Blick`;
  else if((ft('food')||ft('snack'))&&CATS.length&&!fedToday)sub='Heute noch keine Mahlzeit erfasst';
  const lastF=[...B].filter(x=>x.kind=='food').sort((a,b)=>b.ts-a.ts)[0],due=dueItems();
  let o=`<header class="hero"><div><h1>${G[k]}</h1><p>${esc(sub)}</p><div class="avs">${CATS.map(c=>av(c)).join('')}</div></div></header>`;
  if(!CATS.length)return o+card('Willkommen',empty('paw','Noch kein Tier','Lege dein erstes Tier an, dann kannst du loslegen.',`<button class="btn primary" data-a="newpet">${ico('plus',18)} Tier anlegen</button>`));
  o+=`<button class="btn primary big block cta" data-a="addmenu">${ico('plus',22)} Aktion starten</button>`;
  const q=[];
  if(ft('food')&&lastF)q.push(`<button class="qa" data-a="repeat"><span class="ti">${ico('repeat',20)}</span><span><b>Wie zuletzt füttern</b><small>${esc(lastF.food)} · ${esc(Object.keys(lastF.cats).join(', '))}${PREFS.repeatSkip?' · Bewertung wird 1:1 übernommen':''}</small></span></button>`);
  if(ft('drink'))q.push(`<button class="qa" data-a="stdDrink"><span class="ti">${ico('glass',20)}</span><span><b>Standardgetränk</b><small>${esc(DD)} für ${Object.keys(selAll()).length||'alle'} Tiere</small></span></button>`);
  if(q.length)o+=`<div class="qas">${q.join('')}</div>`;
  if(ft('treatment'))o+=activeTR().map(t=>trBanner(t)).join('');
  if(due.length)o+=card('Fällig und wichtig',`<div class="rows">${due.map(x=>`<div class="li ${x.go?'link':''}" ${x.go?`data-a="openpet" data-id="${x.go}"`:''}><span class="ti ${x.c}">${ico(x.i,18)}</span><span>${esc(x.t)}</span></div>`).join('')}</div>`);
  const rows=CATS.map(c=>{
    const f=B.filter(b=>b.ts>=ds&&c.name in b.cats&&b.kind!='drink').length,m=MG.filter(x=>x.ts>=ds&&x.cats.includes(c.name)).length,
      i=V.filter(x=>x.ts>=ds&&x.cat==c.name).length+FD.filter(x=>x.ts>=ds&&x.cat==c.name).length,lastB=[...B].filter(b=>c.name in b.cats&&b.kind!='drink').sort((a,b)=>b.ts-a.ts)[0];
    const st=[];if(ft('food')||ft('snack'))st.push(`${ico('bowl',14)} ${f}`);if(ft('meds'))st.push(`${ico('pill',14)} ${m}`);if(incOn())st.push(`${ico('drop',14)} ${i}`);
    return`<div class="li link" data-a="openpet" data-id="${c.id}">${av(c)}<span class="grow"><b>${esc(c.name)}</b><small class="muted">${lastB?'Zuletzt gefüttert '+fmt(lastB.ts):'Heute noch nicht gefüttert'}</small></span><span class="stats">${st.map(x=>`<span>${x}</span>`).join('')}</span></div>`}).join('');
  o+=card('Heute bisher',`<div class="rows">${rows}</div>`);
  return o}
