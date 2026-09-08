// ============ CONFIG SUPABASE ============
const SUPABASE_URL      = "https://gdgayzqhrpdvcpyfckwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2F5enFocnBkdmNweWZja3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzczMzcsImV4cCI6MjEwMTU1MzMzN30.3XQBmr4o71RajaUEZZDEkJnnMDs0HP2kqC8yLy0Qs0w";
// =========================================

const CLP = n => "$" + Number(n||0).toLocaleString("es-CL");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const $ = id => document.getElementById(id);

let WHATSAPP="56965128341", FREE_SHIP=40000;
const GREET="¡Hola Mercado Barranca! Quiero hacer un pedido 🐟";

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// El contador del carrito se comparte con el resto del sitio
try{
  const c=JSON.parse(localStorage.getItem("mb_cart_v1")||"{}");
  $("cnt").textContent=Object.values(c).reduce((a,b)=>a+(+b||0),0);
}catch(e){}

// Los nombres del mapa y los de la tabla deben calzar aunque cambien tildes
// o mayúsculas: se comparan en una forma normalizada.
const clave = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"")
  .toLowerCase().trim();

const ZONAS = [
  { region:"RM",        titulo:"Región Metropolitana", mapa:"mapaRM", lista:"listaRM",
    nota:"Se muestran las comunas del Gran Santiago." },
  { region:"V Region",  titulo:"V Región",             mapa:"mapaV",  lista:"listaV",
    nota:"Se muestran las comunas continentales de la región." }
];

async function cargar(){
  if(!sb) return;
  try{
    const [{data:tarifas},{data:cfg}] = await Promise.all([
      sb.from("shipping_rates").select("*").order("region").order("cost", {nullsFirst:false}).order("comuna"),
      sb.from("store_config").select("whatsapp,free_ship_threshold").eq("id",1).maybeSingle()
    ]);
    if(cfg){ WHATSAPP=cfg.whatsapp||WHATSAPP; FREE_SHIP=cfg.free_ship_threshold||FREE_SHIP; }
    $("umbral").textContent = CLP(FREE_SHIP);

    for(const z of ZONAS){
      const dez = (tarifas||[]).filter(t=>t.region===z.region);
      pintarLista(z, dez);
      await pintarMapa(z, dez);
    }
  }catch(e){
    console.warn("No se pudieron cargar las tarifas:", e.message);
  }
}

// El listado muestra solo las comunas con despacho. Las demás quedan
// igual en el mapa, en gris, para que se vea hasta dónde llega la cobertura.
function pintarLista(z, tarifas){
  const box=$(z.lista);
  const con = tarifas.filter(t=>t.covered).sort((a,b)=>a.cost-b.cost);

  box.innerHTML = con.length
    ? `<h3>Con despacho</h3>` + con.map(t=>`
        <div class="fila" data-comuna="${esc(clave(t.comuna))}">
          <span class="comuna">${esc(t.comuna)}</span>
          <span class="valor">${CLP(t.cost)}</span>
        </div>`).join("")
    : '<p style="color:var(--dim)">Sin información de esta zona.</p>';
}

async function pintarMapa(z, tarifas){
  const cont=$(z.mapa);
  const svg=cont.querySelector("svg");
  if(!svg) return;

  const porComuna = new Map(tarifas.map(t=>[clave(t.comuna), t]));

  svg.querySelectorAll("path[data-comuna]").forEach(p=>{
    const t = porComuna.get(clave(p.dataset.comuna));
    const nombre = p.dataset.comuna;
    if(t && t.covered){
      p.classList.add("cubierta");
      p.querySelector("title").textContent = `${nombre} · ${CLP(t.cost)}`;
    } else {
      p.querySelector("title").textContent = `${nombre} · sin cobertura`;
    }

    // al pasar por el mapa se resalta la fila del listado, y al revés
    const fila = $(z.lista).querySelector(`[data-comuna="${clave(nombre)}"]`);
    const marcar = on => {
      p.classList.toggle("activa", on && p.classList.contains("cubierta"));
      if(fila) fila.classList.toggle("on", on);
    };
    p.addEventListener("mouseenter", ()=>marcar(true));
    p.addEventListener("mouseleave", ()=>marcar(false));
    if(fila){
      fila.addEventListener("mouseenter", ()=>marcar(true));
      fila.addEventListener("mouseleave", ()=>marcar(false));
    }
  });
}

// Carga los dos mapas y luego pinta la cobertura
async function iniciar(){
  for(const z of ZONAS){
    const cont=$(z.mapa);
    try{
      const r = await fetch(cont.dataset.src);
      cont.innerHTML = await r.text();
    }catch(e){
      cont.innerHTML = '<p style="color:var(--dim);padding:20px;text-align:center">No se pudo cargar el mapa.</p>';
    }
  }
  cargar();
}

function abrirWhatsApp(txt){
  const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  const w=window.open(url,"_blank","noopener"); if(!w) location.href=url;
}
document.addEventListener("click",e=>{
  const a=e.target.closest(".wa-link,.wa-ask"); if(!a) return;
  e.preventDefault(); abrirWhatsApp(a.dataset.ask||GREET);
});

iniciar();
