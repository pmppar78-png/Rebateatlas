
(async()=>{
  try{
    const res = await fetch('/config/config.json',{cache:'no-store'}); if(!res.ok) return;
    const cfg = await res.json();
    function addScript(src,attrs={}){const s=document.createElement('script');s.src=src;Object.entries(attrs).forEach(([k,v])=>s.setAttribute(k,v));document.head.appendChild(s);}
    const consent = localStorage.getItem('ra_consent')==='1';
    if(consent && cfg.features.adsense_enabled && cfg.ids.adsense_client){
      addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.ids.adsense_client}`,{async:'',crossorigin:'anonymous'});
    }
  }catch(e){}
})();
