
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const menuBtn=$('.menu-btn'), nav=$('.nav');
if(menuBtn&&nav) menuBtn.addEventListener('click',()=>nav.classList.toggle('open'));
const cards=$$('.property-card[data-search]'), empty=$('.empty-state'), count=$('.count-number');
let active='all';
function normalize(v=''){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function applyFilters(){
  const input=$('[data-property-search]'); const q=normalize(input?input.value:''); let shown=0;
  cards.forEach(card=>{
    const tags=normalize(card.dataset.tags||''); const text=normalize(card.dataset.search||'');
    const okTag=active==='all'||tags.includes(normalize(active)); const okQ=!q||text.includes(q)||tags.includes(q);
    const show=okTag&&okQ; card.style.display=show?'':'none'; if(show)shown++;
  });
  if(empty) empty.style.display=shown?'none':'block'; if(count) count.textContent=shown;
}
$$('.filter-chip[data-filter]').forEach(b=>b.addEventListener('click',()=>{$$('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');active=b.dataset.filter;applyFilters()}));
$$('[data-property-search]').forEach(i=>i.addEventListener('input',applyFilters));
$$('[data-hero-search]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const v=form.querySelector('input').value.trim();location.href='propiedades.html?q='+encodeURIComponent(v)}));
const params=new URLSearchParams(location.search); if(params.has('q')){const input=$('[data-property-search]');if(input){input.value=params.get('q');applyFilters()}}
$$('[data-lightbox]').forEach(img=>img.addEventListener('click',()=>{const lb=$('.lightbox');if(!lb)return;lb.querySelector('img').src=img.dataset.full||img.src;lb.classList.add('open')}));
const lb=$('.lightbox'); if(lb){lb.addEventListener('click',e=>{if(e.target===lb||e.target.tagName==='BUTTON')lb.classList.remove('open')})}
