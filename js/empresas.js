// ============ CONFIG SUPABASE ============
const SUPABASE_URL      = "https://gdgayzqhrpdvcpyfckwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ2F5enFocnBkdmNweWZja3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzczMzcsImV4cCI6MjEwMTU1MzMzN30.3XQBmr4o71RajaUEZZDEkJnnMDs0HP2kqC8yLy0Qs0w";
// =========================================

const $ = id => document.getElementById(id);
let WHATSAPP = "56965128341";
const GREET = "¡Hola Mercado Barranca! Quiero cotizar para mi negocio";

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

try{
  const c = JSON.parse(localStorage.getItem("mb_cart_v1") || "{}");
  $("cnt").textContent = Object.values(c).reduce((a,b)=>a+(+b||0),0);
}catch(e){}

(async () => {
  if(!sb) return;
  const { data } = await sb.from("store_config").select("whatsapp").eq("id",1).maybeSingle();
  if(data && data.whatsapp) WHATSAPP = data.whatsapp;
})();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Deja el teléfono en formato chileno; devuelve null si no cuadra.
function normalizaFono(v){
  let d = (v||"").replace(/\D/g,"");
  if(d.startsWith("56")) d = d.slice(2);
  d = d.replace(/^0+/,"");
  if(d.length === 8) d = "9" + d;
  return d.length === 9 ? "+56 " + d[0] + " " + d.slice(1,5) + " " + d.slice(5) : null;
}

const form = $("formEmpresa");

form.addEventListener("submit", async e => {
  e.preventDefault();

  const campos = ["company","name","email","phone","business","message"];
  campos.forEach(c => $("f_"+c).classList.remove("err"));
  const v = {};
  campos.forEach(c => v[c] = ($("f_"+c).value || "").trim());

  const falla = (campo, msg) => { const el=$("f_"+campo); el.classList.add("err"); el.focus(); aviso(msg); };

  if(!v.company)               return falla("company","Falta el nombre de tu empresa o negocio");
  if(!v.name)                  return falla("name","Falta tu nombre");
  if(!EMAIL_RE.test(v.email))  return falla("email","Revisa tu correo electrónico");
  const fono = normalizaFono(v.phone);
  if(!fono)                    return falla("phone","Revisa tu teléfono: 9 dígitos, ej. 9 1234 5678");
  if(v.message.length < 10)    return falla("message","Cuéntanos brevemente qué necesitas");

  const btn = $("btnEnviar");
  btn.disabled = true; btn.textContent = "Enviando…";

  try{
    const { error } = await sb.from("business_leads").insert({ ...v, phone: fono });
    if(error) throw error;
    form.hidden = true;
    $("formOk").classList.add("on");
    $("formOk").scrollIntoView({ behavior:"smooth", block:"center" });
  }catch(err){
    console.warn("No se pudo enviar:", err.message);
    btn.disabled = false; btn.textContent = "Enviar consulta";
    aviso("No pudimos enviar tu consulta. Escríbenos por WhatsApp y lo vemos al tiro.");
  }
});

let tt;
function aviso(msg){
  const t = $("toast");
  $("toastMsg").textContent = msg;
  t.classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("show"), 4000);
}

function abrirWhatsApp(txt){
  const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
  const w = window.open(url, "_blank", "noopener");
  if(!w) location.href = url;
}
document.addEventListener("click", e => {
  const a = e.target.closest(".wa-link,.wa-ask");
  if(!a) return;
  e.preventDefault();
  abrirWhatsApp(a.dataset.ask || GREET);
});
