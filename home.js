
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('year').textContent = new Date().getFullYear();
  const form=document.getElementById('zip-form');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const zip = document.getElementById('zip').value.trim();
    if (/^\d{5}$/.test(zip)) location.href = '/zip/'+zip;
    else alert('Please enter a valid 5-digit ZIP code.');
  });
});
