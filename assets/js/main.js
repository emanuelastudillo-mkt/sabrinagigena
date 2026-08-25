const header=document.querySelector('.site-header');
const menuBtn=document.querySelector('.menu-btn');
const navLinks=document.querySelector('.nav-links');
const onScroll=()=>header?.classList.toggle('scrolled',window.scrollY>40);
onScroll(); window.addEventListener('scroll',onScroll,{passive:true});
menuBtn?.addEventListener('click',()=>navLinks?.classList.toggle('open'));
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>navLinks?.classList.remove('open')));
document.querySelectorAll('form[data-whatsapp]').forEach(form=>{
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(form);
  const msg=`Hola Sabrina, soy ${data.get('nombre')||''} ${data.get('apellido')||''}.%0A${data.get('mensaje')||'Quisiera recibir más información.'}`;
  window.open(`https://wa.me/5492304567715?text=${encodeURIComponent(decodeURIComponent(msg))}`,'_blank');
 });
});
