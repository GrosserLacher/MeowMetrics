const mapSignal=o=>{const {signal,...rest}=o||{};if(signal){const ac=new AbortController();signal.addEventListener('abort',()=>ac.abort());rest.signal=ac.signal}return rest};
const {JSDOM,VirtualConsole}=require('jsdom');
const BASE='http://127.0.0.1:8123';let cookie='';
(async()=>{
  const r=await fetch(BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'geheim1234'})});
  cookie=r.headers.get('set-cookie').split(';')[0];
  for(const ua of ['Mozilla/5.0 jsdom','Mozilla/5.0 jsdom MeowMetricsApp']){
    const dom=await JSDOM.fromURL(BASE+'/',{userAgent:ua,runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:new VirtualConsole(),beforeParse(w){
      w.matchMedia=q=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){}});w.scrollTo=()=>{};Object.defineProperty(w.navigator,'userAgent',{value:ua});Object.defineProperty(w.navigator,'language',{value:'de-DE'});
      w.fetch=(u,o={})=>fetch(new URL(u,BASE).href,{...mapSignal(o),headers:{...(o.headers||{}),Cookie:cookie}});}});
    const w=dom.window,$=s=>w.document.querySelector(s),wait=ms=>new Promise(r=>setTimeout(r,ms));
    await wait(1500);$('#nav [data-v="more"]').click();await wait(80);
    $('#app [data-v="look"]').click();await wait(100);
    const t=$('#app').textContent;
    console.log(ua.includes('App')?'App   ':'Browser','| pwa-Klasse:',w.document.documentElement.classList.contains('pwa'),'| Karte "Navigation":',[...w.document.querySelectorAll('#app h2')].some(h=>h.textContent.trim()=='Navigation'),'| Farbthemen:',t.includes('Farbthemen'));
    $('#app [data-a="mback"]').click();await wait(50);$('#app [data-v="account"]').click();await wait(200);
    console.log('        Konto: "Server wechseln":',$('#app').textContent.includes('Server wechseln'));
    w.close();}
  process.exit(0)})();
