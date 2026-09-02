(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

  const menuBtn=$('.menu-btn');
  const nav=$('.nav');
  const closeMenu=()=>{if(!menuBtn||!nav)return;nav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')};
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(open))});
    nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menuBtn.contains(e.target))closeMenu()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  }

  const cards=$$('.property-card[data-search]');
  const empty=$('.empty-state');
  const count=$('.count-number');
  const input=$('[data-property-search]');
  let active='all';
  const normalize=(v='')=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const updateUrl=()=>{
    if(!cards.length)return;
    const url=new URL(location.href); const q=input?input.value.trim():'';
    q?url.searchParams.set('q',q):url.searchParams.delete('q');
    active!=='all'?url.searchParams.set('f',active):url.searchParams.delete('f');
    history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams:'')+url.hash);
  };
  const applyFilters=(sync=false)=>{
    if(!cards.length)return;
    const q=normalize(input?input.value:''); let shown=0;
    cards.forEach(card=>{
      const tags=normalize(card.dataset.tags||''); const text=normalize(card.dataset.search||'');
      const okTag=active==='all'||tags.includes(normalize(active)); const okQ=!q||text.includes(q)||tags.includes(q);
      const visible=okTag&&okQ; card.hidden=!visible; if(visible)shown++;
    });
    if(empty)empty.hidden=shown>0;
    if(count)count.textContent=shown;
    if(sync)updateUrl();
  };
  if(cards.length){
    const params=new URLSearchParams(location.search);
    if(input&&params.has('q'))input.value=params.get('q')||'';
    if(params.has('f')){
      const requested=params.get('f'); const chip=$$('.filter-chip[data-filter]').find(x=>x.dataset.filter===requested);
      if(chip){active=requested;$$('.filter-chip').forEach(x=>x.classList.toggle('active',x===chip))}
    }
    applyFilters(false);
    $$('.filter-chip[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      active=btn.dataset.filter||'all'; $$('.filter-chip[data-filter]').forEach(x=>x.classList.toggle('active',x===btn)); applyFilters(true);
    }));
    if(input)input.addEventListener('input',()=>applyFilters(true));
  }

  $$('.property-card a[href]').forEach(link=>link.addEventListener('click',()=>{
    try{sessionStorage.setItem('sgPropertyReturn',location.pathname+location.search+location.hash)}catch(_){}
  }));
  const backButton=$('[data-back-button]');
  if(backButton)backButton.addEventListener('click',()=>{
    let returnUrl=''; try{returnUrl=sessionStorage.getItem('sgPropertyReturn')||''}catch(_){}
    if(returnUrl&&returnUrl!==(location.pathname+location.search+location.hash)){location.href=returnUrl;return}
    try{if(document.referrer){const ref=new URL(document.referrer);if(ref.origin===location.origin){history.back();return}}}catch(_){}
    const marker='/propiedades/'; const markerIndex=location.pathname.indexOf(marker);
    const basePath=markerIndex>=0?location.pathname.slice(0,markerIndex):'';
    location.href=basePath+marker;
  });

  const rotator=$('[data-about-rotator]');
  if(rotator){
    const source=$('#catalog-rotator-images'); let options=[];
    try{
      const parsed=JSON.parse(source?.textContent||'[]');
      if(Array.isArray(parsed))options=parsed.filter(item=>item&&typeof item.src==='string'&&item.src.trim());
    }catch(_){}
    if(!options.length){
      rotator.hidden=true; rotator.removeAttribute('src'); rotator.alt='';
    }else{
      let previous=-1; try{previous=Number(sessionStorage.getItem('sgAboutImage')??-1)}catch(_){}
      let index=Math.floor(Math.random()*options.length);
      if(options.length>1&&index===previous)index=(index+1+Math.floor(Math.random()*(options.length-1)))%options.length;
      rotator.hidden=false; rotator.src=options[index].src; rotator.alt=options[index].alt||'Propiedad disponible';
      try{sessionStorage.setItem('sgAboutImage',String(index))}catch(_){}
    }
  }

  const lightbox=$('.lightbox');
  const lbImg=lightbox?$('img',lightbox):null;
  const lbItems=$$('[data-lightbox]');
  let lbIndex=0;
  const showLb=i=>{
    if(!lightbox||!lbImg||!lbItems.length)return;
    lbIndex=(i+lbItems.length)%lbItems.length;
    lbImg.src=lbItems[lbIndex].dataset.full||lbItems[lbIndex].src;
    lbImg.alt=lbItems[lbIndex].alt||'Imagen ampliada';
    lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden','false'); document.body.classList.add('no-scroll');
  };
  const closeLb=()=>{if(!lightbox)return;lightbox.classList.remove('open');lightbox.setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')};
  lbItems.forEach((img,i)=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',`Ampliar imagen ${i+1}`);img.addEventListener('click',()=>showLb(i));img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLb(i)}})});
  if(lightbox){
    $('.lightbox-close',lightbox)?.addEventListener('click',closeLb);
    $('.lightbox-prev',lightbox)?.addEventListener('click',()=>showLb(lbIndex-1));
    $('.lightbox-next',lightbox)?.addEventListener('click',()=>showLb(lbIndex+1));
    lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLb()});
    document.addEventListener('keydown',e=>{if(!lightbox.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')showLb(lbIndex-1);if(e.key==='ArrowRight')showLb(lbIndex+1)});
  }
})();
