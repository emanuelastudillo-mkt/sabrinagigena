(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

  const menuBtn=$('.menu-btn');
  const nav=$('.nav');
  const closeMenu=()=>{
    if(!menuBtn||!nav)return;
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
    menuBtn.setAttribute('aria-label','Abrir menú');
  };
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded',String(open));
      menuBtn.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
    });
    nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menuBtn.contains(e.target))closeMenu()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
    window.addEventListener('resize',()=>{if(window.innerWidth>720)closeMenu()},{passive:true});
  }

  const cards=$$('.property-card[data-search]');
  const empty=$('.empty-state');
  const count=$('.count-number');
  const input=$('[data-property-search]');
  const chips=$$('.filter-chip[data-filter]');
  let active='all';
  const normalize=(v='')=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const setChipState=()=>chips.forEach(chip=>chip.setAttribute('aria-pressed',String((chip.dataset.filter||'all')===active)));
  const updateUrl=()=>{
    if(!cards.length)return;
    const url=new URL(location.href); const q=input?input.value.trim():'';
    q?url.searchParams.set('q',q):url.searchParams.delete('q');
    active!=='all'?url.searchParams.set('f',active):url.searchParams.delete('f');
    history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():'')+url.hash);
  };
  const applyFilters=(sync=false)=>{
    if(!cards.length)return;
    const q=normalize(input?input.value:''); let shown=0;
    cards.forEach(card=>{
      const tags=normalize(card.dataset.tags||''); const text=normalize(card.dataset.search||'');
      const visible=(active==='all'||tags.includes(normalize(active)))&&(!q||text.includes(q)||tags.includes(q));
      card.hidden=!visible; if(visible)shown++;
    });
    if(empty)empty.hidden=shown>0;
    if(count)count.textContent=shown;
    setChipState();
    if(sync)updateUrl();
  };
  if(cards.length){
    const params=new URLSearchParams(location.search);
    if(input&&params.has('q'))input.value=params.get('q')||'';
    if(params.has('f')){
      const requested=params.get('f');
      if(chips.some(x=>x.dataset.filter===requested))active=requested;
    }
    chips.forEach(chip=>chip.classList.toggle('active',(chip.dataset.filter||'all')===active));
    applyFilters(false);
    chips.forEach(btn=>btn.addEventListener('click',()=>{
      active=btn.dataset.filter||'all';
      chips.forEach(x=>x.classList.toggle('active',x===btn));
      applyFilters(true);
    }));
    if(input)input.addEventListener('input',()=>applyFilters(true));
  }

  $$('a[href^="propiedad-"]').forEach(link=>link.addEventListener('click',()=>{
    try{sessionStorage.setItem('sgPropertyReturn',location.pathname+location.search+location.hash)}catch(_){}
  }));
  const backButton=$('[data-back-button]');
  if(backButton)backButton.addEventListener('click',()=>{
    let returnUrl=''; try{returnUrl=sessionStorage.getItem('sgPropertyReturn')||''}catch(_){}
    if(returnUrl&&returnUrl!==(location.pathname+location.search+location.hash)){location.href=returnUrl;return}
    try{if(document.referrer){const ref=new URL(document.referrer);if(ref.origin===location.origin){history.back();return}}}catch(_){}
    location.href='propiedades.html';
  });

  const rotator=$('[data-about-rotator]');
  if(rotator){
    const options=[
      ['assets/images/about-1.webp','Entorno residencial y jardín'],
      ['assets/images/about-2.webp','Jardín residencial al atardecer'],
      ['assets/images/about-3.webp','Interior cálido de vivienda'],
      ['assets/images/about-4.webp','Propiedad con jardín y pileta'],
      ['assets/images/about-5.webp','Vista general de propiedad']
    ];
    let previous=-1; try{previous=Number(sessionStorage.getItem('sgAboutImage')??-1)}catch(_){}
    let index=Math.floor(Math.random()*options.length);
    if(options.length>1&&index===previous)index=(index+1+Math.floor(Math.random()*(options.length-1)))%options.length;
    rotator.src=options[index][0]; rotator.alt=options[index][1];
    try{sessionStorage.setItem('sgAboutImage',String(index))}catch(_){}
  }

  const lightbox=$('.lightbox');
  const lbImg=lightbox?$('img',lightbox):null;
  const lbItems=$$('[data-lightbox]');
  let lbIndex=0, lastFocus=null, touchStartX=null;
  const showLb=i=>{
    if(!lightbox||!lbImg||!lbItems.length)return;
    lbIndex=(i+lbItems.length)%lbItems.length;
    lbImg.src=lbItems[lbIndex].dataset.full||lbItems[lbIndex].src;
    lbImg.alt=lbItems[lbIndex].alt||'Imagen ampliada';
    lastFocus=document.activeElement;
    lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden','false'); document.body.classList.add('no-scroll');
    $('.lightbox-close',lightbox)?.focus({preventScroll:true});
  };
  const closeLb=()=>{
    if(!lightbox)return;
    lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true'); document.body.classList.remove('no-scroll');
    if(lastFocus instanceof HTMLElement)lastFocus.focus({preventScroll:true});
  };
  lbItems.forEach((img,i)=>{
    img.tabIndex=0; img.setAttribute('role','button'); img.setAttribute('aria-label',`Ampliar imagen ${i+1}`);
    img.addEventListener('click',()=>showLb(i));
    img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLb(i)}});
  });
  if(lightbox){
    $('.lightbox-close',lightbox)?.addEventListener('click',closeLb);
    $('.lightbox-prev',lightbox)?.addEventListener('click',()=>showLb(lbIndex-1));
    $('.lightbox-next',lightbox)?.addEventListener('click',()=>showLb(lbIndex+1));
    lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLb()});
    lightbox.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0]?.clientX??null},{passive:true});
    lightbox.addEventListener('touchend',e=>{
      if(touchStartX===null)return;
      const end=e.changedTouches[0]?.clientX??touchStartX; const delta=end-touchStartX; touchStartX=null;
      if(Math.abs(delta)>55)showLb(delta>0?lbIndex-1:lbIndex+1);
    },{passive:true});
    document.addEventListener('keydown',e=>{
      if(!lightbox.classList.contains('open'))return;
      if(e.key==='Escape')closeLb();
      if(e.key==='ArrowLeft')showLb(lbIndex-1);
      if(e.key==='ArrowRight')showLb(lbIndex+1);
    });
  }
})();
