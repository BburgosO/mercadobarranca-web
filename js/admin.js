// ============ CONFIG SUPABASE ============
// Pega aquí lo mismo que pusiste en mercado-barranca-web_1.html
const SUPABASE_URL      = "https://gdgayzqhrpdvcpyfckwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2F5enFocnBkdmNweWZja3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzczMzcsImV4cCI6MjEwMTU1MzMzN30.3XQBmr4o71RajaUEZZDEkJnnMDs0HP2kqC8yLy0Qs0w";
// =========================================

const CATEGORIAS = ["Salmón","Camarones","Pescados","Mariscos","Para picar"];
const ESTADOS    = ["nuevo","contactado","preparando","despachado","entregado","anulado"];
const MAX_IMG_MB = 3;

const $  = id => document.getElementById(id);
const CLP = n => "$" + Number(n||0).toLocaleString("es-CL");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const fecha = s => new Date(s).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});

let tt;
function toast(msg, bad){
  const t=$("toast"); t.textContent=msg; t.classList.toggle("bad",!!bad); t.classList.add("show");
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove("show"), bad?4200:2400);
}

// ---------- arranque ----------
if (!SUPABASE_URL || SUPABASE_URL.startsWith("TU_")){
  $("setup").style.display="block";
  throw new Error("Panel sin configurar");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let sesion = null;

(async function init(){
  const { data:{ session } } = await sb.auth.getSession();
  if (session) await entrar(session); else mostrarLogin();
})();

function mostrarLogin(){
  $("login").style.display="flex";
  $("app").classList.remove("on");
}

// Tener sesión no basta: hay que estar en la tabla admins.
async function entrar(session){
  const { data:esAdmin, error } = await sb.rpc("is_admin");
  if (error || !esAdmin){
    await sb.auth.signOut();
    mostrarLogin();
    mensajeLogin("Esta cuenta no tiene permisos de administrador.");
    return;
  }
  sesion = session;
  $("login").style.display="none";
  $("app").classList.add("on");
  $("userEmail").textContent = session.user.email;
  cargarProductos(); cargarBanners(); cargarCategorias(); cargarTestimonios(); cargarEncabezadoCats(); cargarConfig(); cargarPedidos();
}

function mensajeLogin(txt){
  const m=$("loginMsg"); m.textContent=txt; m.classList.add("on");
}

$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const btn=$("loginBtn"); btn.disabled=true; btn.textContent="Entrando…";
  $("loginMsg").classList.remove("on");
  const { data, error } = await sb.auth.signInWithPassword({ email:$("email").value.trim(), password:$("pass").value });
  btn.disabled=false; btn.textContent="Entrar";
  if (error){ mensajeLogin(error.message==="Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message); return; }
  $("pass").value="";
  await entrar(data.session);
});

$("logout").addEventListener("click", async ()=>{ await sb.auth.signOut(); location.reload(); });

// ---------- pestañas ----------
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("nav.tabs button").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on", v.id==="v-"+b.dataset.view));
}));


// =====================================================================
//  PRODUCTOS
// =====================================================================
let productos = [];

// Los id vienen de la base como uuid, pero al leerlos de un data-* siempre son texto.
// Comparar con String() evita que un cambio de tipo rompa el guardado en silencio.
const buscarProd = id => productos.find(x => String(x.id) === String(id));

async function cargarProductos(){
  const { data, error } = await sb.from("products").select("*").order("sort_order").order("id");
  if (error){ $("prodBody").innerHTML=`<tr><td colspan="9" class="loading">Error: ${esc(error.message)}</td></tr>`; return; }
  productos = data;
  pintarProductos();
}

function pintarProductos(){
  const body=$("prodBody");
  if (!productos.length){ body.innerHTML=`<tr><td colspan="9" class="loading">Sin productos. Crea el primero.</td></tr>`; return; }
  body.innerHTML = productos.map(p=>`
    <tr data-id="${p.id}" class="${p.active?"":"off"}">
      <td>${p.image_url
        ? `<img class="thumb" src="${esc(p.image_url)}" alt="" data-foto="${p.id}" title="Cambiar foto">`
        : `<div class="thumb thumb-empty" data-foto="${p.id}" title="Subir foto">Subir<br>foto</div>`}</td>
      <td><input data-f="name" value="${esc(p.name)}" placeholder="Nombre"></td>
      <td><select data-f="category" class="w-sel">${CATEGORIAS.map(c=>`<option${c===p.category?" selected":""}>${esc(c)}</option>`).join("")}</select></td>
      <td><input data-f="format" value="${esc(p.format)}" placeholder="Bolsa 1 kg"></td>
      <td><input data-f="price" class="w-price" type="number" min="0" step="10" value="${p.price}"></td>
      <td><select data-f="badge" class="w-sel">
            <option value=""${p.badge===""?" selected":""}>Sin etiqueta</option>
            <option value="of"${p.badge==="of"?" selected":""}>Oferta</option>
            <option value="nv"${p.badge==="nv"?" selected":""}>Nuevo</option>
          </select></td>
      <td><input data-f="sort_order" class="w-num" type="number" step="10" value="${p.sort_order}"></td>
      <td><label class="sw"><input type="checkbox" data-f="active"${p.active?" checked":""}><span></span></label></td>
      <td class="acts">
        <button class="btn btn-ghost btn-sm" data-ficha="${p.id}">Ficha</button>
        <button class="btn btn-primary btn-sm" data-save="${p.id}" disabled>Guardar</button>
        <button class="btn btn-danger btn-sm" data-del="${p.id}">Borrar</button>
      </td>
    </tr>
    <tr class="ficha" data-ficha-row="${p.id}"><td colspan="9">${filaFicha(p)}</td></tr>`).join("");
}

// Contenido de la ficha: lo que se ve en producto.html
function filaFicha(p){
  const gal = Array.isArray(p.gallery) ? p.gallery : [];
  const slots = [0,1,2].map(i => gal[i]
    ? `<div class="slot" data-gal="${p.id}" data-slot="${i}" title="Reemplazar foto ${i+2}">
         <img src="${esc(gal[i])}" alt=""><button class="quitar" data-galdel="${p.id}" data-slot="${i}" title="Quitar">×</button></div>`
    : `<div class="slot" data-gal="${p.id}" data-slot="${i}" title="Subir foto ${i+2}"><span>Foto ${i+2}</span></div>`
  ).join("");

  return `
    <div class="ficha-grid">
      <div class="full">
        <label>Descripción</label>
        <textarea data-ff="description" placeholder="Qué es el producto y por qué conviene.">${esc(p.description)}</textarea>
      </div>
      <div>
        <label>Características</label>
        <textarea data-ff="features" placeholder="Una por línea">${esc(p.features)}</textarea>
        <div class="nota">Una por línea. Cada línea sale como viñeta en la ficha.</div>
      </div>
      <div>
        <label>Recomendaciones</label>
        <textarea data-ff="recommendations" placeholder="Una por línea">${esc(p.recommendations)}</textarea>
        <div class="nota">Descongelado, cocción, conservación.</div>
      </div>
      <div>
        <label>SKU</label>
        <input data-ff="sku" value="${esc(p.sku)}" placeholder="MB-SAL-001">
      </div>
      <div>
        <label>Precio anterior (para mostrarlo tachado)</label>
        <input data-ff="compare_at_price" type="number" min="0" step="10" value="${p.compare_at_price ?? ""}" placeholder="Vacío = sin oferta">
        <div class="nota">Debe ser mayor al precio actual para que aparezca el descuento.</div>
      </div>
      <div class="full">
        <label>Fotos adicionales de la ficha</label>
        <div class="gal">${slots}</div>
        <div class="nota">La foto principal es la de la columna “Foto”. Estas tres la acompañan en la galería.</div>
      </div>
      <div class="full" style="display:flex;gap:10px;align-items:center">
        <button class="btn btn-primary btn-sm" data-savef="${p.id}">Guardar ficha</button>
        <a class="btn btn-ghost btn-sm" href="/producto/${esc(p.slug||"")}" target="_blank" rel="noopener">Ver ficha</a>
      </div>
    </div>`;
}

// Marcar fila como modificada al tocar cualquier campo
$("prodBody").addEventListener("input", e=>{
  const tr=e.target.closest("tr[data-id]"); if(!tr||!e.target.dataset.f) return;
  tr.classList.add("dirty");
  tr.querySelector("[data-save]").disabled=false;
});
$("prodBody").addEventListener("change", e=>{
  const tr=e.target.closest("tr[data-id]"); if(!tr||!e.target.dataset.f) return;
  tr.classList.add("dirty");
  tr.querySelector("[data-save]").disabled=false;
});

$("prodBody").addEventListener("click", async e=>{
  const save=e.target.closest("[data-save]"), del=e.target.closest("[data-del]"), foto=e.target.closest("[data-foto]");
  const ficha=e.target.closest("[data-ficha]"), savef=e.target.closest("[data-savef]");
  const gal=e.target.closest("[data-gal]"), galdel=e.target.closest("[data-galdel]");

  if (galdel){ e.stopPropagation(); return quitarFoto(galdel.dataset.galdel, +galdel.dataset.slot); }
  if (gal)   return pedirFoto(gal.dataset.gal, "producto", +gal.dataset.slot);
  if (foto)  return pedirFoto(foto.dataset.foto);
  if (del)   return borrarProducto(del.dataset.del);
  if (save)  return guardarProducto(save.dataset.save, save);
  if (savef) return guardarFicha(savef.dataset.savef, savef);
  if (ficha){
    const row=$("prodBody").querySelector(`tr[data-ficha-row="${ficha.dataset.ficha}"]`);
    const abierta=row.classList.toggle("open");
    ficha.textContent = abierta ? "Cerrar" : "Ficha";
    if (abierta) row.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
});

async function guardarFicha(id, btn){
  const row=$("prodBody").querySelector(`tr[data-ficha-row="${id}"]`);
  const v={};
  row.querySelectorAll("[data-ff]").forEach(el=>{
    v[el.dataset.ff] = el.dataset.ff==="compare_at_price"
      ? (el.value.trim()==="" ? null : Number(el.value))
      : el.value.trim();
  });
  const p=buscarProd(id);
  if (!p){ toast("No encontramos el producto. Recarga la lista.", true); return; }
  if (v.compare_at_price!=null && v.compare_at_price<=p.price){
    toast("El precio anterior debe ser mayor al precio actual", true); return;
  }
  btn.disabled=true; btn.textContent="Guardando…";
  const { error } = await sb.from("products").update(v).eq("id", id);
  btn.disabled=false; btn.textContent="Guardar ficha";
  if (error){ toast("No se pudo guardar: "+error.message, true); return; }
  Object.assign(p, v);
  toast("Ficha guardada");
}

async function quitarFoto(id, slot){
  const p=productos.find(x=>x.id===id);
  const gal=(Array.isArray(p.gallery)?p.gallery:[]).slice();
  gal.splice(slot,1);
  const { error } = await sb.from("products").update({ gallery: gal }).eq("id", id);
  if (error){ toast("No se pudo quitar: "+error.message, true); return; }
  p.gallery=gal;
  const row=$("prodBody").querySelector(`tr[data-ficha-row="${id}"]`);
  const abierta=row.classList.contains("open");
  pintarProductos();
  if (abierta){
    const r=$("prodBody").querySelector(`tr[data-ficha-row="${id}"]`);
    r.classList.add("open");
    $("prodBody").querySelector(`[data-ficha="${id}"]`).textContent="Cerrar";
  }
  toast("Foto quitada");
}

function leerFila(tr){
  const v={};
  tr.querySelectorAll("[data-f]").forEach(el=>{
    v[el.dataset.f] = el.type==="checkbox" ? el.checked
                    : el.type==="number"   ? Number(el.value||0)
                    : el.value.trim();
  });
  return v;
}

async function guardarProducto(id, btn){
  const tr=$("prodBody").querySelector(`tr[data-id="${id}"]`);
  const v=leerFila(tr);
  if (!v.name){ toast("El producto necesita un nombre", true); return; }
  if (v.price < 0){ toast("El precio no puede ser negativo", true); return; }
  btn.disabled=true; btn.textContent="…";
  const { error } = await sb.from("products").update(v).eq("id", id);
  btn.textContent="Guardar";
  if (error){ btn.disabled=false; toast("No se pudo guardar: "+error.message, true); return; }
  tr.classList.remove("dirty");
  tr.classList.toggle("off", !v.active);
  Object.assign(buscarProd(id), v);
  toast(v.name+" · guardado");
}

async function borrarProducto(id){
  const p=productos.find(x=>x.id===id);
  if (!confirm(`¿Borrar "${p.name}" definitivamente?\n\nSi solo quieres sacarlo de la web por ahora, apaga el interruptor "Activo" en vez de borrarlo.`)) return;
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error){ toast("No se pudo borrar: "+error.message, true); return; }
  productos = productos.filter(x=>String(x.id)!==String(id));
  pintarProductos();
  toast("Producto borrado");
}

$("newProd").addEventListener("click", async ()=>{
  const orden = productos.length ? Math.max(...productos.map(p=>p.sort_order))+10 : 10;
  const { data, error } = await sb.from("products")
    .insert({ name:"Producto nuevo", category:"Pescados", format:"Bolsa 1 kg", price:0, sort_order:orden, active:false })
    .select().single();
  if (error){ toast("No se pudo crear: "+error.message, true); return; }
  productos.push(data);
  pintarProductos();
  const tr=$("prodBody").querySelector(`tr[data-id="${data.id}"]`);
  tr.scrollIntoView({behavior:"smooth", block:"center"});
  tr.querySelector('[data-f="name"]').select();
  toast("Creado como inactivo: complétalo y actívalo");
});

$("reloadProd").addEventListener("click", ()=>{ cargarProductos(); toast("Lista actualizada"); });


// =====================================================================
//  FOTOS · suben a Storage y guardan la URL pública
// =====================================================================
let fotoDestino = null;   // {tipo:'producto'|'banner', id, slot} · slot null = foto principal

function pedirFoto(id, tipo, slot){
  fotoDestino = { tipo: tipo||"producto", id, slot: (slot===undefined ? null : slot) };
  $("filePicker").value="";
  $("filePicker").click();
}

$("filePicker").addEventListener("change", async e=>{
  const file=e.target.files[0]; if(!file||!fotoDestino) return;
  if (!file.type.startsWith("image/")){ toast("Ese archivo no es una imagen", true); return; }
  if (file.size > MAX_IMG_MB*1024*1024){ toast(`La imagen pesa más de ${MAX_IMG_MB} MB. Redúcela antes de subirla.`, true); return; }

  toast("Subiendo imagen…");
  const ext = (file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ruta = `${fotoDestino.tipo}-${fotoDestino.id}-${Date.now()}.${ext}`;

  const { error:upErr } = await sb.storage.from("productos").upload(ruta, file, { upsert:true, cacheControl:"3600" });
  if (upErr){ toast("No se pudo subir: "+upErr.message, true); return; }

  const { data:{ publicUrl } } = sb.storage.from("productos").getPublicUrl(ruta);
  const tabla = fotoDestino.tipo==="banner" ? "banners"
              : fotoDestino.tipo==="categoria" ? "categories" : "products";

  // Las fotos de la galería van al array; el resto reemplaza la imagen principal.
  let cambio;
  if (tabla==="products" && fotoDestino.slot!==null){
    const p=buscarProd(fotoDestino.id);
    const gal=(Array.isArray(p.gallery)?p.gallery:[]).slice();
    gal[fotoDestino.slot]=publicUrl;
    cambio={ gallery: gal.filter(Boolean) };
  } else {
    cambio={ image_url: publicUrl };
  }

  const { error } = await sb.from(tabla).update(cambio).eq("id", fotoDestino.id);
  if (error){ toast("Subió la imagen pero no se pudo guardar: "+error.message, true); return; }

  if (tabla==="products"){
    const p=buscarProd(fotoDestino.id);
    Object.assign(p, cambio);
    const abierta=$("prodBody").querySelector(`tr[data-ficha-row="${p.id}"]`)?.classList.contains("open");
    pintarProductos();
    if (abierta){
      $("prodBody").querySelector(`tr[data-ficha-row="${p.id}"]`).classList.add("open");
      $("prodBody").querySelector(`[data-ficha="${p.id}"]`).textContent="Cerrar";
    }
  } else if (tabla==="categories"){
    Object.assign(buscarCat(fotoDestino.id), cambio);
    pintarCategorias();
  } else {
    Object.assign(banners.find(b=>b.id===fotoDestino.id), cambio);
    pintarBanners();
  }
  toast("Imagen actualizada");
});


// =====================================================================
//  BANNERS
// =====================================================================
let banners = [];

async function cargarBanners(){
  const { data, error } = await sb.from("banners").select("*").order("sort_order").order("id");
  if (error){ $("bannerList").innerHTML=`<div class="empty">Error: ${esc(error.message)}</div>`; return; }
  banners = data; pintarBanners();
}

function pintarBanners(){
  const box=$("bannerList");
  if (!banners.length){ box.innerHTML=`<div class="empty">Sin banners. El sitio usará los de ejemplo.</div>`; return; }
  box.innerHTML = banners.map(b=>`
    <div class="card" data-bid="${b.id}">
      <div class="grid2">
        <div class="field"><label>Bajada superior</label><input data-f="kicker" value="${esc(b.kicker)}" placeholder="Mercado Barranca"></div>
        <div class="field"><label>Texto del botón</label><input data-f="cta_text" value="${esc(b.cta_text)}"></div>
      </div>
      <div class="field"><label>Título · usa &lt;em&gt; para la cursiva naranja</label>
        <input data-f="title" value="${esc(b.title)}" placeholder="Del mayorista <em>a tu mesa</em>"></div>
      <div class="field"><label>Subtítulo</label><textarea data-f="subtitle" rows="2">${esc(b.subtitle)}</textarea></div>
      <div class="grid3">
        <div class="field"><label>Enlace del botón</label><input data-f="cta_link" value="${esc(b.cta_link)}"></div>
        <div class="field"><label>Orden</label><input data-f="sort_order" type="number" step="10" value="${b.sort_order}"></div>
        <div class="field"><label>Imagen de fondo</label>
          <button class="btn btn-ghost btn-sm" style="width:100%" data-bfoto="${b.id}">${b.image_url?"Cambiar imagen":"Subir imagen"}</button></div>
      </div>
      <div class="card-foot">
        <label class="sw" title="Visible en la web"><input type="checkbox" data-f="active"${b.active?" checked":""}><span></span></label>
        <span style="font-size:.78rem;color:var(--dim2)">Visible</span>
        <span class="sp"></span>
        <button class="btn btn-danger btn-sm" data-bdel="${b.id}">Borrar</button>
        <button class="btn btn-primary btn-sm" data-bsave="${b.id}" disabled>Guardar</button>
      </div>
    </div>`).join("");
}

$("bannerList").addEventListener("input", e=>{
  const c=e.target.closest("[data-bid]"); if(!c||!e.target.dataset.f) return;
  c.classList.add("dirty"); c.querySelector("[data-bsave]").disabled=false;
});
$("bannerList").addEventListener("change", e=>{
  const c=e.target.closest("[data-bid]"); if(!c||!e.target.dataset.f) return;
  c.classList.add("dirty"); c.querySelector("[data-bsave]").disabled=false;
});

$("bannerList").addEventListener("click", async e=>{
  const save=e.target.closest("[data-bsave]"), del=e.target.closest("[data-bdel]"), foto=e.target.closest("[data-bfoto]");
  if (foto) return pedirFoto(foto.dataset.bfoto, "banner");
  if (del){
    if (!confirm("¿Borrar este banner?")) return;
    const { error } = await sb.from("banners").delete().eq("id", del.dataset.bdel);
    if (error){ toast("No se pudo borrar: "+error.message, true); return; }
    banners = banners.filter(b=>b.id!==del.dataset.bdel); pintarBanners(); toast("Banner borrado");
  }
  if (save){
    const id=save.dataset.bsave, card=save.closest("[data-bid]");
    const v={}; card.querySelectorAll("[data-f]").forEach(el=>{
      v[el.dataset.f] = el.type==="checkbox" ? el.checked : el.type==="number" ? Number(el.value||0) : el.value.trim();
    });
    save.disabled=true; save.textContent="…";
    const { error } = await sb.from("banners").update(v).eq("id", id);
    save.textContent="Guardar";
    if (error){ save.disabled=false; toast("No se pudo guardar: "+error.message, true); return; }
    card.classList.remove("dirty");
    Object.assign(banners.find(b=>b.id===id), v);
    toast("Banner guardado");
  }
});

// Encabezados de sección (viven en store_config, se editan aquí)
const ENCABEZADOS = [
  { pref:"cfgCats",  campos:{kicker:"cats_kicker",  title:"cats_title",  subtitle:"cats_subtitle"},  boton:"saveCatsHead" },
  { pref:"cfgProds", campos:{kicker:"prods_kicker", title:"prods_title", subtitle:"prods_subtitle"}, boton:"saveProdsHead" }
];

async function cargarEncabezadoCats(){
  const { data } = await sb.from("store_config").select("*").eq("id",1).single();
  if(!data) return;
  for(const e of ENCABEZADOS){
    $(e.pref+"Kicker").value   = data[e.campos.kicker]   || "";
    $(e.pref+"Title").value    = data[e.campos.title]    || "";
    $(e.pref+"Subtitle").value = data[e.campos.subtitle] || "";
  }
}

for(const e of ENCABEZADOS){
  $(e.boton).addEventListener("click", async () => {
    const btn = $(e.boton);
    const titulo = $(e.pref+"Title").value.trim();
    if(!titulo){ toast("El título no puede quedar vacío", true); $(e.pref+"Title").focus(); return; }
    const cambio = {};
    cambio[e.campos.kicker]   = $(e.pref+"Kicker").value.trim();
    cambio[e.campos.title]    = titulo;
    cambio[e.campos.subtitle] = $(e.pref+"Subtitle").value.trim();
    btn.disabled = true; btn.textContent = "Guardando…";
    const { error } = await sb.from("store_config").update(cambio).eq("id", 1);
    btn.disabled = false; btn.textContent = "Guardar encabezado";
    if(error){ toast("No se pudo guardar: "+error.message, true); return; }
    toast("Encabezado guardado");
  });
}

$("newBanner").addEventListener("click", async ()=>{
  const orden = banners.length ? Math.max(...banners.map(b=>b.sort_order))+10 : 10;
  const { data, error } = await sb.from("banners")
    .insert({ kicker:"Mercado Barranca", title:"Título del banner", subtitle:"", sort_order:orden, active:false })
    .select().single();
  if (error){ toast("No se pudo crear: "+error.message, true); return; }
  banners.push(data); pintarBanners(); toast("Banner creado como oculto");
});


// =====================================================================
//  CATEGORÍAS · las tarjetas del bloque "Compra por categoría"
// =====================================================================
let categorias = [];
const buscarCat = id => categorias.find(x => String(x.id) === String(id));

async function cargarCategorias(){
  const { data, error } = await sb.from("categories").select("*").order("sort_order").order("name");
  if (error){ $("catBody").innerHTML = '<tr><td colspan="8" class="loading">Error: '+esc(error.message)+'</td></tr>'; return; }
  categorias = data;
  pintarCategorias();
}

function pintarCategorias(){
  const body = $("catBody");
  if (!categorias.length){ body.innerHTML = '<tr><td colspan="8" class="loading">Sin categorías. Crea la primera.</td></tr>'; return; }
  body.innerHTML = categorias.map(c => `
    <tr data-cid="${c.id}" class="${c.active?"":"off"}">
      <td>${c.image_url
        ? `<img class="thumb" src="${esc(c.image_url)}" alt="" data-cfoto="${c.id}" title="Cambiar foto">`
        : `<div class="thumb thumb-empty" data-cfoto="${c.id}" title="Subir foto">Subir<br>foto</div>`}</td>
      <td><input data-cf="name" value="${esc(c.name)}" placeholder="Salmón"></td>
      <td><input data-cf="kicker" value="${esc(c.kicker)}" placeholder="Atlántico chileno"></td>
      <td><input data-cf="link" value="${esc(c.link)}" placeholder="#productos"></td>
      <td style="text-align:center"><label class="sw" title="Ocupa el doble de espacio en el mosaico"><input type="checkbox" data-cf="featured"${c.featured?" checked":""}><span></span></label></td>
      <td><input data-cf="sort_order" class="w-num" type="number" step="10" value="${c.sort_order}"></td>
      <td><label class="sw"><input type="checkbox" data-cf="active"${c.active?" checked":""}><span></span></label></td>
      <td class="acts">
        <button class="btn btn-primary btn-sm" data-csave="${c.id}" disabled>Guardar</button>
        <button class="btn btn-danger btn-sm" data-cdel="${c.id}">Borrar</button>
      </td>
    </tr>`).join("");
}

$("catBody").addEventListener("input", e => marcarCat(e));
$("catBody").addEventListener("change", e => marcarCat(e));
function marcarCat(e){
  const tr = e.target.closest("tr[data-cid]");
  if (!tr || !e.target.dataset.cf) return;
  tr.classList.add("dirty");
  tr.querySelector("[data-csave]").disabled = false;
}

$("catBody").addEventListener("click", async e => {
  const save = e.target.closest("[data-csave]"),
        del  = e.target.closest("[data-cdel]"),
        foto = e.target.closest("[data-cfoto]");
  if (foto) return pedirFoto(foto.dataset.cfoto, "categoria");
  if (del)  return borrarCategoria(del.dataset.cdel);
  if (save) return guardarCategoria(save.dataset.csave, save);
});

async function guardarCategoria(id, btn){
  const tr = $("catBody").querySelector('tr[data-cid="'+id+'"]');
  const v = {};
  tr.querySelectorAll("[data-cf]").forEach(el => {
    v[el.dataset.cf] = el.type === "checkbox" ? el.checked
                     : el.type === "number"   ? Number(el.value||0)
                     : el.value.trim();
  });
  if (!v.name){ toast("La categoría necesita un nombre", true); return; }
  btn.disabled = true; btn.textContent = "…";
  const { error } = await sb.from("categories").update(v).eq("id", id);
  btn.textContent = "Guardar";
  if (error){ btn.disabled = false; toast("No se pudo guardar: "+error.message, true); return; }
  tr.classList.remove("dirty");
  tr.classList.toggle("off", !v.active);
  Object.assign(buscarCat(id), v);
  toast(v.name+" · guardada");
}

async function borrarCategoria(id){
  const c = buscarCat(id);
  if (!confirm('¿Borrar la categoría "'+c.name+'"? Si solo quieres sacarla de la portada, apaga el interruptor "Activa".')) return;
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error){ toast("No se pudo borrar: "+error.message, true); return; }
  categorias = categorias.filter(x => String(x.id) !== String(id));
  pintarCategorias();
  toast("Categoría borrada");
}

$("newCat").addEventListener("click", async () => {
  const orden = categorias.length ? Math.max(...categorias.map(c => c.sort_order)) + 10 : 10;
  const { data, error } = await sb.from("categories")
    .insert({ name:"Categoría nueva", kicker:"", sort_order:orden, active:false })
    .select().single();
  if (error){ toast("No se pudo crear: "+error.message, true); return; }
  categorias.push(data);
  pintarCategorias();
  const tr = $("catBody").querySelector('tr[data-cid="'+data.id+'"]');
  tr.scrollIntoView({behavior:"smooth", block:"center"});
  tr.querySelector('[data-cf="name"]').select();
  toast("Creada como inactiva: complétala y actívala");
});

$("reloadCats").addEventListener("click", () => { cargarCategorias(); toast("Lista actualizada"); });

// =====================================================================
//  TESTIMONIOS
// =====================================================================
let testimonios = [];
const buscarTesti = id => testimonios.find(t => String(t.id) === String(id));

async function cargarTestimonios(){
  const { data, error } = await sb.from("testimonials").select("*").order("sort_order");
  if (error){ $("testiList").innerHTML = '<div class="empty">Error: '+esc(error.message)+'</div>'; return; }
  testimonios = data; pintarTestimonios();
}

function pintarTestimonios(){
  const box = $("testiList");
  if (!testimonios.length){ box.innerHTML = '<div class="empty">Sin testimonios. Crea el primero.</div>'; return; }
  box.innerHTML = testimonios.map(t => `
    <div class="card" data-tid="${t.id}">
      <div class="field">
        <label>Testimonio</label>
        <textarea data-tf="quote" rows="3" placeholder="Lo que dijo el cliente">${esc(t.quote)}</textarea>
      </div>
      <div class="grid3">
        <div class="field"><label>Nombre</label><input data-tf="author" value="${esc(t.author)}" placeholder="Carolina M."></div>
        <div class="field"><label>Comuna</label><input data-tf="location" value="${esc(t.location)}" placeholder="Ñuñoa"></div>
        <div class="field"><label>Orden</label><input data-tf="sort_order" type="number" step="10" value="${t.sort_order}"></div>
      </div>
      <div class="card-foot">
        <label class="sw" title="Visible en la portada"><input type="checkbox" data-tf="active"${t.active?" checked":""}><span></span></label>
        <span style="font-size:.78rem;color:var(--dim2)">Visible</span>
        <label class="sw" style="margin-left:16px" title="Marca que no es una reseña real"><input type="checkbox" data-tf="is_sample"${t.is_sample?" checked":""}><span></span></label>
        <span style="font-size:.78rem;color:var(--dim2)">De muestra</span>
        <span class="sp"></span>
        <button class="btn btn-danger btn-sm" data-tdel="${t.id}">Borrar</button>
        <button class="btn btn-primary btn-sm" data-tsave="${t.id}" disabled>Guardar</button>
      </div>
    </div>`).join("");
}

$("testiList").addEventListener("input", e => marcarTesti(e));
$("testiList").addEventListener("change", e => marcarTesti(e));
function marcarTesti(e){
  const c = e.target.closest("[data-tid]");
  if (!c || !e.target.dataset.tf) return;
  c.classList.add("dirty");
  c.querySelector("[data-tsave]").disabled = false;
}

$("testiList").addEventListener("click", async e => {
  const save = e.target.closest("[data-tsave]"), del = e.target.closest("[data-tdel]");
  if (del){
    const t = buscarTesti(del.dataset.tdel);
    if (!confirm('¿Borrar el testimonio de '+t.author+'?')) return;
    const { error } = await sb.from("testimonials").delete().eq("id", del.dataset.tdel);
    if (error){ toast("No se pudo borrar: "+error.message, true); return; }
    testimonios = testimonios.filter(x => String(x.id) !== String(del.dataset.tdel));
    pintarTestimonios(); toast("Testimonio borrado");
  }
  if (save){
    const id = save.dataset.tsave, card = save.closest("[data-tid]");
    const v = {};
    card.querySelectorAll("[data-tf]").forEach(el => {
      v[el.dataset.tf] = el.type === "checkbox" ? el.checked
                       : el.type === "number"   ? Number(el.value||0)
                       : el.value.trim();
    });
    if (!v.quote){ toast("El testimonio no puede quedar vacío", true); return; }
    if (!v.author){ toast("Falta el nombre de quien lo dijo", true); return; }
    save.disabled = true; save.textContent = "…";
    const { error } = await sb.from("testimonials").update(v).eq("id", id);
    save.textContent = "Guardar";
    if (error){ save.disabled = false; toast("No se pudo guardar: "+error.message, true); return; }
    card.classList.remove("dirty");
    Object.assign(buscarTesti(id), v);
    toast("Testimonio guardado");
  }
});

$("newTesti").addEventListener("click", async () => {
  const orden = testimonios.length ? Math.max(...testimonios.map(t => t.sort_order)) + 10 : 10;
  const { data, error } = await sb.from("testimonials")
    .insert({ quote:"", author:"", location:"", sort_order:orden, active:false, is_sample:false })
    .select().single();
  if (error){ toast("No se pudo crear: "+error.message, true); return; }
  testimonios.push(data); pintarTestimonios();
  toast("Creado como oculto: complétalo y actívalo");
});

$("reloadTestis").addEventListener("click", () => { cargarTestimonios(); toast("Lista actualizada"); });

// =====================================================================
//  TIENDA
// =====================================================================
async function cargarConfig(){
  const { data, error } = await sb.from("store_config").select("*").eq("id",1).single();
  if (error){ $("cfgState").textContent="Error: "+error.message; return; }
  $("cfgWa").value=data.whatsapp; $("cfgFree").value=data.free_ship_threshold; $("cfgShip").value=data.ship_cost;
  $("cfgAnn1").value=data.announcement; $("cfgAnn2").value=data.announcement_2;
  $("cfgShowStatus").checked = data.show_status === true;
  $("cfgShowCats").checked = data.show_categories === true;
  $("cfgShowCatalogBtn").checked = data.show_catalog_btn === true;
  $("cfgState").textContent="Actualizado el "+fecha(data.updated_at);
}

$("saveCfg").addEventListener("click", async ()=>{
  const wa=$("cfgWa").value.replace(/\D/g,"");
  if (wa.length < 11){ toast("El WhatsApp debe ir con código de país, ej. 56912345678", true); $("cfgWa").focus(); return; }
  const btn=$("saveCfg"); btn.disabled=true; btn.textContent="Guardando…";
  const { error } = await sb.from("store_config").update({
    whatsapp: wa,
    free_ship_threshold: Number($("cfgFree").value||0),
    ship_cost: Number($("cfgShip").value||0),
    announcement: $("cfgAnn1").value.trim(),
    announcement_2: $("cfgAnn2").value.trim(),
    show_status: $("cfgShowStatus").checked,
    show_categories: $("cfgShowCats").checked,
    show_catalog_btn: $("cfgShowCatalogBtn").checked,
    updated_at: new Date().toISOString()
  }).eq("id",1);
  btn.disabled=false; btn.textContent="Guardar cambios";
  if (error){ toast("No se pudo guardar: "+error.message, true); return; }
  $("cfgWa").value=wa;
  $("cfgState").textContent="Actualizado recién";
  toast("Datos de la tienda guardados");
});


// =====================================================================
//  PEDIDOS
// =====================================================================
let pedidos = [];

async function cargarPedidos(){
  // Los datos de contacto viven en customers, enlazada por customer_id.
  const { data, error } = await sb.from("orders")
    .select("*, customers(name,phone,email,comuna), order_items(*)")
    .order("created_at",{ascending:false}).limit(200);
  if (error){ $("orderList").innerHTML=`<div class="empty">Error: ${esc(error.message)}</div>`; return; }
  pedidos = data; pintarPedidos();
}

function pintarPedidos(){
  const filtro=$("filtroEstado").value;
  const lista=filtro ? pedidos.filter(o=>o.status===filtro) : pedidos;
  const box=$("orderList");
  if (!lista.length){ box.innerHTML=`<div class="empty">${pedidos.length?"Ningún pedido con ese estado.":"Todavía no hay pedidos."}</div>`; return; }
  box.innerHTML = lista.map(o=>{
    const desfase = o.client_total && o.client_total!==o.total;
    const c = o.customers || {};
    return `
    <div class="order" data-oid="${o.id}">
      <div class="order-head">
        <span class="id">#${String(o.id).slice(0,4)}</span>
        <div>
          <div class="cli">${esc(c.name||"(sin nombre)")}</div>
          <div class="meta">${fecha(o.created_at)} · ${o.order_items.length} producto${o.order_items.length===1?"":"s"}</div>
        </div>
        <span class="badge b-${o.status}">${o.status}</span>
        <span class="tot">${CLP(o.total)}</span>
      </div>
      <div class="order-body">
        <div class="contact">
          ${c.phone ? `<span>📱 <a href="https://wa.me/${esc(c.phone.replace(/\D/g,""))}" target="_blank" rel="noopener">${esc(c.phone)}</a></span>` : ""}
          ${c.email ? `<span>✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span>` : ""}
          ${c.comuna ? `<span>📍 ${esc(c.comuna)}</span>` : ""}
        </div>
        <div class="order-items">
          ${o.order_items.map(i=>`<div class="oi"><span><span class="q">${i.qty}×</span>${esc(i.name)}</span><span>${CLP(i.line_total)}</span></div>`).join("")}
        </div>
        <div class="sums">
          <div><span>Subtotal</span><span>${CLP(o.subtotal)}</span></div>
          <div><span>Despacho</span><span>${o.shipping===0?"Gratis":CLP(o.shipping)}</span></div>
          <div class="t"><span>Total</span><span>${CLP(o.total)}</span></div>
        </div>
        ${desfase ? `<div class="msg err on" style="margin-top:12px">El navegador del cliente mostraba ${CLP(o.client_total)}. El total válido es el recalculado en el servidor: ${CLP(o.total)}. Puede ser un precio que cambió mientras compraba.</div>` : ""}
        <div class="card-foot">
          <select data-estado="${o.id}" style="width:auto">
            ${ESTADOS.map(s=>`<option value="${s}"${s===o.status?" selected":""}>${s}</option>`).join("")}
          </select>
          <span class="sp" style="font-size:.78rem;color:var(--dim2)">Cambia el estado para llevar el seguimiento</span>
        </div>
      </div>
    </div>`;}).join("");
}

$("orderList").addEventListener("click", e=>{
  if (e.target.closest("select")) return;
  const head=e.target.closest(".order-head");
  if (head) head.parentElement.classList.toggle("open");
});

$("orderList").addEventListener("change", async e=>{
  const sel=e.target.closest("[data-estado]"); if(!sel) return;
  const id=sel.dataset.estado;
  const { error } = await sb.from("orders").update({ status:sel.value }).eq("id", id);
  if (error){ toast("No se pudo actualizar: "+error.message, true); return; }
  const o=pedidos.find(x=>x.id===id); o.status=sel.value;
  const abierto=[...document.querySelectorAll(".order.open")].map(el=>el.dataset.oid);
  pintarPedidos();
  abierto.forEach(oid=>document.querySelector(`.order[data-oid="${oid}"]`)?.classList.add("open"));
  toast(`Pedido #${String(id).slice(0,4)} · ${sel.value}`);
});

$("filtroEstado").addEventListener("change", pintarPedidos);
$("reloadOrders").addEventListener("click", ()=>{ cargarPedidos(); toast("Pedidos actualizados"); });