/* state.js – Daten (aus /api/bootstrap), Benutzer-Einstellungen, Funktions-Schalter */
const H=36e5,DC=['#f4b183','#a8d5ba','#b9a8e8','#f2a7c3','#9fcbe8','#e8d08a'];
let ME=null,PREFS={ui:{}},LANG='de',FT={},FT_DONE=true,MULTI=false,HD=false,WZ=null;
let VTYPES=[],CATS=[],CAT={food:[],snack:[],drink:[]},B0=[],B=[],V0=[],V=[],MG0=[],MG=[],FD0=[],FD=[],MEDS=[],VT=[],RL=[],DD='Wasser',HF={fields:[],birthdays:{}},HV=[],VAC=[],TR=[],VETS=[],PRF={};
const KL={food:'Futter',snack:'Snack',drink:'Getränk'};
const S={tab:'today',hist:'list',more:'',pet:null,pt:'profile',sh:null,dlg:null,
  fl:{cat:'all',kind:'all',n:60},an:{kind:'food',cat:'all'},hv:{f:null,r:180},
  vac:{t:'',nt:'',g:'',u:'',dur:'1y',plan:false,pd:''},nfld:{n:'',u:''},tf:null,tx:{},em:null,np:null,ck:'food',co:{},nv:{},pw:{cur:'',n1:'',n2:''},rp:null};

/* ---------- Hilfsfunktionen ---------- */
const ft=k=>FT[k]!==false;
const feedOn=()=>ft('food')||ft('snack')||ft('drink')||ft('meds'),incOn=()=>ft('vomit')||ft('stool')||ft('finding'),healthOn=()=>ft('medical')||ft('vaccination')||ft('values')||ft('treatment');
const NR=()=>RL.length||3,rc=v=>v>NR()*2/3?3:v>NR()/3?2:1;
const rl=s=>(RL.find(x=>x.score==s)||{label:String(s),emoji:''});
const rel=v=>{const t=VT.find(x=>x.key==v.type);return t?t.relevant:true};
const vtl=k=>(VT.find(x=>x.key==k)||{label:k,emoji:''});
const lk=v=>B.filter(b=>b.kind!='drink'&&b.ts<=v.ts&&v.ts-b.ts<=12*H&&(v.cat=='Unbekannt'||v.cat in b.cats));
const nowIso=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,16)};
const toLocal=ts=>new Date(ts-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);
const LOCALE=()=>((window.I18N&&I18N.locale&&I18N.locale[LANG])||'de-DE');
window.LOCALE=LOCALE;
const hm=t=>new Date(t).toLocaleTimeString(LOCALE(),{hour:'2-digit',minute:'2-digit'});
const fmt=t=>{const d=new Date(t),n=new Date(),dd=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);return(dd==0?'Heute':dd==1?'Gestern':d.toLocaleDateString(LOCALE(),{day:'2-digit',month:'2-digit'}))+', '+hm(t)};
const dFmt=x=>x?new Date(x+'T00:00').toLocaleDateString(LOCALE(),{day:'2-digit',month:'2-digit',year:'numeric'}):'–';
const nf=x=>Number(x).toLocaleString(LOCALE(),{maximumFractionDigits:2});
const ageText=b=>{if(!b)return'';const d=new Date(b+'T00:00'),n=new Date();let y=n.getFullYear()-d.getFullYear(),m=n.getMonth()-d.getMonth();if(n.getDate()<d.getDate())m--;if(m<0){y--;m+=12}if(y<0)return'';
  if(y>0)return y+(y==1?' Jahr':' Jahre')+(m?', '+m+(m==1?' Monat':' Monate'):'');if(m>0)return m+(m==1?' Monat':' Monate');const t=Math.max(0,Math.floor((n-d)/864e5));return t+(t==1?' Tag':' Tage')};
const catByName=n=>CATS.find(c=>c.name==n);
const ccol=c=>(c&&((PREFS.ui.cc||{})[c.id]))||(c?DC[c.i%6]:'#d9c7b8');
const ctext=x=>{const n=parseInt(x.slice(1),16),l=(.299*(n>>16)+.587*(n>>8&255)+.114*(n&255))/255;return l>.6?'#1d1a17':'#fff'};
const avStyle=c=>{const x=ccol(c);return`--cc:${x};--ct:${ctext(x)}`};
const spc=c=>c&&c.sp=='dog'?'dog':'cat';
const avi=(c,cls='')=>`<span class="av ${spc(c)} ${cls}" style="${avStyle(c)}">${esc((c?c.name:'?')[0])}</span>`;
const photoOn=c=>!!(PREFS.photoAv&&c&&c.photo);
const pav=(c,cls='')=>c&&c.photo?`<img class="av ${cls} ph" style="${avStyle(c)}" src="${esc(c.photo)}" alt="">`:avi(c,cls);
const av=(c,cls='')=>photoOn(c)?pav(c,cls):avi(c,cls);
const LIFE={indoor:'Hauskatze',occasional:'Hauskatze mit gelegentlichem Freigang',outdoor:'Freigänger'};
const selAll=()=>PREFS.autoAll===0||PREFS.autoAll===false?{}:Object.fromEntries(CATS.map(c=>[c.name,NR()]));
const activeTR=()=>TR.filter(t=>t.is_active);
const UNITS=['Tablette','Kapsel','mg','g','ml','Tropfen','Hub','Stück','IE','µg'];
const doseStr=(m,a)=>{a=String(a==null?'':a).trim();return a?a+(m&&m.unit?' '+m.unit:''):''};
const unitList=()=>`<datalist id="ulist">${UNITS.map(u=>`<option value="${u}">`).join('')}</datalist>`;
const DURS=[['6m','6 Monate'],['1y','1 Jahr'],['2y','2 Jahre'],['3y','3 Jahre'],['none','Läuft nie ab'],['custom','Eigenes Datum']];
const addDur=(g,dur)=>{const m={'6m':6,'1y':12,'2y':24,'3y':36}[dur];if(!m||!g)return null;const d=new Date(g+'T00:00');d.setMonth(d.getMonth()+m);return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const durUntil=(g,dur,u)=>dur=='none'?null:dur=='custom'?(u||null):addDur(g,dur);
const durPick=(p,g,u)=>{const o=getPath(p)||{},un=durUntil(g,o.dur,o.u);return`<div class="chips">${DURS.map(([k,l])=>chip('dur',k,o.dur==k,l,`data-p="${p}"`)).join('')}</div>${o.dur=='custom'?field('Gültig bis',`<input type="date" data-b="${p}.u" value="${esc(o.u||'')}">`):un?`<p class="muted fine">Gültig bis ${dFmt(un)}</p>`:o.dur=='none'?'<p class="muted fine">Kein Ablaufdatum – keine Ablauf-Erinnerung.</p>':''}`};
const tms=x=>new Date(x).getTime();

/* ---------- Einstellungen pro Benutzer ---------- */
let saveT;
const savePrefs=()=>{clearTimeout(saveT);saveT=setTimeout(()=>API('PUT','/api/prefs',PREFS).catch(()=>{}),500)};

/* ---------- Daten laden ---------- */
function applyHide(){
  if(!HD){B=B0;V=V0;MG=MG0;FD=FD0;return}
  const act=new Set(CATS.map(c=>c.name));
  B=B0.map(b=>({...b,cats:Object.fromEntries(Object.entries(b.cats).filter(([c])=>act.has(c)))})).filter(b=>Object.keys(b.cats).length);
  V=V0.filter(v=>v.cat=='Unbekannt'||act.has(v.cat));
  MG=MG0.filter(m=>m.cats.some(n=>act.has(n)));
  FD=FD0.filter(f=>f.cat=='Unbekannt'||act.has(f.cat));
}
async function load(){
  const d=await API('GET','/api/bootstrap');
  PRF={};(d.profiles||[]).forEach(p=>{PRF[p.id]=p});
  CATS=d.animals.map((a,i)=>({id:a.id,name:a.name,sp:a.species||'cat',i,photo:(PRF[a.id]||{}).photo||'',life:(PRF[a.id]||{}).lifestyle||''}));
  VTYPES=d.vaccine_types||[];
  const mp=l=>l.map(m=>({id:m.id,name:m.name,foods:m.foods}));
  CAT={food:mp(d.food),snack:mp(d.snack),drink:mp(d.drink)};
  const gm={};
  d.feedings.forEach(f=>{const k=f.batch_id||'s'+f.id;(gm[k]=gm[k]||{id:f.batch_id||f.id,ts:new Date(f.timestamp).getTime(),kind:f.kind||'food',mid:f.manufacturer_id,fid:f.food_id,man:f.manufacturer_name,food:f.food_name,cats:{},note:f.notes||'',by:f.created_by_name||''}).cats[f.cat_name]=f.rating});
  B0=Object.values(gm);
  V0=d.vomits.map(x=>({id:x.id,ts:new Date(x.timestamp).getTime(),cat:x.cat_name,type:x.vomit_type||'food',note:x.notes||'',by:x.created_by_name||'',img:x.image_path}));
  RL=[...d.rating_levels].sort((a,b)=>b.score-a.score);
  VT=d.vomit_types.map(x=>({key:x.key,label:x.label,emoji:x.emoji||'',relevant:!!x.relevant,hidden:!!x.hidden}));
  DD=(d.default_drink||{}).name||'Wasser';
  MEDS=d.meds.map(x=>({id:x.id,name:x.name,dose:x.dose||'',unit:x.unit||''}));
  const g2={};
  d.med_logs.forEach(x=>{(g2[x.batch_id]=g2[x.batch_id]||{id:x.batch_id,ts:new Date(x.timestamp).getTime(),med:x.med_name,dose:x.dose||'',wf:!!x.with_food,note:x.notes||'',by:x.created_by_name||'',cats:[]}).cats.push(x.cat_name)});
  MG0=Object.values(g2);
  FD0=d.findings.map(x=>({id:x.id,cat:x.cat_name,kind:x.kind,bristol:x.bristol,flags:x.details||[],loc:x.location||'',ts:new Date(x.timestamp).getTime(),note:x.notes||'',by:x.created_by_name||'',imgs:x.images||[]}));
  const fx=d.features||{};FT=fx.features||{};FT_DONE=!!fx.setup_done;MULTI=(fx.users||1)>1;
  HF=d.health_overview||{fields:[],birthdays:{}};HV=d.health_values||[];VAC=d.vaccinations||[];TR=d.treatments||[];VETS=d.vets||[];
  applyHide();
  if(typeof maybeWizard=='function')maybeWizard();
}
