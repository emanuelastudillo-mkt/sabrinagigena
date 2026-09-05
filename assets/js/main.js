(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

  // V22.20 · presentación progresiva sobre los datos y enlaces ya publicados.
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const mobileNav=matchMedia('(max-width: 980px)');
  const create=(tag,className,text)=>{
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text)element.textContent=text;
    return element;
  };
  const focusable=element=>$$('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]',element)
    .filter(item=>!item.hidden&&item.getClientRects().length&&!item.closest('[inert]'));
  const trapFocus=(event,element)=>{
    if(event.key!=='Tab')return;
    const items=focusable(element), first=items[0], last=items[items.length-1];
    if(!first)return;
    if(event.shiftKey&&(document.activeElement===first||!element.contains(document.activeElement))){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!element.contains(document.activeElement))){event.preventDefault();first.focus()}
  };
  const suspendBackground=elements=>{
    const previous=elements.map(element=>[element,element.inert]);
    previous.forEach(([element])=>{element.inert=true});
    return ()=>previous.forEach(([element,inert])=>{element.inert=inert});
  };
  const main=$('main');
  if(main){
    if(!main.id)main.id='main-content';
    main.tabIndex=-1;
    const skip=create('a','skip-link','Saltar al contenido');
    skip.href='#'+main.id;
    document.body.prepend(skip);
  }

  const menuBtn=$('.menu-btn');
  const nav=$('.nav');
  const header=$('.site-header');
  let restoreMenuBackground=()=>{};
  const closeMenu=(returnFocus=false)=>{
    if(!menuBtn||!nav)return;
    const wasOpen=nav.classList.contains('open');
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
    menuBtn.setAttribute('aria-label','Abrir menú');
    document.body.classList.remove('menu-open');
    restoreMenuBackground();restoreMenuBackground=()=>{};
    if(returnFocus&&wasOpen)menuBtn.focus({preventScroll:true});
  };
  if(menuBtn&&nav){
    const backdrop=create('div','menu-backdrop');
    backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
    menuBtn.addEventListener('click',()=>{
      if(nav.classList.contains('open')){closeMenu(true);return}
      nav.classList.add('open');menuBtn.setAttribute('aria-expanded','true');menuBtn.setAttribute('aria-label','Cerrar menú');
      document.body.classList.add('menu-open');
      restoreMenuBackground=suspendBackground($$('main,.footer,.wa-float,.contact-dock,.back-to-top'));
      $('a',nav)?.focus({preventScroll:true});
    });
    nav.addEventListener('click',e=>{
      const link=e.target.closest('a');if(!link)return;
      closeMenu(link.target==='_blank');
      const target=new URL(link.href,location.href);
      if(target.pathname===location.pathname&&target.hash){
        const section=document.getElementById(decodeURIComponent(target.hash.slice(1)));
        if(section){section.tabIndex=-1;section.focus({preventScroll:true})}
      }
    });
    backdrop.addEventListener('click',()=>closeMenu(true));
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&!menuBtn.contains(e.target))closeMenu()});
    document.addEventListener('keydown',e=>{
      if(!nav.classList.contains('open'))return;
      if(e.key==='Escape')closeMenu(true);
      trapFocus(e,header||nav);
    });
    mobileNav.addEventListener('change',()=>closeMenu());
  }
  if(header){
    const measureHeader=()=>document.documentElement.style.setProperty('--header-height',header.offsetHeight+'px');
    measureHeader();
    if('ResizeObserver' in window)new ResizeObserver(measureHeader).observe(header);
    const updateHeader=()=>header.classList.toggle('is-scrolled',scrollY>24);
    addEventListener('scroll',updateHeader,{passive:true});updateHeader();
  }

  const cards=$$('.property-card[data-search]');
  const empty=$('.empty-state');
  const count=$('.count-number');
  const input=$('[data-property-search]');
  let active='all';
  const chips=$$('.filter-chip[data-filter]');
  const filterStatus=create('span','sr-only');
  filterStatus.setAttribute('role','status');filterStatus.setAttribute('aria-atomic','true');
  if(cards.length)$('.property-grid')?.before(filterStatus);
  const syncChips=()=>chips.forEach(chip=>{
    const selected=chip.dataset.filter===active;
    chip.classList.toggle('active',selected);chip.setAttribute('aria-pressed',String(selected));
  });
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
    filterStatus.textContent=shown===1?'1 propiedad disponible':shown+' propiedades disponibles';
    syncChips();
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
    if(input){input.setAttribute('enterkeyhint','search');input.setAttribute('spellcheck','false')}
    if(empty){
      const reset=create('button','btn btn-secondary filter-reset','Limpiar filtros');reset.type='button';
      reset.addEventListener('click',()=>{
        active='all';if(input)input.value='';applyFilters(true);
        (input||chips[0])?.focus({preventScroll:true});
      });
      empty.append(reset);
    }
  }

  $$('.property-card a[href]').forEach(link=>link.addEventListener('click',()=>{
    try{sessionStorage.setItem('sgPropertyReturn',location.pathname+location.search+location.hash)}catch(_){}
  }));
  const backButton=$('[data-back-button]');
  if(backButton)backButton.addEventListener('click',()=>{
    let returnUrl=''; try{returnUrl=sessionStorage.getItem('sgPropertyReturn')||''}catch(_){}
    if(returnUrl&&returnUrl!==(location.pathname+location.search+location.hash)){
      try{const target=new URL(returnUrl,location.href);if(target.origin===location.origin){location.href=target.href;return}}catch(_){}
    }
    try{if(document.referrer){const ref=new URL(document.referrer);if(ref.origin===location.origin){history.back();return}}}catch(_){}
    const marker='/propiedades/'; const markerIndex=location.pathname.indexOf(marker);
    const basePath=markerIndex>=0?location.pathname.slice(0,markerIndex):'';
    location.href=basePath+marker;
  });

  const pickRandomIndex=(length,previous=-1)=>{
    let index=Math.floor(Math.random()*length);
    if(length>1&&index===previous)index=(index+1+Math.floor(Math.random()*(length-1)))%length;
    return index;
  };

  const heroLocation=$('[data-hero-location]');
  if(heroLocation){
    const locations=['Exaltación de la Cruz','Parque Sakura','Capilla del Señor'];
    let previous=-1; try{previous=Number(sessionStorage.getItem('sgHeroLocation')??-1)}catch(_){}
    const index=pickRandomIndex(locations.length,previous);
    heroLocation.textContent=locations[index];
    try{sessionStorage.setItem('sgHeroLocation',String(index))}catch(_){}
  }

  const rotator=$('[data-about-rotator]');
  if(rotator){
    const source=$('#about-rotator-images')||$('#catalog-rotator-images'); let options=[];
    try{
      const parsed=JSON.parse(source?.textContent||'[]');
      if(Array.isArray(parsed))options=parsed.filter(item=>item&&typeof item.src==='string'&&item.src.trim());
    }catch(_){}
    if(!options.length){
      rotator.hidden=true; rotator.removeAttribute('src'); rotator.alt='';
    }else{
      let previous=-1; try{previous=Number(sessionStorage.getItem('sgAboutImage')??-1)}catch(_){}
      const index=pickRandomIndex(options.length,previous);
      rotator.hidden=false; rotator.src=options[index].src; rotator.alt=options[index].alt||'Atención inmobiliaria integral de Sabrina Gigena';
      try{sessionStorage.setItem('sgAboutImage',String(index))}catch(_){}
    }
  }

  const heroPanel=$('.home-hero-panel');
  const catalogShortcut=$('.home-catalog .text-link');
  if(heroPanel&&catalogShortcut){
    const shortcut=catalogShortcut.cloneNode(true);shortcut.className='btn hero-catalog-link';
    $('.home-hero-copy',heroPanel)?.append(shortcut);
  }
  const aboutPhoto=$('[data-about-rotator]');
  if(aboutPhoto&&!aboutPhoto.hidden){
    const frame=create('div','about-photo');aboutPhoto.before(frame);frame.append(aboutPhoto);
  }

  // Atajos a secciones existentes; sus contenidos permanecen intactos.
  const detailMain=$('.detail-main');
  if(detailMain){
    const sectionNav=create('nav','detail-section-nav');sectionNav.setAttribute('aria-label','Secciones de la propiedad');
    const sections=$$('.content-block',detailMain).filter(section=>$('h2',section));
    sections.forEach((section,index)=>{
      if(!section.id)section.id='ficha-seccion-'+(index+1);
      const link=create('a','',$('h2',section).textContent);link.href='#'+section.id;sectionNav.append(link);
    });
    if(sections.length){
      $('.detail-title',detailMain)?.after(sectionNav);
      sectionNav.addEventListener('click',e=>{
        const link=e.target.closest('a');if(!link)return;
        const section=document.getElementById(link.hash.slice(1));
        if(section){section.tabIndex=-1;section.focus({preventScroll:true})}
      });
    }
  }
  const contact=$('.property-page .contact-card');
  if(contact){
    const dock=create('nav','contact-dock');dock.setAttribute('aria-label','Consultar esta propiedad');
    const whatsapp=$('a.btn[href*="wa.me/"]',contact);
    const appointment=$('a[data-appointment-link]',contact);
    if(whatsapp){
      const link=whatsapp.cloneNode(true);link.className='btn dock-whatsapp';
      link.setAttribute('aria-label',whatsapp.textContent.trim());
      link.textContent=document.body.classList.contains('is-archived')?'Ver alternativas':'Consultar por WhatsApp';dock.append(link);
    }
    if(appointment){
      const link=appointment.cloneNode(true);link.className='btn btn-secondary';link.textContent='Agendar reunión';dock.append(link);
    }
    if(dock.children.length){
      document.body.classList.add('has-contact-dock');document.body.append(dock);
      if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
        dock.classList.toggle('is-covered',entries[0].isIntersecting);
      },{threshold:0.15}).observe(contact);
    }
  }
  const topButton=create('button','back-to-top','↑');
  topButton.type='button';topButton.setAttribute('aria-label','Volver al inicio de la página');topButton.hidden=true;
  document.body.append(topButton);
  const updateTopButton=()=>{topButton.hidden=scrollY<innerHeight};
  addEventListener('scroll',updateTopButton,{passive:true});updateTopButton();
  topButton.addEventListener('click',()=>{
    scrollTo({top:0,behavior:reducedMotion.matches?'instant':'smooth'});
    $('.brand',header||document)?.focus({preventScroll:true});
  });
  // Las animaciones no ocultan contenido mientras se espera al observador.
  if('IntersectionObserver' in window&&!reducedMotion.matches){
    const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      entry.target.classList.add('in-view');reveal.unobserve(entry.target);
    }),{threshold:0.08});
    $$('.property-card,.about-strip,.spec-grid,.content-block').forEach(element=>reveal.observe(element));
  }

  const lightbox=$('.lightbox');
  const lbImg=lightbox?$('img',lightbox):null;
  const lbItems=$$('[data-lightbox]');
  if(lightbox&&lbImg&&lbItems.length){
    let lbIndex=0,zoomed=false,returnFocus=null,restoreBackground=()=>{},touchStart=null;
    const images=[], imageIndex=new Map();
    lbItems.forEach(img=>{
      const source=img.dataset.full||img.src;
      if(!imageIndex.has(source)){imageIndex.set(source,images.length);images.push({src:source,alt:img.alt})}
    });
    const counter=create('span','lightbox-counter');counter.setAttribute('role','status');counter.setAttribute('aria-live','polite');
    const caption=create('p','lightbox-caption');
    const zoom=create('button','lightbox-zoom','+');
    zoom.type='button';zoom.setAttribute('aria-label','Acercar imagen');zoom.setAttribute('aria-pressed','false');
    const stage=create('div','lightbox-stage');lbImg.before(stage);stage.append(lbImg);
    lightbox.append(counter,caption,zoom);
    const previous=$('.lightbox-prev',lightbox),next=$('.lightbox-next',lightbox),close=$('.lightbox-close',lightbox);
    if(images.length===1){if(previous)previous.hidden=true;if(next)next.hidden=true}
    const setZoom=value=>{
      zoomed=value;lightbox.classList.toggle('is-zoomed',value);zoom.textContent=value?'−':'+';
      zoom.setAttribute('aria-pressed',String(value));zoom.setAttribute('aria-label',value?'Alejar imagen':'Acercar imagen');
      lbImg.style.transformOrigin='50% 50%';stage.scrollTo({top:0,left:0,behavior:'instant'});
    };
    const showLb=index=>{
      lbIndex=(index+images.length)%images.length;setZoom(false);
      lbImg.src=images[lbIndex].src;lbImg.alt=images[lbIndex].alt||'Imagen ampliada';
      caption.textContent=lbImg.alt;counter.textContent=(lbIndex+1)+' / '+images.length;
      lightbox.classList.remove('image-error');lightbox.classList.add('open');lightbox.setAttribute('aria-hidden','false');
      if(!document.body.classList.contains('gallery-open')){
        returnFocus=document.activeElement;document.body.classList.add('gallery-open','no-scroll');
        restoreBackground=suspendBackground([...document.body.children].filter(element=>element!==lightbox&&!['SCRIPT','STYLE','LINK'].includes(element.tagName)));
        close?.focus({preventScroll:true});
      }
    };
    const closeLb=()=>{
      lightbox.classList.remove('open');lightbox.setAttribute('aria-hidden','true');
      document.body.classList.remove('gallery-open','no-scroll');setZoom(false);restoreBackground();restoreBackground=()=>{};
      if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    };
    lbImg.addEventListener('error',()=>{
      lightbox.classList.add('image-error');caption.textContent='No se pudo cargar esta imagen. Podés pasar a la siguiente.';
    });
    lbImg.addEventListener('load',()=>lightbox.classList.remove('image-error'));
    lbItems.forEach(img=>{
      const index=imageIndex.get(img.dataset.full||img.src);
      const frame=create('div','gallery-frame');
      if(img.classList.contains('gallery-main'))frame.classList.add('gallery-main-frame');
      else if(img.classList.contains('gallery-slot'))frame.classList.add('gallery-slot');
      img.before(frame);frame.append(img);img.tabIndex=0;img.setAttribute('role','button');
      img.setAttribute('aria-label',`Ampliar imagen ${index+1} de ${images.length}: ${img.alt}`);
      img.addEventListener('click',()=>showLb(index));
      img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLb(index)}});
    });
    const gallery=$('.gallery-hero');
    if(gallery){
      const openGallery=create('button','gallery-open-button','Ver '+images.length+(images.length===1?' foto':' fotos'));
      openGallery.type='button';openGallery.addEventListener('click',()=>showLb(0));gallery.append(openGallery);
    }
    close?.addEventListener('click',closeLb);previous?.addEventListener('click',()=>showLb(lbIndex-1));next?.addEventListener('click',()=>showLb(lbIndex+1));
    zoom.addEventListener('click',()=>setZoom(!zoomed));
    lbImg.addEventListener('click',()=>{if(matchMedia('(pointer:fine)').matches)setZoom(!zoomed)});
    lbImg.addEventListener('pointermove',event=>{
      if(!zoomed||event.pointerType!=='mouse')return;
      const bounds=stage.getBoundingClientRect();
      const x=Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100));
      const y=Math.max(0,Math.min(100,(event.clientY-bounds.top)/bounds.height*100));
      lbImg.style.transformOrigin=x+'% '+y+'%';
    });
    lightbox.addEventListener('click',e=>{if(e.target===lightbox||e.target===stage)closeLb()});
    stage.addEventListener('touchstart',event=>{
      touchStart=!zoomed&&event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
    },{passive:true});
    stage.addEventListener('touchmove',event=>{if(event.touches.length!==1)touchStart=null},{passive:true});
    stage.addEventListener('touchend',event=>{
      if(!touchStart||zoomed||!event.changedTouches.length)return;
      const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;
      if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)showLb(lbIndex+(dx<0?1:-1));touchStart=null;
    },{passive:true});
    stage.addEventListener('touchcancel',()=>{touchStart=null},{passive:true});
    document.addEventListener('keydown',e=>{
      if(!lightbox.classList.contains('open'))return;
      if(e.key==='Escape'){e.preventDefault();closeLb()}
      if(e.key==='ArrowLeft'){e.preventDefault();showLb(lbIndex-1)}
      if(e.key==='ArrowRight'){e.preventDefault();showLb(lbIndex+1)}
      trapFocus(e,lightbox);
    });
  }
})();
