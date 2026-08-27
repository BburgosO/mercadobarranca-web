# Mercado Barranca

Tienda de pescados y mariscos con despacho refrigerado en la Región Metropolitana.
Los pedidos se arman en el sitio y se cierran por WhatsApp.

**Dominio:** mercadobarranca.cl
**Servidor:** 147.93.68.99 · contenedor en el puerto 8041 (solo local)

---

## Cómo está armado

Sitio estático servido por nginx dentro de un contenedor. No hay backend propio:
el catálogo, la configuración y los pedidos viven en **Supabase**, y el navegador
los consulta directamente.

```
Visitante ─► nginx del host (443) ─► contenedor nginx (127.0.0.1:8041) ─► HTML/CSS/JS
                                                    │
                                                    └─► Supabase (catálogo, pedidos)
```

No se necesita PHP, Node ni base de datos en el servidor.

### Páginas

| Ruta | Archivo | Qué hace |
|---|---|---|
| `/` | `index.html` | Portada: hero, categorías, catálogo, carrito |
| `/producto/<slug>` | `producto.html` | Ficha de producto, cargada según el slug |
| `/admin` | `admin/index.html` | Panel de gestión, con login |

Las tres comparten el carrito mediante `localStorage` (clave `mb_cart_v1`).

### Estructura

```
.
├── index.html              portada
├── producto.html           motor de las fichas
├── admin/index.html        panel de gestión
├── css/
│   ├── styles.css          portada
│   ├── producto.css        ficha
│   └── admin.css           panel
├── js/
│   ├── app.js              catálogo, carrito, checkout
│   ├── producto.js         carga y pinta la ficha
│   └── admin.js            CRUD del panel
├── assets/                 imágenes del sitio y og-image
├── deploy/
│   ├── mercadobarranca.cl.conf   vhost del host
│   └── post-receive              hook de despliegue
├── Dockerfile
├── docker-compose.yml
└── nginx.conf              config del contenedor
```

---

## Base de datos (Supabase)

Proyecto `gdgayzqhrpdvcpyfckwg`. La clave `anon` está en el JavaScript **a propósito**:
es pública por diseño. Lo que protege los datos son las políticas RLS.

### Tablas

| Tabla | Contenido |
|---|---|
| `products` | Catálogo. Precio, formato, fotos, textos de la ficha |
| `banners` | Slides del hero |
| `store_config` | WhatsApp, costo de despacho, umbral de envío gratis, anuncios |
| `customers` | Datos de contacto de quien pide |
| `orders` / `order_items` | Pedidos y sus líneas |
| `subscribers` | Correos del newsletter |
| `admins` | Quién puede entrar al panel |

### Reglas de acceso

- **Público:** solo lee `products` y `banners` activos, y `store_config`.
- **Escribir cualquier cosa** exige estar en la tabla `admins`. Tener cuenta no basta.
- **Pedidos y clientes** no son legibles sin ser administrador.

### `place_order()`

Registra el pedido. **Ignora los precios que manda el navegador** y los recalcula
leyendo `products`; lo que dijo el cliente queda en `orders.client_total` para
detectar diferencias. Sin esto, cualquiera podría editar el precio desde la
consola del navegador y pedir a $1.

---

## Panel de administración

En `/admin`. Permite editar precios, activar y desactivar productos, subir fotos,
completar las fichas, cambiar los banners, ajustar despacho y revisar pedidos.

### Acceso

Correo y contraseña de Supabase Auth, **más** estar en la tabla `admins`.
Son dos condiciones: si falta la segunda, el login responde que la cuenta no
tiene permisos aunque la clave sea correcta.

Para habilitar a alguien:

1. Supabase → Authentication → Users → Add user (marcar *Auto Confirm User*)
2. En el SQL Editor:

```sql
insert into public.admins(user_id, email)
select id, email from auth.users where email = 'correo@ejemplo.cl'
on conflict (user_id) do nothing;
```

Para quitarle el acceso basta con borrar su fila de `admins`.

El vhost incluye, comentado, un `auth_basic` opcional si se quiere una contraseña
adicional del servidor antes de llegar al login.

---

## Despliegue

### Primera vez en el servidor

```bash
mkdir -p /opt/mercadobarranca-web/web
git init --bare /opt/mercadobarranca-web.git

# hook que publica en cada push
cp deploy/post-receive /opt/mercadobarranca-web.git/hooks/post-receive
chmod +x /opt/mercadobarranca-web.git/hooks/post-receive

# vhost del host
cp deploy/mercadobarranca.cl.conf /etc/nginx/sites-available/mercadobarranca.cl
ln -s /etc/nginx/sites-available/mercadobarranca.cl /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# certificado
certbot --nginx -d mercadobarranca.cl -d www.mercadobarranca.cl
```

### Levantar el contenedor

```bash
cd /opt/mercadobarranca-web/web
docker compose up -d --build
```

Queda escuchando en `127.0.0.1:8041`, accesible solo desde el propio servidor.
El nginx del host hace de intermediario.

### Actualizar

Desde tu equipo:

```bash
git remote add produccion root@147.93.68.99:/opt/mercadobarranca-web.git
git push produccion main
```

El hook deja el sitio actualizado y reconstruye el contenedor.

O directamente en el servidor:

```bash
cd /opt/mercadobarranca-web/web
git pull
docker compose up -d --build
```

### Caché

`nginx.conf` usa caché corta a propósito: **10 minutos** para HTML y **1 hora**
para CSS y JS, así los cambios de diseño se ven casi de inmediato. Las imágenes
sí duran 30 días, porque cambian poco y pesan.

---

## Pendientes

- **DNS:** el dominio está registrado y delegado a HostingPlus, pero la zona está
  vacía. Falta el registro A apuntando a 147.93.68.99.
- **Fotos:** los productos aún usan una imagen genérica por categoría. Se suben
  desde el panel y quedan en Supabase Storage.
- **Testimonios:** los tres de la portada son de muestra y están marcados como
  tales. Hay que reemplazarlos por reseñas reales o quitarlos.
- **Previsualización por producto:** al compartir una ficha en WhatsApp se ve la
  imagen de la marca, no la del producto. Los lectores de enlaces no ejecutan
  JavaScript; para resolverlo habría que generar un HTML por producto.
- **Redes sociales:** los enlaces a Instagram y Facebook están comentados en el
  pie a la espera de las URLs reales.

---

## Decisiones que conviene no deshacer

- **El puerto se mapea a `127.0.0.1`, no a `0.0.0.0`.** El contenedor no debe
  quedar expuesto directo a internet.
- **Los precios se recalculan en el servidor.** No confiar en los montos que
  manda el navegador.
- **Escribir exige estar en `admins`.** Antes bastaba con tener cualquier cuenta,
  lo que permitía a un desconocido editar precios y leer datos de clientes.
- **El precio muestra `/kg` solo cuando es por kilo.** En los demás formatos va
  `c/u` con el equivalente por kilo, que además es exigible legalmente.
