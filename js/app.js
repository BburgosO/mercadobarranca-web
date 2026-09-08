// ============ CONFIG SUPABASE (opcional) ============
// Pega tu Project URL y anon key para que el sitio use el panel.
// Si los dejas en blanco, el sitio funciona igual con datos de ejemplo.
const SUPABASE_URL      = "https://gdgayzqhrpdvcpyfckwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2F5enFocnBkdmNweWZja3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzczMzcsImV4cCI6MjEwMTU1MzMzN30.3XQBmr4o71RajaUEZZDEkJnnMDs0HP2kqC8yLy0Qs0w";
// ====================================================

const CLP = n => "$" + Number(n||0).toLocaleString("es-CL");

// imágenes de respaldo (por categoría) cuando un producto no trae foto
const IMG_ATUN="/assets/foto-06.jpg", IMG_CARP="/assets/foto-05.jpg", IMG_SALM="/assets/foto-04.jpg",
      IMG_CAM="/assets/foto-03.jpg", IMG_OST="/assets/foto-02.jpg", IMG_PAQ="/assets/foto-01.jpg";
const CAT_IMG = { "Salmón":IMG_SALM, "Camarones":IMG_CAM, "Pescados":IMG_ATUN, "Mariscos":IMG_OST, "Para picar":IMG_PAQ };

// ================= UTILIDADES =================
// Escapa el texto antes de inyectarlo con innerHTML. Nombres, formatos y categorías
// vienen de la base de datos: sin esto, cualquiera con permiso de escritura sobre la
// tabla `products` podría ejecutar HTML/JS en el navegador de todos los clientes.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

// El título del banner sí admite <em> (y <br>) para el destacado en cursiva del diseño.
// Se escapa todo y luego se reponen únicamente esas dos etiquetas.
const richTitle = s => esc(s).replace(/&lt;(\/?)(em|br)\s*\/?&gt;/gi, (m, slash, tag) => `<${slash}${tag.toLowerCase()}>`);

// Clave estable del producto. Antes el carrito guardaba el índice del array `products`:
// cuando Supabase respondía y reemplazaba el catálogo, los ítems ya agregados quedaban
// apuntando a otro producto (o a ninguno).
const keyOf = p => p.id != null ? "id:" + p.id : "n:" + p.n;

// Unidad de venta y precio por unidad de medida, deducidos del formato.
// Antes la grilla mostraba "/ kg" en todo —incluso en "Bandeja 12 und"— mientras el
// carrito mostraba "/ un" para el mismo producto. Si la BD trae `unit`, ese valor manda.
function priceInfo(p){
  const r = unitOf(p);
  // "/ kg" solo cuando el precio realmente es por kilo; en el resto, "c/u" (el precio
  // corresponde al formato completo) más el equivalente por kilo o por unidad.
  return { ...r, label: r.unit === "c/u" ? "c/u" : "/ " + r.unit };
}
function unitOf(p){
  if (p.unit) return { unit: p.unit, note: "" };
  const fmt = p.fmt || "";
  const kg = fmt.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  const gr = fmt.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  const un = fmt.match(/(\d+)\s*(?:und|unid|u)\b/i);
  const grams = kg ? parseFloat(kg[1].replace(",", ".")) * 1000
              : gr ? parseFloat(gr[1].replace(",", ".")) : null;
  if (grams === 1000) return { unit: "kg",  note: "" };
  if (grams)          return { unit: "c/u", note: CLP(Math.round(p.price / grams * 1000)) + " por kilo" };
  if (un)             return { unit: "c/u", note: CLP(Math.round(p.price / +un[1]))       + " por unidad" };
  return { unit: "c/u", note: "" };
}

// -------- datos de ejemplo (fallback) --------
const FALLBACK_PRODUCTS = [
 {id:null,n:"Salmón en porciones",cat:"Salmón",fmt:"Bolsa 1 kg · con piel",price:9990,img:IMG_SALM,badge:"of"},
 {id:null,n:"Salmón recorte para ceviche",cat:"Salmón",fmt:"Bolsa 500 g",price:6990,img:IMG_SALM,badge:""},
 {id:null,n:"Atún medallón",cat:"Pescados",fmt:"Bolsa 1 kg",price:8990,img:IMG_ATUN,badge:""},
 {id:null,n:"Atún carpaccio",cat:"Pescados",fmt:"Estuche 200 g",price:7990,img:IMG_CARP,badge:"nv"},
 {id:null,n:"Camarón ecuatoriano crudo pelado",cat:"Camarones",fmt:"Bolsa 1 kg",price:10990,img:IMG_CAM,badge:"of"},
 {id:null,n:"Ostión media concha",cat:"Mariscos",fmt:"Bandeja 12 und",price:11990,img:IMG_OST,badge:""},
 {id:null,n:"Barritas de mozzarella",cat:"Para picar",fmt:"Bolsa 500 g",price:5990,img:IMG_PAQ,badge:"nv"},
 {id:null,n:"Camarón entero premium",cat:"Camarones",fmt:"Bolsa 1 kg",price:9990,img:IMG_CAM,badge:""},
];
const FALLBACK_BANNERS = [
 {kicker:"Mercado Barranca",title:"Del mayorista <em>a tu mesa</em>, al mismo precio",subtitle:"Pescados y mariscos de calidad HORECA, el mismo que llega a los restaurantes, fraccionado para tu casa.",cta_text:"",cta_link:"#productos",image_url:""},
 {kicker:"Calidad HORECA",title:"El salmón de <em>las mejores cocinas</em>",subtitle:"Calibres y cortes profesionales, seleccionados como los pide la industria y porcionados para tu mesa.",cta_text:"",cta_link:"#productos",image_url:""},
 {kicker:"Precio transparente",title:"Precio por kilo <em>siempre a la vista</em>",subtitle:"Sin vitrina, sin intermediarios y sin cotizaciones. Compras como compra un restaurante.",cta_text:"",cta_link:"#productos",image_url:""},
];

// estado mutable (se sobreescribe desde Supabase si está configurado)
let products = [], byKey = new Map();
function setProducts(list){
  products = list;
  byKey = new Map(products.map(p => [keyOf(p), p]));
}
setProducts(FALLBACK_PRODUCTS.slice());
let banners  = FALLBACK_BANNERS.slice();
let WHATSAPP="56965128341", FREE_SHIP=40000, SHIP_COST=3990;

// Escribe el umbral de envío gratis en todos los textos de la página, para que nunca
// quede desincronizado del valor real que usa el carrito (ni al cambiarlo desde Supabase).
function paintConfig(){
  document.querySelectorAll("[data-freeship]").forEach(el=>el.textContent=CLP(FREE_SHIP));
}

// -------- Supabase --------
// La anon key es pública por diseño, pero exige RLS en el proyecto:
//   · products / banners / store_config → SELECT público, sin INSERT ni UPDATE anónimo
//   · orders / order_items / subscribers → sin lectura pública; se escriben solo vía RPC
//   · place_order → SECURITY DEFINER, validando montos en el servidor
let sbClient = null;
const SB_ON = SUPABASE_URL && !SUPABASE_URL.startsWith("TU_") && window.supabase;
if (SB_ON) sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadFromSupabase(){
  if (!sbClient) return;
  try {
    const [{data:cfg}, {data:prod}, {data:ban}] = await Promise.all([
      sbClient.from('store_config').select('*').eq('id',1).single(),
      sbClient.from('products').select('*').eq('active',true).order('sort_order'),
      sbClient.from('banners').select('*').eq('active',true).order('sort_order'),
    ]);
    if (cfg){
      WHATSAPP=cfg.whatsapp||WHATSAPP; FREE_SHIP=cfg.free_ship_threshold||FREE_SHIP; SHIP_COST=cfg.ship_cost??SHIP_COST;
      paintConfig(); sync();   // repinta textos y recalcula el carrito con los montos nuevos
      // el bloque de categorías se publica solo si está encendido en el panel
      const secCat=document.getElementById("categorias");
      if(secCat) secCat.hidden = cfg.show_categories !== true;
      // encabezado del bloque, editable desde el panel
      const ponTexto=(id,val)=>{ const el=document.getElementById(id); if(el&&val) el.textContent=val; };
      ponTexto("catsKicker", cfg.cats_kicker);
      ponTexto("catsTitle", cfg.cats_title);
      ponTexto("catsSubtitle", cfg.cats_subtitle);
      ponTexto("prodsKicker", cfg.prods_kicker);
      ponTexto("prodsTitle", cfg.prods_title);
      ponTexto("prodsSubtitle", cfg.prods_subtitle);
      const a1=document.getElementById('ann1'), a2=document.getElementById('ann2');
      if(a1&&cfg.announcement) a1.textContent=cfg.announcement;
      if(a2&&cfg.announcement_2) a2.textContent=cfg.announcement_2;
    }
    if (prod && prod.length){
      setProducts(prod.map(p=>({id:p.id,n:p.name,cat:p.category,fmt:p.format||"",price:p.price,slug:p.slug||"",
        unit:p.unit||"",img:p.image_url||CAT_IMG[p.category]||IMG_PAQ,badge:p.badge||""})));
      pruneCart();   // descarta del carrito lo que ya no existe en el catálogo nuevo
      renderGrid();
      sync();
    }
    if (ban && ban.length){ banners = ban; renderHero(); }
  } catch(e){ console.warn("Supabase no disponible, usando datos de ejemplo:", e.message); }
}

// ================= PRODUCTOS (grilla) =================
const grid = document.getElementById("grid");
let query = "";
function visibleProducts(){
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(p => `${p.n} ${p.cat} ${p.fmt}`.toLowerCase().includes(q));
}
function renderGrid(){
  const list = visibleProducts();
  const count = document.getElementById("searchCount");
  if (count) count.textContent = query.trim() ? `${list.length} resultado${list.length===1?"":"s"}` : "";
  if (!list.length){
    grid.innerHTML = `<div class="noresults">No encontramos “${esc(query)}”.<br>Prueba con salmón, camarones, atún u ostiones.</div>`;
    return;
  }
  grid.innerHTML = list.map(p=>{
    const {label, note} = priceInfo(p);
    return `
   <article class="card">
     <a class="card-link" href="/producto/${esc(p.slug||'')}" aria-label="Ver ${esc(p.n)}">
     <div class="ph">${p.badge?`<span class="badge ${p.badge==='of'?'of':'nv'}">${p.badge==='of'?'Oferta':'Nuevo'}</span>`:""}<img src="${p.img}" alt="${esc(p.n)}"></div>
     <div class="body">
       <div class="cat-tag">${esc(p.cat)}</div>
       <h3 class="serif">${esc(p.n)}</h3>
       <div class="fmt">${esc(p.fmt)}</div>
       </div>
     </a>
     <div class="body body-foot">
       <div class="row">
         <div class="price">${CLP(p.price)} <small>${esc(label)}</small>${note?`<span class="price-note">${esc(note)}</span>`:""}</div>
         <button class="add" data-key="${esc(keyOf(p))}" aria-label="Añadir ${esc(p.n)} al carrito"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
       </div>
     </div>
   </article>`;}).join("");
}
renderGrid();

// ================= CATEGORÍAS =================
// Se guardan en Supabase para poder editarlas desde el panel.
let categorias=[];

async function cargarCategorias(){
  const grid=document.getElementById("catsGrid");
  const sec=document.getElementById("categorias");
  if(!grid||!sbClient) return;
  try{
    const {data}=await sbClient.from("categories").select("*").eq("active",true).order("sort_order");
    if(data) categorias=data;
  }catch(e){ console.warn("No se pudieron cargar las categorías:",e.message); }
  pintarCategorias();
}

function pintarCategorias(){
  const grid=document.getElementById("catsGrid");
  if(!grid) return;
  grid.innerHTML = categorias.map(c=>{
    const foto = c.image_url || CAT_IMG[c.name] || IMG_PAQ;
    return `<a class="cat${c.featured?" big":""}" href="${esc(c.link||"#productos")}">
      <img src="${esc(foto)}" alt="${esc(c.name)}" loading="lazy">
      <div class="lbl">
        ${c.kicker?`<div class="k">${esc(c.kicker)}</div>`:""}
        <h3 class="serif">${esc(c.name)}</h3>
        ${c.featured?'<span class="go">Ver todo →</span>':""}
      </div></a>`;}).join("");
}

// ================= TESTIMONIOS =================
let testimonios=[];

async function cargarTestimonios(){
  const grid=document.getElementById("testisGrid");
  if(!grid||!sbClient) return;
  try{
    const {data}=await sbClient.from("testimonials").select("*").eq("active",true).order("sort_order");
    if(data) testimonios=data;
  }catch(e){ console.warn("No se pudieron cargar los testimonios:",e.message); }
  pintarTestimonios();
}

// Las iniciales del círculo salen del nombre, no se cargan aparte.
function iniciales(nombre){
  return String(nombre||"").trim().split(/\s+/).slice(0,2)
    .map(p=>p[0]||"").join("").toUpperCase();
}

function pintarTestimonios(){
  const grid=document.getElementById("testisGrid");
  if(!grid) return;
  grid.innerHTML = testimonios.map(t=>`
    <div class="testi">
      <span class="q serif">“</span>
      <p>${esc(t.quote)}</p>
      <div class="who">
        <div class="av">${esc(iniciales(t.author))}</div>
        <div><b>${esc(t.author)}</b><span>${esc(t.location||"")}</span></div>
      </div>
    </div>`).join("");
  const sec=grid.closest("section");
  if(sec) sec.hidden = testimonios.length===0;
}

// ================= HERO (banners) =================
function renderHero(){
  const wrap=document.getElementById("heroWrap"), dots=document.getElementById("heroDots"), bg=document.getElementById("heroBg");
  if(!wrap) return;
  wrap.innerHTML = banners.map((b,i)=>`
    <div class="slide${i===0?' on':''}">
      <span class="kicker">${esc(b.kicker||'')}</span>
      <h1>${richTitle(b.title||'')}</h1>
      <p>${esc(b.subtitle||'')}</p>
      ${b.cta_text?`<div class="cta"><a class="btn btn-primary" href="${esc(b.cta_link||'#productos')}">${esc(b.cta_text)}</a></div>`:''}
    </div>`).join("");
  dots.innerHTML = banners.map((b,i)=>`<button class="${i===0?'on':''}" data-s="${i}" aria-label="Slide ${i+1}"></button>`).join("");
  if(bg && banners[0] && banners[0].image_url) bg.src = banners[0].image_url;
  initSlider();
}

// ================= SLIDER =================
let si=0, timer=null;
function initSlider(){
  const slides=[...document.querySelectorAll('.slide')], dots=[...document.querySelectorAll('#heroDots button')], bg=document.getElementById('heroBg');
  si=0; if(timer) clearInterval(timer);
  function go(n){
    if(!slides.length) return;
    slides[si].classList.remove('on'); dots[si] && dots[si].classList.remove('on');
    si=(n+slides.length)%slides.length;
    slides[si].classList.add('on'); dots[si] && dots[si].classList.add('on');
    if(bg && banners[si] && banners[si].image_url) bg.src=banners[si].image_url;
  }
  function auto(){ timer=setInterval(()=>go(si+1),5500); }
  dots.forEach(d=>d.onclick=()=>{ clearInterval(timer); go(+d.dataset.s); auto(); });
  auto();
}
initSlider();

// ================= CARRITO + CHECKOUT WHATSAPP =================
const GREET="¡Hola Mercado Barranca! Quiero hacer un pedido 🐟";
const CART_KEY="mb_cart_v1";

// El carrito persiste entre recargas (antes se perdía al refrescar la página).
function loadCart(){
  try{
    const raw=JSON.parse(localStorage.getItem(CART_KEY)||"{}");
    const out={};
    for(const [k,q] of Object.entries(raw)) if(Number.isFinite(+q)&&+q>0) out[k]=Math.min(99,Math.floor(+q));
    return out;
  }catch(e){ return {}; }
}
function saveCart(){ try{ localStorage.setItem(CART_KEY,JSON.stringify(cart)); }catch(e){} }
let cart = loadCart();

// Elimina del carrito los productos que ya no están en el catálogo vigente.
function pruneCart(){
  let dropped=0;
  for(const k of Object.keys(cart)) if(!byKey.has(k)){ delete cart[k]; dropped++; }
  if(dropped){ saveCart(); toastMsg("Actualizamos el catálogo y ajustamos tu carrito"); }
}

const toast=document.getElementById("toast"); let tt;
function toastMsg(m){document.getElementById("toastMsg").textContent=m;toast.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove("show"),2600);}
function cartKeys(){ return Object.keys(cart).filter(k=>byKey.has(k)); }
function totalQty(){ return cartKeys().reduce((a,k)=>a+cart[k],0); }
function subtotal(){ return cartKeys().reduce((s,k)=>s+byKey.get(k).price*cart[k],0); }
function addItem(k){ const p=byKey.get(k); if(!p) return; cart[k]=Math.min(99,(cart[k]||0)+1); sync(); toastMsg(p.n+" · añadido"); }
function setQty(k,q){ if(q<=0) delete cart[k]; else cart[k]=Math.min(99,q); sync(); }
function sync(){ saveCart(); document.getElementById("cnt").textContent=totalQty(); renderCart(); }
function renderCart(){
  const box=document.getElementById("cartItems"),foot=document.getElementById("cartFoot");
  const keys=cartKeys();
  if(!keys.length){box.innerHTML='<div class="cart-empty"><b style="color:var(--cream2)">Tu carrito está vacío</b><br>Agrega productos y arma tu pedido por WhatsApp.</div>';foot.style.display="none";return;}
  foot.style.display="block";
  box.innerHTML=keys.map(k=>{const p=byKey.get(k),q=cart[k];const {label}=priceInfo(p);return `
   <div class="citem">
     <img src="${p.img}" alt="">
     <div class="ci-b">
       <h4>${esc(p.n)}</h4>
       <div class="ci-p">${CLP(p.price)} <span style="color:var(--dim);font-weight:400">${esc(label)}</span></div>
       <div class="stepper"><button data-dec="${esc(k)}" aria-label="Quitar uno de ${esc(p.n)}">−</button><span>${q}</span><button data-inc="${esc(k)}" aria-label="Agregar uno de ${esc(p.n)}">+</button></div>
       <button type="button" class="rm" data-rm="${esc(k)}">Quitar</button>
     </div>
     <div class="ci-line">${CLP(p.price*q)}</div>
   </div>`;}).join("");
  const sub=subtotal(),ship=costoDespacho(sub),falta=Math.max(0,FREE_SHIP-sub),pct=Math.min(100,sub/FREE_SHIP*100);
  document.getElementById("shipBar").innerHTML=falta>0
    ? `Te faltan <b style="color:var(--orange)">${CLP(falta)}</b> para envío gratis<div class="track"><div class="fill" style="width:${pct}%"></div></div>`
    : `✅ ¡Tienes envío gratis!<div class="track"><div class="fill" style="width:100%"></div></div>`;
  document.getElementById("sumSub").textContent=CLP(sub);
  document.getElementById("sumShip").textContent =
    ship===0 ? "Gratis" : ship===null ? "Elige tu comuna" : CLP(ship);
  document.getElementById("sumTotal").textContent = CLP(sub + (ship||0));
}
grid.addEventListener("click",e=>{const b=e.target.closest("[data-key]");if(b)addItem(b.dataset.key);});
document.getElementById("cartItems").addEventListener("click",e=>{
  const inc=e.target.closest("[data-inc]"),dec=e.target.closest("[data-dec]"),rm=e.target.closest("[data-rm]");
  if(inc)setQty(inc.dataset.inc,(cart[inc.dataset.inc]||0)+1);
  else if(dec)setQty(dec.dataset.dec,(cart[dec.dataset.dec]||0)-1);
  else if(rm)setQty(rm.dataset.rm,0);
});

// ================= OVERLAYS (carrito, menú, buscador) =================
// Cierran con Escape, bloquean el scroll de fondo y devuelven el foco a quien los abrió.
let openEl=null, lastFocus=null;
function openOverlay(el,opener,focusEl){
  el.classList.add("open");
  document.body.style.overflow="hidden";
  openEl=el; lastFocus=opener||document.activeElement;
  if(opener) opener.setAttribute("aria-expanded","true");
  const target=focusEl||el.querySelector("button,a,input");
  if(target) setTimeout(()=>target.focus(),40);
}
function closeOverlay(){
  if(!openEl) return;
  openEl.classList.remove("open");
  document.body.style.overflow="";
  document.querySelectorAll('[aria-expanded="true"]').forEach(b=>b.setAttribute("aria-expanded","false"));
  if(lastFocus&&lastFocus.focus) lastFocus.focus();
  openEl=null;
}
addEventListener("keydown",e=>{
  if(e.key==="Escape"&&openEl) closeOverlay();
  if(e.key==="Tab"&&openEl){   // foco atrapado dentro del overlay abierto
    const f=[...openEl.querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
    if(!f.length) return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

const drawer=document.getElementById("cartDrawer"),cartBtn=document.getElementById("cartBtn");
cartBtn.addEventListener("click",()=>openOverlay(drawer,cartBtn));
drawer.addEventListener("click",e=>{if(e.target.closest("[data-cclose]"))closeOverlay();});

const mnav=document.getElementById('mnav'),hamb=document.getElementById('hamb');
hamb.addEventListener('click',()=>openOverlay(mnav,hamb));
mnav.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeOverlay();});

// ================= BUSCADOR =================
const searchbar=document.getElementById("searchbar"),searchBtn=document.getElementById("searchBtn"),searchInput=document.getElementById("searchInput");
function closeSearch(){
  searchbar.classList.remove("open"); searchBtn.setAttribute("aria-expanded","false");
  if(query){ query=""; searchInput.value=""; renderGrid(); }
}
searchBtn.addEventListener("click",()=>{
  const open=searchbar.classList.toggle("open");
  searchBtn.setAttribute("aria-expanded",String(open));
  if(open) setTimeout(()=>searchInput.focus(),40); else closeSearch();
});
document.getElementById("searchClose").addEventListener("click",()=>{closeSearch();searchBtn.focus();});
searchInput.addEventListener("input",()=>{
  query=searchInput.value; renderGrid();
  if(query.trim()) document.getElementById("productos").scrollIntoView({behavior:"smooth",block:"start"});
});
searchInput.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSearch();searchBtn.focus();}});

// ================= CHECKOUT =================
async function saveOrder(d,keys,sub,ship,total){
  if(!sbClient) return;
  const items=keys.map(k=>{const p=byKey.get(k);return {product_id:p.id||null,name:p.n,qty:cart[k],unit_price:p.price,line_total:p.price*cart[k]};});
  await sbClient.rpc('place_order',{p_name:`${d.name} ${d.lastName}`.trim(),p_phone:d.phone,p_comuna:d.comuna,p_email:d.email,
    p_subtotal:sub,p_shipping:ship,p_total:total,p_items:items,p_address:d.address,p_region:d.region});
}

// Deja el teléfono en formato internacional chileno (56XXXXXXXXX) para que el número
// llegue utilizable al negocio, escriba el cliente +56 9…, 09… o solo los 8 dígitos.
function normalizaFono(v){
  let d=(v||"").replace(/\D/g,"");
  if(d.startsWith("56")) d=d.slice(2);
  d=d.replace(/^0+/,"");
  if(d.length===8) d="9"+d;              // fijo antiguo o móvil sin el 9
  return d.length===9 ? "+56 "+d[0]+" "+d.slice(1,5)+" "+d.slice(5) : null;
}
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- despacho por comuna ----------
// Las tarifas viven en Supabase (tabla shipping_rates) para poder ajustarlas
// sin volver a publicar el sitio. SHIP_COST queda como respaldo.
let TARIFAS=[];

async function cargarTarifas(){
  if(!sbClient) return;
  try{
    const {data}=await sbClient.from("shipping_rates").select("*").eq("active",true).eq("covered",true)
      .order("region").order("sort_order");
    if(data&&data.length){ TARIFAS=data; llenarRegiones(); }
  }catch(e){ console.warn("No se pudieron cargar las tarifas de despacho:",e.message); }
}

// Costo de la comuna elegida; sin comuna todavia, no se puede saber.
function costoComuna(){
  const c=(document.getElementById("ckComuna")?.value||"").trim();
  if(!c) return null;
  const t=TARIFAS.find(t=>t.comuna===c);
  return t ? t.cost : SHIP_COST;
}

// El envio es gratis sobre el umbral, sin importar la comuna.
function costoDespacho(sub){
  if(sub>=FREE_SHIP) return 0;
  return costoComuna();
}

function llenarRegiones(){
  const selCom=document.getElementById("ckComuna");
  if(!selCom) return;
  document.getElementById("ckRegion").addEventListener("change",e=>{
    const reg=e.target.value;
    const comunas=TARIFAS.filter(t=>t.region===reg);
    selCom.innerHTML='<option value="">Comuna…</option>'+
      comunas.map(t=>'<option value="'+esc(t.comuna)+'">'+esc(t.comuna)+' · '+CLP(t.cost)+'</option>').join("");
    selCom.disabled=!reg;
    selCom.value="";
    renderCart();   // el despacho cambia al cambiar de region
  });
  selCom.addEventListener("change",renderCart);
}

// Valida los datos del cliente y marca el primer campo con problema.
function leerDatosCliente(){
  const campos={name:"ckName",lastName:"ckLastName",phone:"ckPhone",email:"ckEmail",
                region:"ckRegion",comuna:"ckComuna",address:"ckAddress"};
  const el=id=>document.getElementById(id);
  Object.values(campos).forEach(id=>el(id).classList.remove("err"));
  const v={}; for(const [k,id] of Object.entries(campos)) v[k]=(el(id).value||"").trim();

  const falla=(id,msg)=>{const e=el(id);e.classList.add("err");e.focus();toastMsg(msg);return null;};
  if(!v.name)                 return falla(campos.name,"Falta tu nombre");
  if(!v.lastName)             return falla(campos.lastName,"Falta tu apellido");
  const fono=normalizaFono(v.phone);
  if(!fono)                   return falla(campos.phone,"Revisa tu teléfono: 9 dígitos, ej. 9 1234 5678");
  if(!EMAIL_RE.test(v.email)) return falla(campos.email,"Revisa tu correo electrónico");
  if(!v.region)               return falla(campos.region,"Elige tu region");
  if(!v.comuna)               return falla(campos.comuna,"Elige tu comuna");
  if(v.address.length<5)      return falla(campos.address,"Falta tu direccion de despacho");
  return {...v, phone:fono, regionLabel: v.region==="RM" ? "Region Metropolitana" : "V Region"};
}

const checkoutBtn=document.getElementById("checkoutBtn");
let sending=false;
checkoutBtn.addEventListener("click",async ()=>{
  if(sending) return;                       // evita que el doble clic duplique el pedido
  const keys=cartKeys();
  if(!keys.length){toastMsg("Tu carrito está vacío");return;}
  const datos=leerDatosCliente();
  if(!datos) return;                        // faltan datos: no se abre WhatsApp ni se guarda
  const sub=subtotal(),ship=costoDespacho(sub)||0,total=sub+ship;

  // La ventana se abre dentro del gesto del usuario: si se abriera después del await,
  // el navegador la bloquearía como popup y el pedido quedaría guardado sin avisar a nadie.
  const win=window.open("","_blank");
  sending=true; checkoutBtn.disabled=true; checkoutBtn.style.opacity=".65";
  const label=checkoutBtn.innerHTML;
  checkoutBtn.innerHTML="Enviando…";
  try{
    await saveOrder(datos,keys,sub,ship,total);
  }catch(e){
    console.warn("No se pudo guardar el pedido:",e.message);   // igual seguimos a WhatsApp
  }finally{
    sending=false; checkoutBtn.disabled=false; checkoutBtn.style.opacity=""; checkoutBtn.innerHTML=label;
  }
  let msg="¡Hola Mercado Barranca! 🐟 Quiero hacer este pedido:\n\n";
  keys.forEach(k=>{const p=byKey.get(k),q=cart[k];msg+=`• ${q}× ${p.n} — ${CLP(p.price*q)}\n`;});
  msg+=`\nSubtotal: ${CLP(sub)}\nDespacho: ${ship===0?"Gratis":CLP(ship)}\nTotal: ${CLP(total)}\n\n`
     +`Nombre: ${datos.name} ${datos.lastName}\nTeléfono: ${datos.phone}\nCorreo: ${datos.email}\n\n`
     +`Dirección: ${datos.address}
Comuna: ${datos.comuna}
Región: ${datos.regionLabel}

\nHorario preferido: `;
  const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  if(win&&!win.closed) win.location.href=url; else location.href=url;   // fallback si bloquean el popup
});

// Enlaces a WhatsApp: saludo genérico (.wa-link) o consulta ya redactada (.wa-ask).
function openWhatsApp(text){
  const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  const win=window.open(url,"_blank","noopener");
  if(!win) location.href=url;
}
document.querySelectorAll(".wa-link").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();openWhatsApp(GREET);}));
document.querySelectorAll(".wa-ask").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();openWhatsApp(a.dataset.ask||GREET);}));
paintConfig();
cargarTarifas();
cargarCategorias();
cargarTestimonios();
sync();

// ================= NEWSLETTER =================
const newsForm=document.getElementById("newsForm");
newsForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const input=document.getElementById("newsEmail"),btn=document.getElementById("newsBtn");
  const email=input.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ toastMsg("Revisa tu correo, parece incompleto"); input.focus(); return; }
  btn.disabled=true;
  try{
    // Requiere una tabla `subscribers(email unique, created_at)` con INSERT anónimo
    // permitido y SELECT cerrado. Sin Supabase configurado solo confirma en pantalla.
    if(sbClient) await sbClient.from("subscribers").insert({email});
    toastMsg("¡Listo! Te avisaremos de las ofertas");
    newsForm.reset();
  }catch(err){
    console.warn("No se pudo guardar la suscripción:",err.message);
    toastMsg("No pudimos suscribirte ahora. Intenta más tarde");
  }finally{ btn.disabled=false; }
});

// ================= NAV activo =================
const secs=['inicio','productos'].map(id=>document.getElementById(id));
const navlinks=[...document.querySelectorAll('nav.main a')];
addEventListener('scroll',()=>{
  let cur='inicio';
  for(const s of secs){if(s&&s.getBoundingClientRect().top<=140)cur=s.id;}
  navlinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+cur));
},{passive:true});

// si se vuelve desde la ficha de producto con #carrito, abrir el carrito
if (location.hash === "#carrito") {
  history.replaceState(null, "", location.pathname + location.search);
  setTimeout(()=>openOverlay(drawer, cartBtn), 120);
}

// cargar datos reales al final
loadFromSupabase();