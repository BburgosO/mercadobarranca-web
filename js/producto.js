// ============ CONFIG SUPABASE ============
const SUPABASE_URL      = "https://gdgayzqhrpdvcpyfckwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2F5enFocnBkdmNweWZja3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzczMzcsImV4cCI6MjEwMTU1MzMzN30.3XQBmr4o71RajaUEZZDEkJnnMDs0HP2kqC8yLy0Qs0w";
// =========================================

const CLP = n => "$" + Number(n||0).toLocaleString("es-CL");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const $ = id => document.getElementById(id);

// Fotos de respaldo por categoria, las mismas que usa el catalogo del sitio.
// Cuando subas una foto propia desde el panel, esa manda sobre esta.
const IMG_ATUN="/assets/foto-06.jpg", IMG_CARP="/assets/foto-05.jpg", IMG_SALM="/assets/foto-04.jpg",
      IMG_CAM="/assets/foto-03.jpg", IMG_OST="/assets/foto-02.jpg", IMG_PAQ="/assets/foto-01.jpg";
const CAT_IMG = { "Salmón":IMG_SALM, "Camarones":IMG_CAM, "Pescados":IMG_ATUN, "Mariscos":IMG_OST, "Para picar":IMG_PAQ };
const IMG_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23dcebf5'/%3E%3Ctext x='200' y='215' font-size='120' text-anchor='middle'%3E%F0%9F%90%9F%3C/text%3E%3C/svg%3E";

// Mismos valores que el sitio; se sobrescriben con store_config al cargar.
let WHATSAPP="56997463689", FREE_SHIP=35000, SHIP_COST=3990;
const CART_KEY="mb_cart_v1";
const GREET="¡Hola Mercado Barranca! Quiero hacer un pedido 🐟";

const sb = window.supabase && !SUPABASE_URL.startsWith("TU_")
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ---------- carrito (compartido con el sitio vía localStorage) ----------
function loadCart(){
  try{
    const raw=JSON.parse(localStorage.getItem(CART_KEY)||"{}"), out={};
    for(const [k,q] of Object.entries(raw)) if(Number.isFinite(+q)&&+q>0) out[k]=Math.min(99,Math.floor(+q));
    return out;
  }catch(e){ return {}; }
}
function saveCart(c){ try{ localStorage.setItem(CART_KEY,JSON.stringify(c)); }catch(e){} }
function pintarContador(){
  const c=loadCart();
  $("cnt").textContent=Object.values(c).reduce((a,b)=>a+b,0);
}
pintarContador();

let tt;
function toast(msg){
  $("toastMsg").textContent=msg; $("toast").classList.add("show");
  clearTimeout(tt); tt=setTimeout(()=>$("toast").classList.remove("show"),4000);
}

// Misma regla de unidades que el sitio: "/ kg" solo cuando el precio es por kilo.
function priceInfo(p){
  const r=(()=>{
    if (p.unit) return { unit:p.unit, note:"" };
    const fmt=p.format||"";
    const kg=fmt.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    const gr=fmt.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    const un=fmt.match(/(\d+)\s*(?:und|unid|u)\b/i);
    const grams = kg ? parseFloat(kg[1].replace(",","."))*1000 : gr ? parseFloat(gr[1].replace(",",".")) : null;
    if (grams===1000) return { unit:"kg", note:"" };
    if (grams) return { unit:"c/u", note:CLP(Math.round(p.price/grams*1000))+" por kilo" };
    if (un)    return { unit:"c/u", note:CLP(Math.round(p.price/+un[1]))+" por unidad" };
    return { unit:"c/u", note:"" };
  })();
  return { ...r, label: r.unit==="c/u" ? "c/u" : "/ "+r.unit };
}

const ICON_CHECK = '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 12l5 5L20 6"/></svg>';

// Convierte un texto con saltos de línea en una lista con viñetas
function lista(txt){
  const items=String(txt||"").split("\n").map(s=>s.trim()).filter(Boolean);
  if(!items.length) return "";
  return `<ul>${items.map(i=>`<li>${ICON_CHECK}<span>${esc(i)}</span></li>`).join("")}</ul>`;
}

// ---------- carga ----------
let producto=null, cantidad=1;

async function cargar(){
  // Acepta las dos formas: la URL limpia /producto/<slug> que arma nginx,
  // y ?p=<slug> por si se abre el archivo directamente.
  const params=new URLSearchParams(location.search);
  const enRuta=location.pathname.match(/\/producto\/([a-z0-9-]+)\/?$/i);
  const slug=(enRuta ? enRuta[1] : params.get("p")), id=params.get("id");
  if(!slug && !id) return error("No indicaste qué producto ver.");
  if(!sb) return error("El sitio no está conectado a la base de datos.");

  try{
    const q = sb.from("products").select("*").eq("active",true);
    const { data, error:err } = await (slug ? q.eq("slug",slug) : q.eq("id",id)).maybeSingle();
    if(err) throw err;
    if(!data) return error("No encontramos este producto. Puede que ya no esté disponible.");
    producto=data;

    const { data:cfg } = await sb.from("store_config").select("*").eq("id",1).maybeSingle();
    if(cfg){
      WHATSAPP=cfg.whatsapp||WHATSAPP;
      FREE_SHIP=cfg.free_ship_threshold||FREE_SHIP;
      SHIP_COST=cfg.ship_cost??SHIP_COST;
      if(cfg.announcement) $("ann1").textContent=cfg.announcement;
      if(cfg.announcement_2) $("ann2").textContent=cfg.announcement_2;
    }
    pintar();
  }catch(e){
    console.warn(e);
    error("No pudimos cargar el producto. Revisa tu conexión e inténtalo de nuevo.");
  }
}

function error(msg){
  $("main").innerHTML=`<div class="state">
    <h2 class="serif">Producto no disponible</h2>
    <p>${esc(msg)}</p>
    <a class="btn btn-primary" href="/#productos">Ver todos los productos</a>
  </div>`;
}

function pintar(){
  const p=producto;
  document.title = p.name + " · Mercado Barranca";

  // Dirección propia de esta ficha, para que Google la indexe por separado.
  if (p.slug){
    let link=document.querySelector('link[rel="canonical"]');
    if(!link){ link=document.createElement("link"); link.rel="canonical"; document.head.appendChild(link); }
    link.href = "https://mercadobarranca.cl/producto/" + p.slug;
  }

  const principalSrc = p.image_url || CAT_IMG[p.category] || IMG_FALLBACK;
  const fotos=[principalSrc].concat(Array.isArray(p.gallery)?p.gallery:[]).filter(Boolean);
  const principal = fotos[0];
  // La ficha muestra 4 espacios: los que falten quedan marcados como pendientes.
  const slots=[];
  for(let i=0;i<4;i++){
    slots.push(fotos[i]
      ? `<button class="thumb${i===0?" on":""}" data-src="${esc(fotos[i])}" aria-label="Ver imagen ${i+1}"><img src="${esc(fotos[i])}" alt=""></button>`
      : `<span class="thumb empty">Foto<br>pendiente</span>`);
  }

  const {label,note}=priceInfo(p);
  const oferta = p.compare_at_price && p.compare_at_price>p.price;
  const dcto = oferta ? Math.round((1-p.price/p.compare_at_price)*100) : 0;
  const falta = Math.max(0, FREE_SHIP-p.price);

  $("main").innerHTML=`
    <nav class="crumbs" aria-label="Migas de pan">
      <a href="/">Inicio</a><span class="sep">/</span>
      <a href="/#productos">${esc(p.category)}</a><span class="sep">/</span>
      <span>${esc(p.name)}</span>
    </nav>

    <div class="pdp">
      <div class="gallery">
        <div class="gmain">
          ${p.badge?`<span class="badge ${p.badge==='of'?'of':'nv'}">${p.badge==='of'?'Oferta':'Nuevo'}</span>`:""}
          <img id="gmainImg" src="${esc(principal)}" alt="${esc(p.name)}">
        </div>
        <div class="thumbs" id="thumbs">${slots.join("")}</div>
      </div>

      <div class="info">
        <div class="cat-tag">${esc(p.category)}</div>
        <h1 class="serif">${esc(p.name)}</h1>
        ${p.format?`<div class="fmt">${esc(p.format)}</div>`:""}

        <div class="price-row">
          <span class="price-now">${CLP(p.price)}</span>
          <span style="color:var(--dim);font-size:.9rem">${esc(label)}</span>
          ${oferta?`<span class="price-was">${CLP(p.compare_at_price)}</span><span class="price-off">-${dcto}%</span>`:""}
        </div>
        ${note?`<div class="price-unit">${esc(note)}</div>`:""}

        <div class="buy">
          <div class="qty">
            <button id="menos" aria-label="Quitar uno">−</button>
            <span id="qty">1</span>
            <button id="mas" aria-label="Agregar uno">+</button>
          </div>
          <button class="btn btn-primary" id="addBtn">Agregar al carrito</button>
        </div>

        <div class="ship-note">
          <div><span class="ic">🚚</span><span>Envío gratis en compras sobre <b>${CLP(FREE_SHIP)}</b>. Bajo ese monto, el despacho cuesta ${CLP(SHIP_COST)}.${falta>0?` Te faltan <b>${CLP(falta)}</b> con este producto.`:""}</span></div>
          <div><span class="ic">❄️</span><span>Cadena de frío desde la bodega hasta tu puerta, solo en la Región Metropolitana.</span></div>
          <div><span class="ic">💬</span><span>El pedido se coordina y se paga por WhatsApp.</span></div>
        </div>

        <dl class="meta">
          ${p.sku?`<div><dt>SKU</dt><dd>${esc(p.sku)}</dd></div>`:""}
          <div><dt>Categoría</dt><dd>${esc(p.category)}</dd></div>
          ${p.format?`<div><dt>Formato</dt><dd>${esc(p.format)}</dd></div>`:""}
          <div><dt>Estado</dt><dd style="color:var(--green);font-weight:600">Disponible</dd></div>
        </dl>
      </div>
    </div>

    <div class="details">
      ${p.description?`<div class="block wide"><h2 class="serif">Descripción</h2><p>${esc(p.description)}</p></div>`:""}
      ${p.features?`<div class="block"><h2 class="serif">Características</h2>${lista(p.features)}</div>`:""}
      ${p.recommendations?`<div class="block"><h2 class="serif">Recomendaciones</h2>${lista(p.recommendations)}</div>`:""}
    </div>`;

  // galería
  $("thumbs").addEventListener("click",e=>{
    const b=e.target.closest("[data-src]"); if(!b) return;
    $("gmainImg").src=b.dataset.src;
    document.querySelectorAll(".thumb").forEach(t=>t.classList.toggle("on",t===b));
  });

  // cantidad
  $("mas").onclick   = ()=>{ cantidad=Math.min(99,cantidad+1); $("qty").textContent=cantidad; };
  $("menos").onclick = ()=>{ cantidad=Math.max(1,cantidad-1);  $("qty").textContent=cantidad; };

  // agregar al carrito (misma clave que usa el sitio)
  $("addBtn").onclick=()=>{
    const cart=loadCart(), key="id:"+p.id;
    cart[key]=Math.min(99,(cart[key]||0)+cantidad);
    saveCart(cart); pintarContador();
    toast(`${cantidad}× ${p.name} · agregado`);
  };
}

// WhatsApp
function abrirWhatsApp(txt){
  const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  const w=window.open(url,"_blank","noopener"); if(!w) location.href=url;
}
$("waBtn").addEventListener("click",e=>{e.preventDefault();abrirWhatsApp(GREET);});
document.addEventListener("click",e=>{
  const a=e.target.closest(".wa-ask"); if(!a) return;
  e.preventDefault(); abrirWhatsApp(a.dataset.ask||GREET);
});

cargar();