/* views/common.js – gemeinsame Bausteine: Aktionen, Bindings, Chips, Segmented Controls, Dialog */
const A={};
const setPath=(p,v)=>{const k=p.split('.');let o=S;for(let i=0;i<k.length-1;i++){if(o[k[i]]==null||typeof o[k[i]]!='object')o[k[i]]={};o=o[k[i]]}o[k[k.length-1]]=v};
const getPath=p=>p.split('.').reduce((o,k)=>o==null?o:o[k],S);
/* Aktion ausführen, danach neu laden und zeichnen (Fehler werden vom API-Aufruf als Hinweis gezeigt) */
const T=f=>async(...a)=>{QN=false;try{const cb=await f(...a);await load();if(cb)cb()}catch(e){console.warn(e);if(e&&e.offline)toast('Keine Verbindung – diese Aktion ist nur online möglich');try{await load()}catch(_){}}render()};

A.dur=d=>{setPath(d.p+'.dur',d.v)};
const chip=(a,v,on,txt,x='')=>`<button type="button" class="chip ${on?'on':''}" data-a="${a}" data-v="${esc(v)}" ${x}>${txt}</button>`;
const achip=(name,on,a)=>{const c=catByName(name);return`<button type="button" class="chip pet ${on?'on':''}" style="${avStyle(c)}" data-a="${a}" data-v="${esc(name)}">${photoOn(c)?`<i class="ini ph" style="${avStyle(c)};background-image:url('${esc(c.photo)}')"></i>`:`<i class="ini ${spc(c)}">${esc(name[0]||'?')}</i>`}<span class="cn">${esc(name)}</span></button>`};
const seg=(items,cur,a)=>`<div class="seg" role="tablist">${items.map(([k,l,i])=>`<button type="button" role="tab" class="${cur==k?'on':''}" data-a="${a}" data-v="${k}">${i?ico(i,16):''}<span>${l}</span></button>`).join('')}</div>`;
const field=(l,inner,cls='')=>`<label class="fld ${cls}"><span class="lbl">${l}</span>${inner}</label>`;
const inp=(p,o={})=>`<input type="${o.t||'text'}" data-b="${p}" value="${esc(getPath(p)==null?'':getPath(p))}" ${o.ph?`placeholder="${esc(o.ph)}"`:''} ${o.x||''}>`;
const sel=(p,opts,o={})=>`<select data-b="${p}" ${o.r?'data-r':''} ${o.ch?`data-ch="${o.ch}"`:''}>${opts.map(([v,l])=>`<option value="${esc(v)}" ${String(getPath(p))==String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
const sw=(p,label,r)=>`<label class="row-sw"><span>${label}</span><span class="sw"><input type="checkbox" data-b="${p}" ${getPath(p)?'checked':''} ${r?'data-r':''}><i></i></span></label>`;
const swc=(attr,label,on,sub='')=>`<label class="row-sw"><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span><span class="sw"><input type="checkbox" ${attr} ${on?'checked':''}><i></i></span></label>`;
const card=(title,body,cls='')=>`<section class="card ${cls}">${title?`<h2>${title}</h2>`:''}${body}</section>`;
const empty=(ic,t,sub,btn)=>`<div class="empty">${ico(ic,34)}<b>${t}</b>${sub?`<p>${sub}</p>`:''}${btn||''}</div>`;
const pill=(t,c='neutral')=>`<span class="pill ${c}">${t}</span>`;
const iconBtn=(a,i,l,x='')=>`<button type="button" class="ib" data-a="${a}" aria-label="${l}" title="${l}" ${x}>${ico(i,18)}</button>`;

/* Bestätigungsdialog */
function ask(title,msg,fn,ok='Ja, löschen',danger=true){S.dlg={title,msg,fn,ok,danger};renderDlg()}
function renderDlg(){const el=$('#dlg'),d=S.dlg;if(!d){el.innerHTML='';el.hidden=true;return}el.hidden=false;
  el.innerHTML=`<div class="box" role="alertdialog" aria-modal="true"><h3>${esc(d.title)}</h3><p>${esc(d.msg)}</p><div class="row nowrap"><button class="btn ghost" data-a="dno">Abbrechen</button><button class="btn ${d.danger?'danger':'primary'}" data-a="dyes">${esc(d.ok)}</button></div></div>`;
  const b=el.querySelector('[data-a=dno]');if(b)b.focus()}
A.dno=()=>{S.dlg=null;renderDlg();return false};
A.dyes=()=>{const d=S.dlg;S.dlg=null;renderDlg();if(d&&d.fn)d.fn();return false};
A.tclose=()=>{$('#toast').classList.remove('show');return false};

/* Zeit- und Behandlungs-Helfer (Heute und Tier-Akte) */
const durTxt=ms=>{const m=Math.max(0,Math.floor(ms/6e4)),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mi=m%60,u=LANG=='en'?['d','h','min']:['Tg.','Std.','Min.'];return d?`${d} ${u[0]} ${h} ${u[1]}`:h?`${h} ${u[1]} ${mi} ${u[2]}`:`${mi} ${u[2]}`};
const tickTxt=(k,ts)=>{if(k=='since')return durTxt(Date.now()-ts);const en=LANG=='en',tm=hm(ts);return ts<=Date.now()?(en?'overdue for ':'überfällig seit ')+durTxt(Date.now()-ts):(en?'in ':'in ')+durTxt(ts-Date.now())+' ('+tm+')'};
const trNext=t=>{if(!t.interval_hours)return null;const last=t.logs.length?t.logs[t.logs.length-1].timestamp:'',ref=last>t.start_timestamp?last:t.start_timestamp;return tms(ref)+t.interval_hours*36e5};
const byT=x=>MULTI&&x&&x.by?` · ${esc(x.by)}`:'';
const LOGT=[['Medikament','pill','Name & Dosis'],['Wundkontrolle','eye','z. B. trocken, leicht gerötet'],['Futteraufnahme','bowl','z. B. halbe Portion gefressen'],['Allgemeinbefinden','paw','z. B. munter, etwas müde'],['Sonstiges','edit','Beschreibung']];
