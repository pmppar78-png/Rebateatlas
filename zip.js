
async function fetchZipData(zip){
  try { const r=await fetch(`/${zip}.json`,{cache:'no-store'}); if(r.ok) return await r.json(); } catch {}
  const r2=await fetch(`/api/zip?code=${encodeURIComponent(zip)}`,{cache:'no-store'});
  if(r2.ok) return await r2.json();
  return null;
}
function chip(name,key){ const el=document.createElement('div'); el.className='chip'; el.textContent=name; el.dataset.key=key; return el; }
function makeCard(it){ const el=document.createElement('article'); el.className='card';
  const amount=it.amount_pretty?`<span class="amount">${it.amount_pretty}</span>`:''; const cap=it.cap_pretty?` • cap ${it.cap_pretty}`:'';
  el.innerHTML = `<h3>${it.title}</h3><div class="meta">${amount} ${cap}</div><p>${it.summary||''}</p>
  <div class="meta">${it.deadline?`<span class="badge">Deadline: ${it.deadline}</span>`:''} ${it.program?`<span class="badge">${it.program}</span>`:''}</div>
  <div class="actions">
    ${it.product_url?`<a href="${it.product_url}" rel="sponsored nofollow" target="_blank">View Eligible Products</a>`:''}
    ${it.quote_url?`<a href="${it.quote_url}" rel="sponsored nofollow" target="_blank">Get 3 Quotes</a>`:''}
    ${it.source_url?`<a href="${it.source_url}" target="_blank">Source</a>`:''}
  </div>`; return el; }
document.addEventListener('DOMContentLoaded', async ()=>{
  const params=new URLSearchParams(location.search); let zip=params.get('code')||'';
  const input=document.getElementById('zip'); const title=document.getElementById('title'); const subtitle=document.getElementById('subtitle');
  const chips=document.getElementById('chips'); const cards=document.getElementById('cards');
  const deltaSection=document.getElementById('delta-section'); const deltas=document.getElementById('deltas');
  const form=document.getElementById('zip-form');
  if(!zip){ const parts=location.pathname.split('/').filter(Boolean); zip=parts[1]||''; }
  input.value = zip || '';
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const z=input.value.trim(); if(/^\d{5}$/.test(z)) location.href='/zip/'+z; else alert('Enter valid ZIP'); });
  if(!/^\d{5}$/.test(zip)){ subtitle.textContent='Enter a valid 5-digit ZIP to see results.'; return; }
  title.textContent = `Rebates for ${zip}`;
  const data = await fetchZipData(zip);
  if(!data){ subtitle.textContent='No data yet for this ZIP. Check back soon.'; return; }
  subtitle.textContent = `${data.city||''}${data.city?', ':''}${data.state||''} • Programs: ${data.items?.length || 0}`;
  const categories = [...new Set((data.items||[]).map(i=>i.category).filter(Boolean))];
  categories.forEach(c=>chips.appendChild(chip(c,c)));
  let current = data.items || []; const render=list=>{ cards.innerHTML=''; list.forEach(x=>cards.appendChild(makeCard(x))); };
  render(current);
  chips.addEventListener('click', e=>{ const k=e.target.dataset?.key; if(!k) return; render(current.filter(i=>i.category===k)); });
  if(data.deltas?.length){ deltaSection.hidden=false; (data.deltas||[]).forEach(d=>{ const li=document.createElement('li'); li.textContent=d; deltas.appendChild(li); }); }
  const ld = {"@context":"https://schema.org","@type":"ItemList","name":`Rebates for ${zip}`,"itemListElement":(data.items||[]).slice(0,20).map((it,idx)=>({"@type":"Offer","position":idx+1,"name":it.title,"priceCurrency":"USD","url":it.source_url||location.href,"category":it.category,"description":it.summary||""}))};
  const s=document.createElement('script'); s.type='application/ld+json'; s.textContent=JSON.stringify(ld); document.head.appendChild(s);
});
