/* views/crop.js – Foto zuschneiden (frei wählbarer Ausschnitt, Zoom per Pinch/Mausrad, Verschieben) und Zoom in der Vollbildansicht.
   Ohne Bibliothek. Die Rechenfunktionen (cropClamp, cropSource, cropResize) sind reine Funktionen. */
const CROP_MAX=2048,CROP_MIN=56;
let CROPCANCEL=null;
/* Bild (Größe iw x ih, Maßstab s, Versatz tx/ty) muss den Rahmen r immer ganz abdecken */
const cropClamp=(iw,ih,g,r)=>{const s=Math.max(g.s,r.w/iw,r.h/ih);return{s,tx:Math.min(r.x,Math.max(r.x+r.w-iw*s,g.tx)),ty:Math.min(r.y,Math.max(r.y+r.h-ih*s,g.ty))}};
/* Ausschnitt in Bildpunkten */
const cropSource=(g,r)=>({sx:(r.x-g.tx)/g.s,sy:(r.y-g.ty)/g.s,sw:r.w/g.s,sh:r.h/g.s});
/* Rahmen an einem Griff (n, s, e, w, ne, nw, se, sw) um dx/dy ziehen, innerhalb der Fläche B */
function cropResize(r0,hd,dx,dy,B){let l=r0.x,t=r0.y,rt=r0.x+r0.w,b=r0.y+r0.h;
  if(hd.includes('w'))l=Math.min(Math.max(l+dx,B.x),rt-CROP_MIN);
  if(hd.includes('e'))rt=Math.max(Math.min(rt+dx,B.x+B.w),l+CROP_MIN);
  if(hd.includes('n'))t=Math.min(Math.max(t+dy,B.y),b-CROP_MIN);
  if(hd.includes('s'))b=Math.max(Math.min(b+dy,B.y+B.h),t+CROP_MIN);
  return{x:l,y:t,w:rt-l,h:b-t}}

/* Liefert: zugeschnittene Datei, die Originaldatei ("Ohne Zuschneiden" oder nicht lesbar) oder null (abgebrochen) */
function cropPhoto(file,label){return new Promise(res=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onerror=()=>{URL.revokeObjectURL(url);res(file)};
  img.onload=()=>{
    const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih){URL.revokeObjectURL(url);res(file);return}
    const box=document.createElement('div');box.id='crop';
    box.innerHTML=`<div class="cbar">${label||'Foto zuschneiden'}</div><div class="cstage"><img class="cimg" alt="" draggable="false"><div class="crect">${['nw','n','ne','e','se','s','sw','w'].map(h=>`<i class="ch ${h}" data-h="${h}"></i>`).join('')}</div></div><div class="cbtns"><button type="button" class="btn ghost" data-c="no">Abbrechen</button><button type="button" class="btn ghost" data-c="raw">Ohne Zuschneiden</button><button type="button" class="btn primary" data-c="ok">Übernehmen</button></div>`;
    document.body.appendChild(box);document.body.classList.add('lock');
    const stage=box.querySelector('.cstage'),im=box.querySelector('.cimg'),re=box.querySelector('.crect');
    im.src=url;im.style.width=iw+'px';im.style.height=ih+'px';
    const W=stage.clientWidth,H=stage.clientHeight,B={x:0,y:0,w:W,h:H},fit=Math.min(W/iw,H/ih);
    let g={s:fit,tx:(W-iw*fit)/2,ty:(H-ih*fit)/2},r={x:g.tx,y:g.ty,w:iw*fit,h:ih*fit};
    const maxS=Math.max(fit*10,4);
    const paint=()=>{im.style.transform=`translate(${g.tx}px,${g.ty}px) scale(${g.s})`;re.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`};
    const fix=()=>{g=cropClamp(iw,ih,g,r)};
    const zoomAt=(px,py,k)=>{const c={x:(px-g.tx)/g.s,y:(py-g.ty)/g.s},s2=Math.min(maxS,g.s*k);g={s:s2,tx:px-c.x*s2,ty:py-c.y*s2};fix()};
    const pt=e=>{const b=stage.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}};
    const P=new Map();let drag=null;
    stage.addEventListener('pointerdown',e=>{const hd=e.target.dataset&&e.target.dataset.h;stage.setPointerCapture(e.pointerId);
      if(hd&&!P.size&&!drag){drag={id:e.pointerId,hd,r0:{...r},p0:pt(e)}}else P.set(e.pointerId,pt(e))});
    stage.addEventListener('pointermove',e=>{
      if(drag&&e.pointerId==drag.id){const p=pt(e);r=cropResize(drag.r0,drag.hd,p.x-drag.p0.x,p.y-drag.p0.y,B);fix();paint();return}
      if(!P.has(e.pointerId))return;const prev=new Map(P),p=pt(e);P.set(e.pointerId,p);
      if(P.size==1){const o=prev.get(e.pointerId);g={...g,tx:g.tx+p.x-o.x,ty:g.ty+p.y-o.y};fix()}
      else if(P.size==2){const ids=[...P.keys()],a0=prev.get(ids[0]),b0=prev.get(ids[1]),a1=P.get(ids[0]),b1=P.get(ids[1]),
        d0=Math.hypot(a0.x-b0.x,a0.y-b0.y)||1,d1=Math.hypot(a1.x-b1.x,a1.y-b1.y),m0={x:(a0.x+b0.x)/2,y:(a0.y+b0.y)/2},m1={x:(a1.x+b1.x)/2,y:(a1.y+b1.y)/2};
        const c={x:(m0.x-g.tx)/g.s,y:(m0.y-g.ty)/g.s},s2=Math.min(maxS,g.s*d1/d0);g={s:s2,tx:m1.x-c.x*s2,ty:m1.y-c.y*s2};fix()}
      paint()});
    const up=e=>{P.delete(e.pointerId);if(drag&&e.pointerId==drag.id)drag=null};
    stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
    stage.addEventListener('wheel',e=>{e.preventDefault();const p=pt(e);zoomAt(p.x,p.y,e.deltaY<0?1.12:1/1.12);paint()},{passive:false});
    const done=v=>{CROPCANCEL=null;document.removeEventListener('keydown',onKey,true);box.remove();document.body.classList.remove('lock');URL.revokeObjectURL(url);res(v)};
    const onKey=e=>{if(e.key=='Escape'){e.stopPropagation();done(null)}};
    document.addEventListener('keydown',onKey,true);
    CROPCANCEL=()=>done(null);
    box.addEventListener('click',e=>{const c=e.target.closest('[data-c]');if(!c)return;
      if(c.dataset.c=='no')return done(null);
      if(c.dataset.c=='raw')return done(file);
      const q=cropSource(g,r),k=Math.min(1,CROP_MAX/Math.max(q.sw,q.sh)),cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(q.sw*k));cv.height=Math.max(1,Math.round(q.sh*k));
      cv.getContext('2d').drawImage(img,Math.max(0,q.sx),Math.max(0,q.sy),Math.min(iw,q.sw),Math.min(ih,q.sh),0,0,cv.width,cv.height);
      cv.toBlob(b=>done(b?new File([b],'foto_'+Date.now()+'.jpg',{type:'image/jpeg'}):file),'image/jpeg',.9)});
    paint()};
  img.src=url})}

/* Vollbildansicht: Zoom per Pinch/Mausrad, Verschieben, Doppeltipp */
let LBZ={k:'',s:1,tx:0,ty:0};
function lbBind(el,l){const img=el.querySelector('img');if(!img)return;
  const key=l.list[l.i];if(LBZ.k!==key)LBZ={k:key,s:1,tx:0,ty:0};
  const lim=()=>({x:Math.max(0,(img.clientWidth*LBZ.s-innerWidth)/2),y:Math.max(0,(img.clientHeight*LBZ.s-innerHeight)/2)});
  const apply=()=>{if(LBZ.s<=1.001){LBZ.s=1;LBZ.tx=0;LBZ.ty=0}const m=lim();LBZ.tx=Math.max(-m.x,Math.min(m.x,LBZ.tx));LBZ.ty=Math.max(-m.y,Math.min(m.y,LBZ.ty));img.style.transform=`translate(${LBZ.tx}px,${LBZ.ty}px) scale(${LBZ.s})`};
  const ctr=e=>({x:e.clientX-innerWidth/2,y:e.clientY-innerHeight/2});
  const zoom=(c,k)=>{const s2=Math.max(1,Math.min(8,LBZ.s*k)),f=s2/LBZ.s;LBZ.tx=c.x-(c.x-LBZ.tx)*f;LBZ.ty=c.y-(c.y-LBZ.ty)*f;LBZ.s=s2};
  const P=new Map();let last=0;apply();
  img.addEventListener('pointerdown',e=>{img.setPointerCapture(e.pointerId);P.set(e.pointerId,ctr(e));
    const now=Date.now();if(P.size==1&&now-last<300){zoom(ctr(e),LBZ.s>1.5?1/LBZ.s:2.5);apply()}last=now});
  img.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;const prev=new Map(P),p=ctr(e);P.set(e.pointerId,p);
    if(P.size==1){const o=prev.get(e.pointerId);if(LBZ.s>1){LBZ.tx+=p.x-o.x;LBZ.ty+=p.y-o.y}}
    else if(P.size==2){const ids=[...P.keys()],a0=prev.get(ids[0]),b0=prev.get(ids[1]),a1=P.get(ids[0]),b1=P.get(ids[1]),
      d0=Math.hypot(a0.x-b0.x,a0.y-b0.y)||1,d1=Math.hypot(a1.x-b1.x,a1.y-b1.y),m0={x:(a0.x+b0.x)/2,y:(a0.y+b0.y)/2},m1={x:(a1.x+b1.x)/2,y:(a1.y+b1.y)/2};
      LBZ.tx+=m1.x-m0.x;LBZ.ty+=m1.y-m0.y;zoom(m1,d1/d0)}
    apply()});
  const up=e=>{P.delete(e.pointerId)};img.addEventListener('pointerup',up);img.addEventListener('pointercancel',up);
  img.addEventListener('wheel',e=>{e.preventDefault();zoom(ctr(e),e.deltaY<0?1.15:1/1.15);apply()},{passive:false})}
