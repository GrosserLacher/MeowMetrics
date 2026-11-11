/* views/history.js – Verlauf (Liste + Filter), Auswertung und Bericht-Export */
const histKinds=()=>[['f','Fütterungen',ft('food')||ft('snack')||ft('drink')],['m','Präparate',ft('meds')],['v','Spucken',ft('vomit')],['s','Kot',ft('stool')],['b','Auffälligkeiten',ft('finding')]].filter(x=>x[2]);
const histSubs=()=>[['list','Verlauf','list'],ft('stats')?['stats','Auswertung','chart']:null,ft('report')?['report','Bericht','file']:null].filter(Boolean);
function vHist(){
  const subs=histSubs();if(!subs.some(x=>x[0]==S.hist))S.hist='list';
  let o=subs.length>1?seg(subs,S.hist,'hsub'):'';
  return o+(S.hist=='stats'?vStats():S.hist=='report'?vReport():vList())}
A.hsub=d=>{S.hist=d.v};
const hasHidden=()=>CATS.length>0;
function vList(){
  const f=S.fl,ks=histKinds(),ok=k=>ks.some(x=>x[0]==k);
  const it=[...B.filter(b=>ok('f')).map(b=>({k:'f',ts:b.ts,x:b})),...MG.filter(()=>ok('m')).map(m=>({k:'m',ts:m.ts,x:m})),...V.filter(()=>ok('v')).map(v=>({k:'v',ts:v.ts,x:v})),...FD.filter(x=>ok(x.kind=='stool'?'s':'b')).map(x=>({k:x.kind=='stool'?'s':'b',ts:x.ts,x}))]
   .filter(i=>f.kind=='all'||i.k==f.kind).filter(i=>f.cat=='all'||(i.k=='f'?f.cat in i.x.cats:i.k=='m'?i.x.cats.includes(f.cat):i.x.cat==f.cat)).sort((a,b)=>b.ts-a.ts);
  let o=`<div class="filters"><div class="chips scroll">${chip('hfc','all',f.cat=='all','Alle Tiere')}${CATS.map(c=>achip(c.name,f.cat==c.name,'hfc')).join('')}</div>
  <div class="chips scroll">${chip('hfk','all',f.kind=='all','Alle')}${ks.map(([k,l])=>chip('hfk',k,f.kind==k,l)).join('')}</div>
  ${CATS.length?swc('data-hd','Gelöschte Tiere ausblenden',HD):''}</div>`;
  o+=it.slice(0,f.n).map(histItem).join('')||empty('list','Noch keine Einträge','Mit „Eintragen“ legst du den ersten Eintrag an.',`<button class="btn primary" data-a="addmenu">${ico('plus',18)} Eintragen</button>`);
  if(it.length>f.n)o+=`<button class="btn ghost block" data-a="more">Weitere anzeigen (${it.length-f.n})</button>`;
  return o}
A.hfc=d=>{S.fl.cat=d.v;S.fl.n=60};A.hfk=d=>{S.fl.kind=d.v;S.fl.n=60};A.more=()=>{S.fl.n+=60};
const acts=(k,id)=>`<div class="acts"><button class="ib" data-a="edit" data-k="${k}" data-id="${esc(id)}" aria-label="Bearbeiten">${ico('edit',16)}</button><button class="ib dng" data-a="del" data-k="${k}" data-id="${esc(id)}" aria-label="Löschen">${ico('trash',16)}</button></div>`;
const thumbsH=f=>f.imgs&&f.imgs.length?`<div class="thumbs">${f.imgs.map(u=>`<img src="${esc(u)}" loading="lazy" alt="Foto" data-a="zoom" data-src="${esc(u)}">`).join('')}</div>`:'';
function histItem(i){const x=i.x;
  if(i.k=='f')return`<article class="card item"><div class="row between top"><div class="row nowrap"><span class="ti">${ico(x.kind=='snack'?'cookie':x.kind=='drink'?'glass':'bowl',18)}</span><div><b>${esc(x.food)}</b><div class="muted">${esc(x.man)} · ${KL[x.kind]} · ${fmt(x.ts)}${byT(x)}</div></div></div>${acts('f',x.id)}</div>
    <div class="chips">${Object.entries(x.cats).map(([c,r])=>pill(esc(c)+' · '+esc(rl(r).label),'r'+rc(r))).join('')}</div>${x.note?`<p class="muted">${esc(x.note)}</p>`:''}</article>`;
  if(i.k=='m')return`<article class="card item"><div class="row between top"><div class="row nowrap"><span class="ti">${ico('pill',18)}</span><div><b>${esc(x.med)}${x.dose?' · '+esc(x.dose):''}</b><div class="muted">Präparat · ${fmt(x.ts)}${byT(x)}</div></div></div>${acts('m',x.id)}</div>
    <div class="chips">${x.cats.map(c=>pill(esc(c))).join('')}${x.wf?pill('mit Fütterung','ok'):pill('ohne Fütterung')}</div>${x.note?`<p class="muted">${esc(x.note)}</p>`:''}</article>`;
  if(i.k=='v'){const l=rel(x)?lk(x):[],t=vtl(x.type);
    return`<article class="card item"><div class="row between top"><div class="row nowrap"><span class="ti bad">${ico('drop',18)}</span><div><b>${t.emoji?esc(t.emoji)+' ':''}${esc(t.label)}</b> · ${esc(x.cat)}<div class="muted">${fmt(x.ts)}${byT(x)}${x.note?' · '+esc(x.note):''}</div></div></div>${acts('v',x.id)}</div>
    ${x.img?`<img class="thumb" src="${esc(x.img)}" alt="Foto" data-a="zoom" data-src="${esc(x.img)}">`:''}${rel(x)?(l.length?`<div class="warnbox"><b>Mahlzeiten in den 12 h davor:</b><br>${l.map(b=>`${hm(b.ts)} ${esc(b.food)}`).join('<br>')}</div>`:'<div class="infobox">Keine Mahlzeit in den 12 h davor.</div>'):''}</article>`}
  const st=x.kind=='stool',b=st?BR[(x.bristol||4)-1]:null;
  return`<article class="card item"><div class="row between top"><div class="row nowrap"><span class="ti">${ico(st?'stool':'eye',18)}</span><div><b>${st?'Kot · Bristol '+x.bristol:FK[x.kind][0]}</b> ${st?pill(b[2],'r'+brc(x.bristol)):''}<div class="muted">${esc(x.cat)} · ${fmt(x.ts)}${byT(x)}${x.loc?' · '+esc(x.loc):''}</div></div></div>${acts(st?'s':'b',x.id)}</div>
  ${x.flags.length?`<div class="chips">${x.flags.map(k=>pill(FL[k]||esc(k),'r1')).join('')}</div>`:''}${x.note?`<p class="muted">${esc(x.note)}</p>`:''}${thumbsH(x)}</article>`}

/* ---------- Auswertung ---------- */
const avgOf=a=>a.reduce((x,y)=>x+y,0)/a.length;
function rank(){const cs=S.an.cat=='all'?CATS.map(c=>c.name):[S.an.cat],m={};
  B.filter(b=>b.kind==S.an.kind).forEach(b=>cs.forEach(c=>{if(!(c in b.cats))return;const x=m[b.food]=m[b.food]||{n:0,s:0,h:0};x.n++;x.s+=b.cats[c];if(V.some(v=>rel(v)&&(v.cat==c||v.cat=='Unbekannt')&&v.ts>=b.ts&&v.ts-b.ts<=12*H))x.h++}));
  return Object.entries(m).map(([k,x])=>({k,...x,avg:x.s/x.n})).sort((a,b)=>b.avg-a.avg)}
function rotation(){const st={},hit={};B.filter(b=>b.kind=='food').forEach(b=>{const e=st[b.man+' – '+b.food]=st[b.man+' – '+b.food]||{n:0,s:0,last:0};Object.values(b.cats).forEach(r=>{e.n++;e.s+=r});e.last=Math.max(e.last,b.ts)});
  V.filter(rel).forEach(v=>lk(v).forEach(b=>{hit[b.man+' – '+b.food]=1}));
  return Object.entries(st).map(([k,e])=>({k,avg:e.s/e.n,days:Math.floor((Date.now()-e.last)/864e5)})).filter(x=>x.avg>=NR()*2/3&&!hit[x.k]).sort((a,b)=>b.days-a.days||b.avg-a.avg).slice(0,3)}
function vStats(){
  const ks=['food','snack','drink'].filter(ft);if(ks.length&&!ks.includes(S.an.kind))S.an.kind=ks[0];
  const Q=rank(),n=Q.reduce((a,x)=>a+x.n,0),avg=n?Q.reduce((a,x)=>a+x.s,0)/n:0,KN={food:'Futter',snack:'Snacks',drink:'Getränke'};
  let o=`<div class="chips">${ks.map(k=>chip('ank',k,S.an.kind==k,KN[k])).join('')}</div><div class="chips scroll">${chip('anc','all',S.an.cat=='all','Alle')}${CATS.map(c=>achip(c.name,S.an.cat==c.name,'anc')).join('')}</div>`;
  o+=`<div class="kpis"><div class="card"><b>${n}</b><span class="muted">Mahlzeiten</span></div><div class="card"><b>${avg.toFixed(1)}</b><span class="muted">Ø von ${NR()}</span></div>${ft('vomit')?`<div class="card"><b>${V.filter(rel).length}/${V.length}</b><span class="muted">Futter-Spucken</span></div>`:''}</div>`;
  o+=card('Das lieben sie am meisten',CATS.map(c=>{const m={};B.filter(b=>b.kind==S.an.kind).forEach(b=>{if(c.name in b.cats){const x=m[b.food]=m[b.food]||{s:0,n:0};x.s+=b.cats[c.name];x.n++}});const t=Object.entries(m).sort((a,b)=>b[1].s/b[1].n-a[1].s/a[1].n)[0];return`<div class="li">${av(c)}<span><b>${esc(c.name)}</b><small class="muted">${t?esc(t[0]):'Noch keine Daten'}</small></span></div>`}).join('')||'<p class="muted">Noch keine Daten.</p>');
  o+=card('Ranking der Sorten',Q.map((x,i)=>{const c=x.avg>=NR()*.83?'good':x.avg>=NR()*.6?'ok':'bad';return`<div class="rk"><div class="row between"><b>${i+1}. ${esc(x.k)}</b>${pill('Ø '+x.avg.toFixed(1),c)}</div><div class="bar"><i style="width:${x.avg/NR()*100}%;background:var(--${c})"></i></div><span class="muted">${x.n}× gefüttert${x.h?` · <span class="neg">${x.h}× Spucken binnen 12 h</span>`:''}</span></div>`}).join('')||'<p class="muted">Keine Daten.</p>');
  const mx={},pair=new Set(),cs=CATS.map(c=>c.name);
  B.filter(b=>b.kind==S.an.kind).forEach(b=>Object.entries(b.cats).forEach(([c,r])=>{const m=mx[b.food]=mx[b.food]||{};(m[c]=m[c]||[]).push(r)}));
  V.filter(rel).forEach(v=>lk(v).forEach(b=>Object.keys(b.cats).forEach(c=>{if(v.cat==c||v.cat=='Unbekannt')pair.add(b.food+'|'+c)})));
  const rows=Object.entries(mx).sort((x,y)=>avgOf(Object.values(y[1]).flat())-avgOf(Object.values(x[1]).flat()));
  o+=card('Akzeptanz-Matrix (Wer frisst was?)',`<p class="muted">Durchschnittliche Bewertung pro Tier. Markiert = futterrelevantes Spucken binnen 12 h.</p>${rows.length?`<div class="scrollx"><table class="tbl"><thead><tr><th>Sorte</th>${cs.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(([k,m])=>`<tr><td><b>${esc(k)}</b></td>${cs.map(c=>m[c]?`<td>${pill('Ø '+avgOf(m[c]).toFixed(1)+' ('+m[c].length+'×)'+(pair.has(k+'|'+c)?' !':''),'r'+rc(Math.round(avgOf(m[c]))))}</td>`:'<td class="muted">–</td>').join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="muted">Noch keine Daten.</p>'}`);
  if(ft('vomit')){const tc={};V.filter(v=>rel(v)&&(S.an.cat=='all'||v.cat==S.an.cat||v.cat=='Unbekannt')).forEach(v=>new Set(lk(v).filter(b=>b.kind==S.an.kind&&(S.an.cat=='all'||S.an.cat in b.cats)).map(b=>b.food)).forEach(f=>{tc[f]=(tc[f]||0)+1}));
    const tr=Object.entries(tc).sort((x,y)=>y[1]-x[1]);
    o+=card('Unverträglichkeits-Radar',`<p class="muted">Was lag in den 12 h vor futterrelevantem Spucken im Napf? Haarballen und Galle/Gras werden herausgefiltert.</p>${tr.length?tr.map(([k,n])=>`<div class="warnbox row between"><span>${esc(k)}</span><b>${n}× vor Spucken gefüttert</b></div>`).join(''):'<p class="muted">Bisher wurde keine Sorte vor futterrelevantem Spucken gefunden.</p>'}`)}
  if(S.an.kind=='food'){const r=rotation();if(r.length)o+=card('Rotations-Vorschlag: Was gibt’s heute?',`<p class="muted">Gut bewertet, verträglich und am längsten nicht im Napf</p><div class="chips">${r.map(x=>`<span class="chip static">${esc(x.k)} · Ø ${x.avg.toFixed(1)} · ${x.days?'vor '+x.days+' d':'heute'}</span>`).join('')}</div>`)}
  return o}
A.ank=d=>{S.an.kind=d.v};A.anc=d=>{S.an.cat=d.v};

/* ---------- Bericht ---------- */
const RPK=[['food','Futter'],['snack','Snacks'],['drink','Getränke'],['meds','Präparate'],['vomit','Spucken'],['stool','Kot'],['finding','Auffälligkeiten'],['health','Messwerte'],['hgraph','Gesundheitsgraphen'],['vacc','Impfstatus'],['treat','Behandlungen']];
const RFT={health:'values',hgraph:'values',vacc:'vaccination',treat:'treatment'},RPKA=()=>RPK.filter(([k])=>ft(RFT[k]||k));
const hasUnk=()=>V0.some(v=>v.cat=='Unbekannt')||FD0.some(f=>f.cat=='Unbekannt');
function rpInit(){if(!S.rp)S.rp={k:Object.fromEntries(RPK.map(([k])=>[k,1])),x:{},u:1,days:30,cust:0,from:'',to:'',mix:0}}
function vReport(){rpInit();const r=S.rp,td=nowIso().slice(0,10),all=CATS.every(c=>!r.x[c.id]);
  return card('Bericht zusammenstellen',`<p class="muted">Wähle Kategorien, Tiere und Zeitraum. Der Bericht kann als PDF gespeichert, gedruckt oder per E-Mail an die Praxis gesendet werden. Das Alter eines Tieres steht einmal im Tierkopf (Stand: heute).</p>
  <div class="lbl">Kategorien</div><div class="chips">${RPKA().map(([k,l])=>chip('rpk',k,r.k[k],l)).join('')}</div>
  <div class="lbl" style="margin-top:14px">Tiere</div><div class="chips">${chip('rpall','',all,'Alle Tiere')}${CATS.map(c=>achip(c.name,!r.x[c.id],'rpa')).join('')}${hasUnk()?chip('rpa','Unbekannt',r.u,'Unbekannt'):''}</div>
  <div class="lbl" style="margin-top:14px">Zeitraum</div><div class="chips">${[7,14,30,90,365].map(d=>chip('rpd',d,!r.cust&&r.days==d,d+' Tage')).join('')}${chip('rpc','',r.cust,'Eigener Zeitraum')}</div>
  ${r.cust?`<div class="grid2" style="margin-top:10px">${field('Von',`<input type="date" data-b="rp.from" value="${r.from}" max="${td}">`)}${field('Bis',`<input type="date" data-b="rp.to" value="${r.to}" max="${td}">`)}</div>`:`<div class="inl" style="margin-top:10px"><span class="muted">Letzte</span><input type="number" min="1" max="3650" inputmode="numeric" data-b="rp.days" value="${r.days}" style="width:96px"><span class="muted">Tage</span></div>`}
  ${sw('rp.mix','Zeitlich gemischt')}<p class="muted fine">Aus: Kategorien getrennt. An: alle Einträge eines Tieres in zeitlicher Abfolge (Gesundheit bleibt oben).</p>
  <button class="btn primary block" data-a="rpgo">${ico('file',18)} Bericht erstellen</button>`)}
A.rpk=d=>{S.rp.k[d.v]=S.rp.k[d.v]?0:1};
A.rpa=d=>{if(d.v=='Unbekannt'){S.rp.u=S.rp.u?0:1;return}const c=catByName(d.v);if(c)S.rp.x[c.id]=S.rp.x[c.id]?0:1};
A.rpall=()=>{const all=CATS.every(c=>!S.rp.x[c.id]);CATS.forEach(c=>{S.rp.x[c.id]=all?1:0});S.rp.u=all?0:1};
A.rpd=d=>{S.rp.days=+d.v;S.rp.cust=0};
A.rpc=()=>{const r=S.rp;if(!r.cust){r.from=r.from||new Date(Date.now()-(Math.max(1,r.days)-1)*864e5-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);r.to=r.to||nowIso().slice(0,10)}r.cust=r.cust?0:1};
A.rpgo=()=>{const r=S.rp,k=RPKA().map(x=>x[0]).filter(x=>r.k[x]),an=CATS.filter(c=>!r.x[c.id]),u=r.u&&hasUnk()?1:0;
  if(!k.length)return toast('Bitte mindestens eine Kategorie wählen');if(!an.length&&!u)return toast('Bitte mindestens ein Tier wählen');
  const q=new URLSearchParams({kinds:k.join(','),animals:an.map(c=>c.id).join(','),unknown:u,lang:LANG,cc:CATS.map(c=>c.id+'-'+ccol(c).slice(1)).join(',')});
  if(r.cust){if(!r.from||!r.to||r.from>r.to)return toast('Bitte einen gültigen Zeitraum wählen');q.set('date_from',r.from);q.set('date_to',r.to)}else q.set('days',Math.max(1,Math.min(3650,+r.days||30)));
  q.set('mode',r.mix?'mixed':'split');xoOpen(q,an.map(c=>c.id))};

/* Export-Dialog: PDF speichern · drucken · per E-Mail senden */
let XO=null;
const xoName=()=>((window.APP_NAME||'report').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'report')+'_'+(LANG=='en'?'report':'bericht')+'_'+new Date().toISOString().slice(0,10)+'.pdf';
const xoClinics=()=>{const m={};XO.an.forEach(id=>{const p=PRF[id]||{},v=VETS.find(x=>x.id==p.vet_clinic_id);if(v&&v.email)(m[v.id]=m[v.id]||{v,names:[]}).names.push((CATS.find(c=>c.id==id)||{}).name||'')});return Object.values(m)};
function xoOpen(q,an){XO={q:q.toString(),an,step:'choose',busy:0,cl:[],sel:{},pending:null};xoRender()}
function xoRender(){const el=$('#xo');if(!XO){el.className='';el.innerHTML='';return}el.className='on';
  const opt=(a,i,t,d)=>`<button class="opt wide" data-a="${a}"><b>${ico(i,16)} ${t}</b><small>${d}</small></button>`;let inner;
  if(XO.busy)inner='<h3>PDF wird erstellt …</h3><p class="muted">Das dauert einen Moment.</p>';
  else if(XO.step=='vet')inner=`<h3>An welche Praxis soll der Bericht gesendet werden?</h3><p class="muted">Die ausgewählten Tiere gehören zu verschiedenen Praxen. Wähle die E-Mail-Adressen.</p>${XO.cl.map(x=>swc(`data-xo="${x.v.id}"`,esc(x.v.name),XO.sel[x.v.id],esc(x.v.email)+' · '+x.names.map(esc).join(', '))).join('')}<div class="row nowrap" style="margin-top:14px"><button class="btn ghost" data-a="xoback">Zurück</button><button class="btn primary" data-a="xovetgo">Weiter</button></div>`;
  else if(XO.step=='ready'){const em=XO.pending.em;inner=`<h3>Bericht ist bereit</h3>${em.length?`<div class="lbl">Empfänger</div><div class="chips">${em.map(a=>`<span class="chip static">${esc(a)}</span>`).join('')}</div>`:'<p class="muted">Für die gewählten Tiere ist keine Praxis-E-Mail hinterlegt.</p>'}
    <p class="muted fine">Das Teilen-Menü kann keine Empfängeradresse an die Mail-App übergeben (Einschränkung von Android und iOS). Kopiere die Adresse vorher – oder öffne die Mail-App direkt mit Empfänger und hänge das heruntergeladene PDF an.</p>
    <div style="display:grid;gap:8px;margin-top:12px">${em.length?`<button class="btn primary block" data-a="xomailto">${ico('mail',18)} Mail-App mit Empfänger öffnen</button><button class="btn ghost block" data-a="xocopy">Adresse kopieren</button>`:''}<button class="btn ${em.length?'ghost':'primary'} block" data-a="xosharenow">${ico('download',18)} PDF teilen …</button><button class="btn ghost block" data-a="xoclose">Schließen</button></div>`}
  else inner=`<h3>Bericht erstellen</h3><p class="muted">Wie möchtest du den Bericht verwenden?</p>${opt('xopdf','download','Nur PDF speichern','Lädt den Bericht als PDF-Datei herunter.')}${opt('xoprint','printer','Direkt drucken','Öffnet den Druckdialog deines Browsers.')}${opt('xomail','mail','Per E-Mail versenden','Mail-App mit der Praxis als Empfänger oder PDF teilen.')}<button class="btn ghost block" data-a="xoclose">Abbrechen</button>`;
  el.innerHTML=`<div class="box">${inner}</div>`}
async function xoFetch(){const r=await fetch('/api/export/report.pdf?'+XO.q,{credentials:'same-origin'});if(!r.ok){let m='PDF konnte nicht erstellt werden';try{const j=await r.json();if(j.detail)m=j.detail}catch(_){}throw new Error(m)}return r.blob()}
function xoDownload(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),6e4)}
async function xoReady(em){XO.busy=1;xoRender();try{const blob=await xoFetch();XO.pending={blob,name:xoName(),em};XO.step='ready'}catch(e){XO.step='choose';toast(e.message)}XO.busy=0;xoRender()}
Object.assign(A,{
  xoclose:()=>{XO=null;xoRender();return false},xoback:()=>{if(XO){XO.step='choose';xoRender()}return false},
  xopdf:async()=>{XO.busy=1;xoRender();try{xoDownload(await xoFetch(),xoName());XO=null}catch(e){XO.busy=0;toast(e.message)}xoRender();return false},
  xoprint:()=>{window.open('/api/export/report?'+XO.q+'&autoprint=1','_blank');XO=null;xoRender();return false},
  xomail:()=>{XO.cl=xoClinics();if(XO.cl.length>1){XO.step='vet';XO.sel=Object.fromEntries(XO.cl.map(x=>[x.v.id,1]));xoRender()}else xoReady(XO.cl.map(x=>x.v.email));return false},
  xovetgo:()=>{const em=XO.cl.filter(x=>XO.sel[x.v.id]).map(x=>x.v.email);if(!em.length){toast('Bitte mindestens eine Praxis wählen');return false}xoReady(em);return false},
  xocopy:async()=>{const em=XO.pending.em.join(', ');try{await navigator.clipboard.writeText(em);toast('Adresse kopiert')}catch(e){toast(em)}return false},
  xomailto:()=>{const pd=XO.pending,title=LANG=='en'?'Vet report':'Tierarztbericht',note=LANG=='en'?'The PDF was downloaded – please attach it to this e-mail.':'Das PDF wurde heruntergeladen – bitte an diese E-Mail anhängen.';
    xoDownload(pd.blob,pd.name);setTimeout(()=>{const a=document.createElement('a');a.href='mailto:'+pd.em.map(encodeURIComponent).join(',')+'?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent((LANG=='en'?'Please find the current report attached.':'Anbei der aktuelle Bericht.')+'\n\n('+note+')');document.body.appendChild(a);a.click();a.remove()},400);return false},
  xosharenow:async()=>{const pd=XO&&XO.pending;if(!pd)return false;const file=new File([pd.blob],pd.name,{type:'application/pdf'}),data={title:LANG=='en'?'Vet report':'Tierarztbericht',files:[file]};
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share(data);XO=null}catch(e){if(e&&e.name=='AbortError')return false;xoDownload(pd.blob,pd.name);XO=null}}else{xoDownload(pd.blob,pd.name);XO=null}xoRender();return false}});
