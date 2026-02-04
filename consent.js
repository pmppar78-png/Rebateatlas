
(function(){
  if(localStorage.getItem('ra_consent')==='1') return;
  const b=document.createElement('div'); b.style.position='fixed'; b.style.bottom='12px'; b.style.left='50%'; b.style.transform='translateX(-50%)';
  b.style.background='#0e1a30'; b.style.color='#e6f0ff'; b.style.padding='12px 16px'; b.style.borderRadius='12px'; b.style.boxShadow='0 10px 30px rgba(0,0,0,.35)';
  b.innerHTML='We use cookies for analytics and sponsored links. ';
  const ok=document.createElement('button'); ok.textContent='OK'; ok.style.marginLeft='8px';
  const no=document.createElement('button'); no.textContent='No thanks'; no.style.marginLeft='8px';
  b.appendChild(ok); b.appendChild(no); document.body.appendChild(b);
  ok.onclick=()=>{localStorage.setItem('ra_consent','1'); b.remove();};
  no.onclick=()=>{localStorage.setItem('ra_consent','0'); b.remove();};
})();
