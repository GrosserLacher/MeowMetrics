/* api.js – Hilfsfunktionen und REST-Aufrufe (nutzt ausschließlich die bestehenden Endpunkte) */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastT;
function toast(m){const t=$('#toast');t.innerHTML=`<span>${esc(m)}</span><button class="tx" data-a="tclose" aria-label="Schließen">${ico('x',14)}</button>`;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),4500)}
async function API(m,u,b,f){const o={method:m,credentials:'same-origin',headers:{}};
  if(f)o.body=f;else if(b!==undefined){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b)}
  const r=await fetch(u,o);
  if(r.status==401&&u!='/api/login'){showLogin(false);throw new Error('401')}
  if(!r.ok){let d='Fehler '+r.status;try{const j=await r.json();d=typeof j.detail=='string'?j.detail:d}catch(e){}toast(d);throw new Error(d)}
  return r.json()}
