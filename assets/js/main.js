const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const menuBtn=$('.menu-btn'), nav=$('.nav');
if(menuBtn&&nav) menuBtn.addEventListener('click',()=>nav.classList.toggle('open'));

const cards=$$('.property-card[data-search]'), empty=$('.empty-state'), count=$('.count-number');
let active='all';
function normalize(v=''){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function updateCatalogUrl(){
  if(!cards.length)return;
  const url=new URL(location.href);
  const input=$('[data-property-search]');
  const q=input?input.value.trim():'';
  if(q)url.searchParams.set('q',q);else url.searchParams.delete('q');
  if(active&&active!=='all')url.searchParams.set('f',active);else url.searchParams.delete('f');
  history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():'')+url.hash);
}
function applyFilters({syncUrl=false}={}){
  const input=$('[data-property-search]'); const q=normalize(input?input.value:''); let shown=0;
  cards.forEach(card=>{
    const tags=normalize(card.dataset.tags||''); const text=normalize(card.dataset.search||'');
    const okTag=active==='all'||tags.includes(normalize(active)); const okQ=!q||text.includes(q)||tags.includes(q);
    const show=okTag&&okQ; card.style.display=show?'':'none'; if(show)shown++;
  });
  if(empty) empty.style.display=shown?'none':'block'; if(count) count.textContent=shown;
  if(syncUrl)updateCatalogUrl();
}

const params=new URLSearchParams(location.search);
if(params.has('q')){const input=$('[data-property-search]');if(input)input.value=params.get('q')}
if(params.has('f')){
  const requested=params.get('f');
  const chip=$$('.filter-chip[data-filter]').find(x=>x.dataset.filter===requested);
  if(chip){active=requested;$$('.filter-chip').forEach(x=>x.classList.remove('active'));chip.classList.add('active')}
}
if(cards.length)applyFilters();

$$('.filter-chip[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  $$('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');active=b.dataset.filter;applyFilters({syncUrl:true});
}));
$$('[data-property-search]').forEach(i=>i.addEventListener('input',()=>applyFilters({syncUrl:true})));
$$('[data-hero-search]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const v=form.querySelector('input').value.trim();location.href='propiedades.html?q='+encodeURIComponent(v)}));

// Guarda la página y los filtros exactos desde los que se abrió una propiedad.
$$('a[href^="propiedad-"]').forEach(link=>link.addEventListener('click',()=>{
  try{sessionStorage.setItem('sgPropertyReturn',location.pathname+location.search+location.hash)}catch(e){}
}));

const backButton=$('[data-back-button]');
if(backButton)backButton.addEventListener('click',()=>{
  let returnUrl='';
  try{returnUrl=sessionStorage.getItem('sgPropertyReturn')||''}catch(e){}
  if(returnUrl && returnUrl!==(location.pathname+location.search+location.hash)){
    location.href=returnUrl;return;
  }
  try{
    if(document.referrer){const ref=new URL(document.referrer);if(ref.origin===location.origin){history.back();return}}
  }catch(e){}
  location.href='propiedades.html';
});

$$('[data-lightbox]').forEach(img=>img.addEventListener('click',()=>{const lb=$('.lightbox');if(!lb)return;lb.querySelector('img').src=img.dataset.full||img.src;lb.classList.add('open')}));
const lb=$('.lightbox'); if(lb){lb.addEventListener('click',e=>{if(e.target===lb||e.target.tagName==='BUTTON')lb.classList.remove('open')})}
