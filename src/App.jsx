import React, { useState, useEffect, useMemo, useRef, Component } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { ShoppingCart, LayoutDashboard, Package, Clock, TrendingUp, DollarSign, FileText, Settings, BarChart2, Pencil, Trash2, Search, Plus, X, AlertTriangle, RefreshCw, User, Tag, Receipt, Truck, Store, CheckCircle2, AlertCircle, Download, Upload, ChevronRight, Lock, Unlock, ShoppingBag, ClipboardList, Flame, Snowflake, Timer, LogOut, Mail, Eye, EyeOff, ScanLine, Camera, Menu } from "lucide-react";
import * as XLSX from "xlsx";

// ═══════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL || "https://sdizrjbeasubjkpixmro.supabase.co";
const SB_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_h7mDzmzfLVnwyJ21ZuweQQ_AyIYmB4u";
const _sb = createClient(SB_URL, SB_KEY);

const sb = {
  _negocioId: null,

  async signUp(email, password, nombreNegocio) {
    const { data, error } = await _sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    // Si hay sesión inmediata (confirmación de email desactivada), crear negocio
    if (data.session) {
      // IMPORTANTE: la sesión ya está activa automáticamente por supabase-js
      // NO llamar a setSession aquí (rompe el auto-refresh del token)
      await this._crearNegocioInicial(data.user.id, nombreNegocio);
    }
    return data;
  },

  async _crearNegocioInicial(userId, nombreNegocio) {
    // El usuario ya está autenticado por supabase-js — insertamos directo
    const { data: neg, error: err1 } = await _sb.from("negocios").insert({ user_id: userId, nombre: nombreNegocio || "Mi Negocio" }).select().single();
    if (err1) { console.error("Error creando negocio:", err1); throw new Error("Error creando negocio: " + err1.message); }
    const { error: err2 } = await _sb.from("caja").insert({ negocio_id: neg.id, abierta: false, monto: 0 });
    if (err2) console.error("Error creando caja:", err2);
    return neg;
  },
  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },
  async signOut() {
    this._negocioId = null;
    await _sb.auth.signOut();
  },
  async getSession() {
    const { data } = await _sb.auth.getSession();
    return data.session;
  },
  async resetPasswordForEmail(email) {
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
  },
  async updatePassword(newPassword) {
    const { error } = await _sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  async getNegocio(userId) {
    const { data, error } = await _sb.from("negocios").select("*").eq("user_id", userId).maybeSingle();
    if (error) console.error("getNegocio:", error);
    return data;
  },
  async updateNegocio(data) {
    const { error } = await _sb.from("negocios").update(data).eq("id", this._negocioId);
    if (error) console.error("updateNegocio:", error);
  },

  async get(table, order = "created_at") {
    const { data, error } = await _sb.from(table).select("*").eq("negocio_id", this._negocioId).order(order, { ascending: order === "nombre" });
    if (error) {
      console.error(`get ${table} (order=${order}):`, error);
      // Reintento sin ordenar — nunca perder datos por un problema de orden
      const retry = await _sb.from(table).select("*").eq("negocio_id", this._negocioId);
      if (retry.error) { console.error(`get ${table} (retry):`, retry.error); return []; }
      return retry.data || [];
    }
    return data || [];
  },
  async getOne(table) {
    const { data, error } = await _sb.from(table).select("*").eq("negocio_id", this._negocioId).maybeSingle();
    if (error) console.error(`getOne ${table}:`, error);
    return data;
  },
  async upsert(table, data) {
    const { data: r, error } = await _sb.from(table).upsert(data).select().single();
    if (error) { console.error(`upsert ${table}:`, error); console.error("data:", data); }
    return r;
  },
  async insert(table, data) {
    const { data: r, error } = await _sb.from(table).insert(data).select().single();
    if (error) { console.error(`insert ${table}:`, error); console.error("data:", data); }
    return r;
  },
  async del(table, id) {
    const { error } = await _sb.from(table).delete().eq("id", id).eq("negocio_id", this._negocioId);
    if (error) console.error(`del ${table}:`, error);
  },
};
// ── Conversores DB ↔ App ──────────────────────────────────
const dbToProduct = r => ({
  id: r.id, nombre: r.nombre, descripcion: r.descripcion, categoria: r.categoria,
  sku: r.sku, precio: parseFloat(r.precio)||0, costo: parseFloat(r.costo)||0,
  stock: r.stock||0, stockMinimo: r.stock_minimo||3,
  talles: r.talles||[], colores: r.colores||[], stockPorTalle: r.stock_por_talle||{},
  imagen: r.imagen||'', marca: r.marca||'', temporada: r.temporada||'',
  vencimiento: r.vencimiento||'', modelo: r.modelo||'', garantia: r.garantia||'',
  laboratorio: r.laboratorio||'', medida: r.medida||'', material: r.material||'',
  codigoBarras: r.codigo_barras||'', unidadMedida: r.unidad_medida||'',
  origen: r.origen||'', edadRecomendada: r.edad_recomendada||'', editorial: r.editorial||'',
  especie: r.especie||'',
});
const productToDb = (p, negocioId) => ({
  id: p.id, negocio_id: negocioId, nombre: p.nombre, descripcion: p.descripcion||'',
  categoria: p.categoria||'General', sku: p.sku||'', precio: p.precio||0,
  costo: p.costo||0, stock: p.stock||0, stock_minimo: p.stockMinimo||3,
  talles: p.talles||[], colores: p.colores||[], stock_por_talle: p.stockPorTalle||{},
  imagen: p.imagen||'', marca: p.marca||'', temporada: p.temporada||'',
  vencimiento: p.vencimiento||'', codigo_barras: p.codigoBarras||null,
  modelo: p.modelo||'', garantia: p.garantia||'', laboratorio: p.laboratorio||'',
  medida: p.medida||'', material: p.material||'', unidad_medida: p.unidadMedida||'',
  origen: p.origen||'', edad_recomendada: p.edadRecomendada||'', editorial: p.editorial||'',
  especie: p.especie||'',
});
const dbToVenta = r => ({
  id: r.id, numero: r.numero, fecha: r.fecha, cliente: r.cliente,
  metodoPago: r.metodo_pago, items: r.items||[], subtotal: parseFloat(r.subtotal)||0,
  descuento: parseFloat(r.descuento)||0, descuentoTipo: r.descuento_tipo,
  total: parseFloat(r.total)||0, efectivoDado: parseFloat(r.efectivo_dado)||0,
  cambio: parseFloat(r.cambio)||0, anulada: r.anulada||false, factura: r.factura||null,
});
const ventaToDb = (v, negocioId) => ({
  id: v.id, negocio_id: negocioId, numero: v.numero, fecha: v.fecha,
  cliente: v.cliente||'', metodo_pago: v.metodoPago, items: v.items||[],
  subtotal: v.subtotal||0, descuento: v.descuento||0, descuento_tipo: v.descuentoTipo||'monto',
  total: v.total||0, efectivo_dado: v.efectivoDado||0, cambio: v.cambio||0,
  factura: v.factura||null,
});
const dbToConfig = n => ({
  nombre: n.nombre, moneda: n.moneda||'$', dueno: n.dueno||'', rubro: n.rubro||'',
  telefono: n.telefono||'', instagram: n.instagram||'', logo: n.logo||'',
  direccion: n.direccion||'',
  cuit: n.cuit||'', razonSocial: n.razon_social||'', tipoContrib: n.tipo_contrib||'monotributista',
  puntoVenta: n.punto_venta||'0001', condicionIVA: n.condicion_iva||'Monotributista',
  facturacionActiva: n.facturacion_activa||false,
  // Suscripción
  subscriptionStatus: n.subscription_status || 'trial',
  trialEndsAt: n.trial_ends_at || null,
  nextBillingDate: n.next_billing_date || null,
  mpPreapprovalId: n.mp_preapproval_id || null,
  paymentFailedAt: n.payment_failed_at || null,
  subscriptionStartedAt: n.subscription_started_at || null,
  accesoManualHasta: n.acceso_manual_hasta || null,
});
const configToDb = c => ({
  nombre: c.nombre, moneda: c.moneda, dueno: c.dueno, rubro: c.rubro,
  telefono: c.telefono, instagram: c.instagram, logo: c.logo,
  direccion: c.direccion,
  cuit: c.cuit, razon_social: c.razonSocial, tipo_contrib: c.tipoContrib,
  punto_venta: c.puntoVenta, condicion_iva: c.condicionIVA,
  facturacion_activa: c.facturacionActiva,
});


class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding:32, fontFamily:"monospace", background:"#fff0f0", minHeight:"100vh" }}>
        <h2 style={{ color:"#dc2626" }}>⚠️ Error detectado</h2>
        <pre style={{ background:"#fee2e2", padding:16, borderRadius:8, fontSize:12, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
          {this.state.error?.message || String(this.state.error)}
          {"\n\n"}
          {this.state.error?.stack?.slice(0,600)}
        </pre>
        <button onClick={() => this.setState({ error:null })} style={{ marginTop:16, padding:"8px 20px", background:"#111", color:"#fff", border:"none", borderRadius:8, cursor:"pointer" }}>Reintentar</button>
      </div>
    );
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════
// UTILS & CONSTANTS
// ═══════════════════════════════════════════════════════════
const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtMoney = (n, m = "$") => `${m}${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
const fmtDate = (s) => s ? new Date(s + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "";
const addDays = (d, n) => { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().split("T")[0]; };
const subDays = (d, n) => addDays(d, -n);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };

const RUBROS = ["👗 Ropa / Indumentaria","👟 Calzado","🏠 Bazar / Hogar","🍬 Kiosko / Despensa","🛒 Supermercado / Autoservicio","🔧 Ferretería / Construcción","💊 Farmacia / Perfumería","💄 Perfumería / Cosmética","🧸 Juguetería","📚 Librería / Papelería","📱 Electrónica / Tecnología","🥬 Almacén / Verdulería","🐾 Pet Shop","🍷 Vinoteca / Bebidas","🥖 Panadería / Pastelería","🥩 Carnicería / Fiambrería","🕶️ Óptica","🎉 Regalería / Cotillón","🌱 Vivero / Jardinería","🏪 Otro / General"];
const PAGOS = ["Efectivo","Tarjeta débito","Tarjeta crédito","Transferencia","Mercado Pago","Otro"];
// Categorías dinámicas por rubro
const CATS_POR_RUBRO = {
  "👗 Ropa / Indumentaria": [
    "Remeras","Buzos y Hoodies","Camisas","Pantalones","Jeans","Shorts y Bermudas",
    "Vestidos","Polleras","Camperas y Abrigos","Ropa Interior","Medias y Calcetines",
    "Ropa Deportiva","Pijamas","Bañadores","Calzado","Accesorios","Otros"
  ],
  "🏠 Bazar / Hogar": [
    "Vajilla","Vasos y Copas","Cubiertos","Ollas y Sartenes","Utensilios de Cocina",
    "Textiles del Hogar","Decoración","Iluminación","Almacenamiento","Baño",
    "Jardín y Exterior","Limpieza del Hogar","Muebles pequeños","Otros"
  ],
  "🍬 Kiosko / Despensa": [
    "Golosinas","Alfajores","Chocolates","Snacks y Papas","Chicles y Caramelos",
    "Bebidas con gas","Bebidas sin gas","Aguas","Energizantes","Jugos",
    "Cigarrillos","Tarjetas y Recargas","Lácteos","Panificados","Conservas",
    "Condimentos","Artículos de Limpieza","Otros"
  ],
  "🔧 Ferretería / Construcción": [
    "Herramientas Manuales","Herramientas Eléctricas","Electricidad","Plomería",
    "Pintura y Accesorios","Fijaciones y Tornillería","Adhesivos y Selladores",
    "Materiales de Construcción","Seguridad","Cerrajería","Jardín",
    "Iluminación","Cables y Mangueras","Otros"
  ],
  "💊 Farmacia / Perfumería": [
    "Medicamentos OTC","Vitaminas y Suplementos","Higiene Personal",
    "Perfumes y Fragancias","Cosméticos","Maquillaje","Cuidado de la Piel",
    "Cuidado del Cabello","Productos para Bebés","Ortopedia","Primeros Auxilios",
    "Salud Sexual","Dietética","Otros"
  ],
  "🧸 Juguetería": [
    "Juguetes para Bebés","Muñecas y Peluches","Vehículos y Autos","Juegos de Mesa",
    "Juguetes Electrónicos","Deportes y Aire Libre","Arte y Manualidades",
    "Disfraces y Disfraz","Construcción y Bloques","Didácticos y Educativos",
    "Coleccionables","Otros"
  ],
  "📚 Librería / Papelería": [
    "Útiles Escolares","Cuadernos y Anotadores","Lapiceras y Lápices",
    "Arte y Dibujo","Papelería de Oficina","Libros","Agendas y Planners",
    "Mochilas y Bolsos","Cartucheras","Carpetas y Archivos",
    "Sellos y Stickers","Tecnología Escolar","Otros"
  ],
  "📱 Electrónica / Tecnología": [
    "Smartphones","Computadoras y Laptops","Tablets","Audio y Auriculares",
    "TV y Video","Gaming y Consolas","Fotografía","Smartwatches y Wearables",
    "Accesorios Celular","Cables y Conectores","Almacenamiento","Redes y Wi-Fi",
    "Impresión","Iluminación LED","Seguridad y Cámaras","Otros"
  ],
  "🥬 Almacén / Verdulería": [
    "Frutas","Verduras y Hortalizas","Lácteos y Huevos","Carnes y Embutidos",
    "Panificados","Pastas y Arroces","Bebidas","Enlatados y Conservas",
    "Granos y Cereales","Condimentos y Salsas","Congelados","Limpieza",
    "Artículos de Higiene","Fiambres","Otros"
  ],
  "👟 Calzado": [
    "Zapatillas","Zapatos de Vestir","Botas y Botinetas","Sandalias","Ojotas",
    "Calzado Deportivo","Calzado Infantil","Pantuflas","Plantillas y Accesorios","Otros"
  ],
  "🐾 Pet Shop": [
    "Alimento para Perros","Alimento para Gatos","Snacks y Premios","Accesorios",
    "Higiene y Cuidado","Juguetes","Correas y Collares","Camas y Casas",
    "Peceras y Acuarios","Aves y Roedores","Otros"
  ],
  "🍷 Vinoteca / Bebidas": [
    "Vinos Tintos","Vinos Blancos","Vinos Rosados","Espumantes y Champagne",
    "Cervezas","Whisky y Destilados","Vodka y Gin","Aperitivos","Licores",
    "Sin Alcohol","Accesorios","Otros"
  ],
  "💄 Perfumería / Cosmética": [
    "Perfumes","Maquillaje","Cuidado Facial","Cuidado Capilar","Cuidado Corporal",
    "Esmaltes y Uñas","Accesorios de Belleza","Sets de Regalo","Otros"
  ],
  "🥖 Panadería / Pastelería": [
    "Panes","Facturas y Medialunas","Tortas y Tartas","Galletitas","Pastelería Fina",
    "Sándwiches","Bebidas","Productos sin TACC","Otros"
  ],
  "🥩 Carnicería / Fiambrería": [
    "Vacuno","Cerdo","Pollo","Cordero","Achuras","Embutidos","Fiambres",
    "Quesos","Congelados","Otros"
  ],
  "🕶️ Óptica": [
    "Anteojos de Sol","Anteojos Recetados","Lentes de Contacto","Armazones",
    "Accesorios","Estuches y Cadenas","Líquidos y Limpieza","Otros"
  ],
  "🎉 Regalería / Cotillón": [
    "Globos","Decoración de Fiestas","Velas","Bolsas de Regalo","Papel de Regalo",
    "Cotillón Temático","Piñatas","Souvenirs","Otros"
  ],
  "🛒 Supermercado / Autoservicio": [
    "Almacén (Conservas y Enlatados)","Granos y Legumbres","Lácteos y Huevos",
    "Fiambres y Quesos","Panificados","Bebidas con Alcohol","Bebidas sin Alcohol",
    "Limpieza del Hogar","Higiene Personal","Congelados","Golosinas y Snacks",
    "Frutas y Verduras","Carnes","Bazar y Descartables","Otros"
  ],
  "🌱 Vivero / Jardinería": [
    "Plantas","Macetas y Contenedores","Tierra y Sustratos","Fertilizantes y Abonos",
    "Semillas","Herramientas de Jardín","Riego","Insecticidas y Fungicidas",
    "Decoración de Jardín","Otros"
  ],
  "🏪 Otro / General": [
    "General","Producto","Servicio","Insumos","Equipamiento","Accesorios","Otros"
  ],
};
const CATS_PROD_FALLBACK = ["General","Producto","Servicio","Accesorios","Insumos","Otros"];
const CATS_GASTO = ["Alquiler","Servicios","Sueldos","Mercadería","Marketing","Transporte","Mantenimiento","Impuestos","Otro"];
const TALLES_PRESET = { "Ropa — XS al XXL": ["XS","S","M","L","XL","XXL"], "Calzado — 35 al 45": ["35","36","37","38","39","40","41","42","43","44","45"], "Niños — 2 al 16": ["2","4","6","8","10","12","14","16"], "Único": ["Único"] };
const COLORES_DEFAULT = ["Azul Marino","Blanco","Negro","Rojo","Verde","Amarillo","Rosa","Gris","Beige","Marrón","Celeste","Violeta"];
const PIE_COLORS = ["#111","#16a34a","#2563eb","#d97706","#dc2626","#7c3aed","#0891b2","#ea580c"];

// ═══════════════════════════════════════════════════════════
// THEME — CSS variables para dark/light mode
// ═══════════════════════════════════════════════════════════
const THEME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  :root {
    --bg-page:#ffffff;--bg-sidebar:#fafbfc;--bg-card:#ffffff;--bg-card2:#f9fafb;
    --bg-input:#ffffff;--border:#eef0f4;--border-mid:#e5e7eb;--border-strong:#d1d5db;
    --text:#0a0a0a;--text2:#4b5563;--text-muted:#6b7280;--text-light:#9ca3af;
    --btn-dark-bg:#0a0a0a;--btn-dark-text:#ffffff;
    --accent:#9238FF;--accent-dark:#7a1de6;--accent-soft:#f4ecff;
  }
`;

// ═══════════════════════════════════════════════════════════
// STYLE ATOMS
// ═══════════════════════════════════════════════════════════
const G = {
  btn: (v = "dark", x = {}) => ({
    display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px",
    borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600, transition:"opacity .15s",
    border: v==="outline" ? "1px solid var(--border-strong)" : "none",
    background: {dark:"var(--btn-dark-bg)",green:"#16a34a",outline:"var(--bg-card)",light:"var(--bg-card2)",red:"#dc2626",ghost:"transparent"}[v] ?? "var(--btn-dark-bg)",
    color: {dark:"var(--btn-dark-text)",green:"#fff",outline:"var(--text2)",light:"var(--text2)",red:"#fff",ghost:"var(--text2)"}[v] ?? "var(--btn-dark-text)",
    ...x
  }),
  inp: (x = {}) => ({
    width:"100%", padding:"9px 12px", border:"1px solid var(--border-mid)", borderRadius:8,
    fontSize:13, outline:"none", boxSizing:"border-box", color:"var(--text)", background:"var(--bg-input)",
    fontFamily:"inherit", ...x
  }),
  card: (x = {}) => ({ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, padding:"20px 24px", ...x }),
  page: { padding:"28px 32px", minHeight:"100vh", background:"var(--bg-page)" },
  label: { fontSize:13, fontWeight:600, color:"var(--text)", display:"block", marginBottom:6 },
};

// ═══════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════
function CajaBanner({ caja, onAbrir }) {
  if (caja.abierta) return null;
  return (
    <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <div style={{ background:"#fef3c7", borderRadius:8, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", color:"#d97706" }}><Receipt size={18}/></div>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:"#92400e" }}>Caja Cerrada</div>
          <div style={{ fontSize:12, color:"#a16207" }}>Abre la caja para empezar a vender</div>
        </div>
      </div>
      <button style={G.btn("green")} onClick={onAbrir}>Abrir Caja</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// EscanerModal — usa la cámara del dispositivo para leer códigos de barra
// ══════════════════════════════════════════════════════════
function EscanerModal({ onDetectado, onClose, titulo = "Escanear código de barras" }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const [iniciando, setIniciando] = useState(true);

  useEffect(() => {
    const scanner = new Html5Qrcode("escaner-region");
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 130 },
      aspectRatio: 1.5,
      formatsToSupport: undefined, // acepta todos: EAN-13, EAN-8, UPC-A, Code-128, Code-39, QR...
    };

    scanner.start(
      { facingMode: "environment" }, // cámara trasera en celulares
      config,
      (decodedText) => {
        // Detectó un código - cierra y devuelve
        scanner.stop().then(() => {
          onDetectado(decodedText.trim());
        }).catch(() => onDetectado(decodedText.trim()));
      },
      () => {} // callback de error de frame - ignoramos
    ).then(() => {
      setIniciando(false);
    }).catch(err => {
      setIniciando(false);
      const msg = String(err?.message || err);
      if (msg.includes("Permission") || msg.includes("permission")) {
        setError("Necesitás permitir el acceso a la cámara para escanear.");
      } else if (msg.includes("NotFound") || msg.includes("no camera")) {
        setError("No se detectó ninguna cámara en este dispositivo.");
      } else {
        setError("No se pudo iniciar la cámara: " + msg);
      }
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onDetectado]);

  return (
    <Modal title={titulo} subtitle="Apuntá la cámara al código y esperá a que lo detecte" onClose={onClose} width={480}>
      <div style={{ background: "#000", borderRadius: 12, overflow: "hidden", position: "relative", minHeight: 320 }}>
        <div id="escaner-region" style={{ width: "100%", minHeight: 320 }}/>
        {iniciando && !error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>
            Iniciando cámara...
          </div>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 14, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#dc2626", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }}/>
          <div>{error}</div>
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 12, color: "#666", lineHeight: 1.6 }}>
        💡 <b>Tip:</b> también podés usar un lector USB — el código va a aparecer en el buscador automáticamente al escanear.
      </div>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children, width = 520 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ ...G.card({ padding:0 }), width, maxWidth:"96vw", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding:"24px 28px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:subtitle ? 4 : 20 }}>
            <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:"#111" }}>{title}</h2>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#999", lineHeight:1, padding:"0 2px" }}>✕</button>
          </div>
          {subtitle && <p style={{ margin:"0 0 20px", fontSize:13, color:"#888" }}>{subtitle}</p>}
        </div>
        <div style={{ padding:"0 28px 28px" }}>{children}</div>
      </div>
    </div>
  );
}

function Empty({ icon, text, btnText, onBtn }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px", color:"#bbb" }}>
      <div style={{ marginBottom:12, opacity:0.25, color:"#aaa" }}>{icon || <Package size={40}/>}</div>
      <div style={{ marginBottom:16, fontSize:14, color:"#aaa" }}>{text}</div>
      {btnText && <button style={G.btn("dark")} onClick={onBtn}>+ {btnText}</button>}
    </div>
  );
}

function StockBadge({ stock, min }) {
  const out = stock === 0, low = stock > 0 && stock <= (min || 3);
  return <span style={{ background: out?"#fee2e2":low?"#fef3c7":"#dcfce7", color: out?"#dc2626":low?"#d97706":"#16a34a", padding:"2px 10px", borderRadius:20, fontSize:12, fontWeight:600 }}>{out?"Sin stock":stock}</span>;
}

function FieldRow({ label, children, half }) {
  return (
    <div style={{ marginBottom:16, ...(half ? {} : {}) }}>
      <label style={G.label}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ icon, bg, label, value, badge, textColor }) {
  return (
    <div style={{ ...G.card(), position:"relative", minWidth:0 }}>
      {badge && <span style={{ position:"absolute", top:14, right:14, background:"#f0fdf4", color:"#16a34a", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, border:"1px solid #bbf7d0" }}>{badge}</span>}
      <div style={{ width:38, height:38, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, marginBottom:14 }}>{icon}</div>
      <div style={{ fontSize:26, fontWeight:700, color:textColor||"#111" }}>{value}</div>
      <div style={{ fontSize:13, color:"#999", marginTop:4 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════

function AbrirCajaModal({ setCaja, saveCaja, onClose }) {
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAbrir = async () => {
    if (loading) return;
    setLoading(true);
    const c = { abierta:true, monto:Number(monto)||0, fecha:todayStr() };
    try {
      setCaja(c);
      if (saveCaja) await saveCaja(c);
    } catch (e) {
      console.error("Error abriendo caja:", e);
    } finally {
      onClose();
    }
  };

  return (
    <Modal title="Abrir Caja" subtitle="Ingresá el monto inicial en caja para comenzar el día." onClose={onClose} width={400}>
      <FieldRow label="Monto de apertura">
        <input style={G.inp()} type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} autoFocus disabled={loading} />
      </FieldRow>
      <button style={{ ...G.btn("green"), width:"100%", justifyContent:"center", padding:"11px", opacity: loading ? 0.7 : 1 }}
        onClick={handleAbrir} disabled={loading}>
        {loading ? "Abriendo..." : "Abrir Caja"}
      </button>
    </Modal>
  );
}

function CerrarCajaModal({ caja, sales, config, setCaja, saveCaja, onClose }) {
  const { moneda } = config;
  const hoy = todayStr();
  const ahora = new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
  const ventasHoy = sales.filter(s => !s.anulada && s.fecha === hoy);
  const totalGen  = ventasHoy.reduce((a, s) => a + s.total, 0);
  const [cerrando, setCerrando] = useState(false);

  // Por método de pago
  const porMetodo = {};
  ventasHoy.forEach(s => { porMetodo[s.metodoPago] = (porMetodo[s.metodoPago] || 0) + s.total; });

  const totalEfectivo  = porMetodo["Efectivo"] || 0;
  const enCaja = caja.monto + totalEfectivo;
  const facturadas = ventasHoy.filter(s => s.factura?.estado === "emitida").length;

  const handlePrint = () => {
    const content = document.getElementById("cierre-caja-content");
    if (!content) return;
    const w = window.open("", "_blank", "width=480,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Cierre de Caja — ${hoy}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Inter',-apple-system,sans-serif; padding:32px 24px; max-width:420px; margin:0 auto; color:#111; }
      @media print { body { padding:16px; } button { display:none !important; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const cerrar = async () => {
    if (cerrando) return;
    setCerrando(true);
    const c = { abierta:false, monto:0, fecha:null };
    try {
      setCaja(c);
      if (saveCaja) await saveCaja(c);
    } catch (e) {
      console.error("Error cerrando caja:", e);
    } finally {
      onClose();
    }
  };

  return (
    <Modal title="Cierre de Caja" subtitle={`${fmtDate(hoy)} · Cierre a las ${ahora}`} onClose={onClose} width={480}>
      <div id="cierre-caja-content" style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>

        {/* Header del cierre */}
        <div style={{ textAlign:"center", paddingBottom:16, borderBottom:"1px solid #f0f0f0", marginBottom:16 }}>
          <div style={{ fontWeight:900, fontSize:16 }}>{config.nombre}</div>
          <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Resumen de Caja — {fmtDate(hoy)}</div>
          <div style={{ fontSize:12, color:"#bbb" }}>Apertura: {fmtMoney(caja.monto, moneda)} · Cierre: {ahora}</div>
        </div>

        {/* Ventas por método */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10 }}>Ventas por método de pago</div>
          {Object.keys(porMetodo).length === 0 ? (
            <div style={{ fontSize:13, color:"#bbb", padding:"12px 0", textAlign:"center" }}>Sin ventas hoy</div>
          ) : Object.entries(porMetodo).map(([metodo, total]) => (
            <div key={metodo} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f5f5f5", fontSize:14 }}>
              <span style={{ fontWeight:500 }}>{metodo}</span>
              <span style={{ fontWeight:700 }}>{fmtMoney(total, moneda)}</span>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div style={{ background:"#f9fafb", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          {[
            ["Apertura de caja",    fmtMoney(caja.monto, moneda)],
            ["Total ventas del día", fmtMoney(totalGen, moneda)],
            ["Ventas realizadas",   `${ventasHoy.length} venta${ventasHoy.length !== 1 ? "s" : ""}`],
            ...(facturadas > 0 ? [["Facturas emitidas", `${facturadas}`]] : []),
          ].map(([label, val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8 }}>
              <span style={{ color:"#666" }}>{label}</span>
              <span style={{ fontWeight:600 }}>{val}</span>
            </div>
          ))}
          <div style={{ height:1, background:"#e5e7eb", margin:"8px 0" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
            <span style={{ color:"#666" }}>Efectivo en caja (apertura + ventas)</span>
            <span style={{ fontWeight:700 }}>{fmtMoney(enCaja, moneda)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, borderTop:"1px solid #e5e7eb", paddingTop:10, marginTop:6 }}>
            <span>Total vendido</span>
            <span style={{ color:"#16a34a" }}>{fmtMoney(totalGen, moneda)}</span>
          </div>
        </div>

        {/* Top 5 productos */}
        {ventasHoy.length > 0 && (() => {
          const conteo = {};
          ventasHoy.forEach(s => (s.items||[]).forEach(it => { conteo[it.nombre] = (conteo[it.nombre]||0) + it.cantidad; }));
          const top = Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0,5);
          return top.length > 0 ? (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#999", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10 }}>Top productos del día</div>
              {top.map(([nombre, cant]) => (
                <div key={nombre} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                  <span style={{ color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%" }}>{nombre}</span>
                  <span style={{ fontWeight:600, color:"#111", flexShrink:0 }}>{cant} ud.</span>
                </div>
              ))}
            </div>
          ) : null;
        })()}

        <div style={{ textAlign:"center", paddingTop:12, borderTop:"1px solid #f0f0f0", fontSize:11, color:"#bbb" }}>
          Cierre generado a las {ahora} · MiLocal
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={handlePrint} disabled={cerrando}>
          <Download size={14}/> Imprimir cierre
        </button>
        <button style={{ ...G.btn("red"), flex:1, justifyContent:"center", opacity: cerrando ? 0.7 : 1 }} onClick={cerrar} disabled={cerrando}>
          <Lock size={14}/> {cerrando ? "Cerrando..." : "Cerrar Caja"}
        </button>
      </div>
    </Modal>
  );
}

// ── Cambio de Productos (product exchange) ─────────────────
function CambioProductosModal({ products, setProducts, saveProducts, rubro, onClose }) {
  const esModa = RUBROS_CON_TALLES.includes(rubro);
  const [devuelve, setDevuelve] = useState([]);
  const [lleva, setLleva]       = useState([]);
  const [notas, setNotas]       = useState("");
  const [exito, setExito]       = useState(false);
  // prodPendiente: { prod, side:"dev"|"lleva" } — esperando selección de talle
  const [prodPendiente, setProdPendiente] = useState(null);
  const [searchDev, setSearchDev]   = useState("");
  const [searchLleva, setSearchLleva] = useState("");
  const [showSearchDev, setShowSearchDev]     = useState(false);
  const [showSearchLleva, setShowSearchLleva] = useState(false);

  const totDev   = devuelve.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const totLleva = lleva.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const diff = totLleva - totDev;

  const updQty = (setList, cartKey, qty) => {
    if (+qty <= 0) setList(p => p.filter(i => i.cartKey !== cartKey));
    else setList(p => p.map(i => i.cartKey === cartKey ? { ...i, cantidad:+qty } : i));
  };

  const addItem = (setList, prod, talle = null) => {
    const cartKey = talle ? `${prod.id}__${talle}` : prod.id;
    const stockMax = talle ? ((prod.stockPorTalle||{})[talle]||0) : prod.stock;
    setList(prev => {
      const idx = prev.findIndex(i => i.cartKey === cartKey);
      if (idx >= 0) return prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it);
      return [...prev, { cartKey, id:prod.id, nombre:prod.nombre + (talle ? ` — T.${talle}` : ""), precio:prod.precio, cantidad:1, talle, stockMax }];
    });
  };

  // Al hacer clic en un producto del buscador
  const handleSelectProd = (prod, side) => {
    if (esModa && (prod.talles||[]).length > 0) {
      setProdPendiente({ prod, side });
    } else {
      if (side === "dev") { addItem(setDevuelve, prod); setSearchDev(""); setShowSearchDev(false); }
      else               { addItem(setLleva, prod);    setSearchLleva(""); setShowSearchLleva(false); }
    }
  };

  const confirmar = async () => {
    if (devuelve.length === 0 && lleva.length === 0) return;
    const affectedIds = new Set([...devuelve.map(d=>d.id), ...lleva.map(l=>l.id)]);
    const updated = products.map(p => {
      const devItems   = devuelve.filter(i => i.id === p.id);
      const llevaItems = lleva.filter(i => i.id === p.id);
      if (!devItems.length && !llevaItems.length) return p;
      let upd = { ...p };
      if (esModa && upd.stockPorTalle) {
        const spt = { ...upd.stockPorTalle };
        devItems.forEach(it => { if (it.talle) spt[it.talle] = (spt[it.talle]||0) + it.cantidad; });
        llevaItems.forEach(it => { if (it.talle) spt[it.talle] = Math.max(0, (spt[it.talle]||0) - it.cantidad); });
        const newTotal = Object.values(spt).reduce((a,v) => a+(+v||0), 0);
        upd = { ...upd, stockPorTalle: spt, stock: newTotal };
      } else {
        const sumDev   = devItems.reduce((a, i) => a + i.cantidad, 0);
        const sumLleva = llevaItems.reduce((a, i) => a + i.cantidad, 0);
        upd = { ...upd, stock: Math.max(0, upd.stock + sumDev - sumLleva) };
      }
      return upd;
    });
    setProducts(updated);
    setExito(true);
    if (saveProducts) await saveProducts(updated.filter(p => affectedIds.has(p.id)));
  };

  // Modal de selección de talle (pendiente)
  if (prodPendiente) {
    const { prod, side } = prodPendiente;
    const spt = prod.stockPorTalle || {};
    return (
      <Modal title={`Seleccionar talle — ${prod.nombre}`} onClose={() => setProdPendiente(null)} width={440}>
        <div style={{ fontSize:13, color:"#888", marginBottom:16 }}>
          {side === "dev" ? "¿Qué talle devuelve el cliente?" : "¿Qué talle se lleva el cliente?"}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8, marginBottom:20 }}>
          {(prod.talles||[]).map(t => {
            const cnt = spt[t] || 0;
            const sinStock = side === "lleva" && cnt === 0;
            return (
              <button key={t}
                onClick={() => {
                  if (sinStock) return;
                  if (side === "dev") { addItem(setDevuelve, prod, t); setSearchDev(""); setShowSearchDev(false); }
                  else               { addItem(setLleva, prod, t);    setSearchLleva(""); setShowSearchLleva(false); }
                  setProdPendiente(null);
                }}
                disabled={sinStock}
                style={{ borderRadius:10, border:"2px solid #e5e7eb", padding:"10px 6px", textAlign:"center", cursor:sinStock?"not-allowed":"pointer", background:sinStock?"#fafafa":"#fff", opacity:sinStock?0.45:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{t}</div>
                <div style={{ fontSize:11, color: cnt===0?"#dc2626":"#888", marginTop:2 }}>{side==="dev" ? "" : `${cnt} ud.`}</div>
              </button>
            );
          })}
        </div>
        {prod.colores?.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            {prod.colores.map(c => <span key={c} style={{ background:"#f3f4f6", borderRadius:20, padding:"4px 12px", fontSize:12, color:"#555" }}>{c}</span>)}
          </div>
        )}
        <button style={{ ...G.btn("outline"), width:"100%", justifyContent:"center" }} onClick={() => setProdPendiente(null)}>Cancelar</button>
      </Modal>
    );
  }

  if (exito) return (
    <Modal title="" onClose={onClose} width={380}>
      <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
        <div style={{ color:"#16a34a", marginBottom:12 }}><CheckCircle2 size={52}/></div>
        <h3 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700 }}>¡Cambio registrado!</h3>
        <p style={{ color:"#888", fontSize:13, marginBottom:20 }}>El stock fue actualizado correctamente.</p>
        {diff !== 0 && <div style={{ background: diff > 0 ? "#f0fdf4" : "#fef2f2", borderRadius:10, padding:"12px 20px", marginBottom:20 }}>
          <div style={{ fontSize:13, color:"#666" }}>Diferencia a {diff > 0 ? "cobrar" : "devolver"}</div>
          <div style={{ fontSize:24, fontWeight:700, color: diff > 0 ? "#16a34a" : "#dc2626" }}>{fmtMoney(Math.abs(diff))}</div>
        </div>}
        <button style={{ ...G.btn("dark"), width:"100%", justifyContent:"center" }} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );

  const SidePanel = ({ label, list, setList, search, setSearch, showSearch, setShowSearch, accentColor, soloConStock }) => {
    const filtrados = products
      .filter(p => {
        if (soloConStock) {
          const tieneStock = esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).some(v=>+v>0) : p.stock > 0;
          if (!tieneStock) return false;
        }
        return !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.sku||"").toLowerCase().includes(search.toLowerCase());
      }).slice(0, 12);
    const side = label.includes("Devuelve") ? "dev" : "lleva";
    return (
      <div style={{ border:`1.5px solid ${accentColor}33`, borderRadius:12, padding:16, background:`${accentColor}05` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:14 }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:accentColor, display:"inline-block" }}/>
            {label}
          </div>
          <button onClick={() => setShowSearch(!showSearch)} style={G.btn("outline", { padding:"5px 12px", fontSize:12 })}><Plus size={13}/> Agregar</button>
        </div>

        {/* Buscador + grid de cards */}
        {showSearch && (
          <div style={{ marginBottom:12 }}>
            <input style={{ ...G.inp({ marginBottom:10 }) }} placeholder="Buscar producto o SKU..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {filtrados.length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8, maxHeight:320, overflowY:"auto" }}>
                {filtrados.map(p => {
                  const totalStock = esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).reduce((a,v)=>a+(+v||0),0) : p.stock;
                  const inList = list.filter(i => i.id === p.id).reduce((a,i)=>a+i.cantidad,0);
                  return (
                    <div key={p.id} onClick={() => handleSelectProd(p, side)}
                      style={{ background:"#fff", border:`1.5px solid ${inList>0?accentColor:"#ebebeb"}`, borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"border-color .12s" }}>
                      {p.imagen
                        ? <img src={p.imagen} alt={p.nombre} style={{ width:"100%", height:90, objectFit:"cover", display:"block" }} onError={e=>e.target.style.display="none"} />
                        : <div style={{ width:"100%", height:75, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", color:"#ddd" }}><Package size={24}/></div>
                      }
                      <div style={{ padding:"7px 8px 5px" }}>
                        {inList > 0 && <div style={{ marginBottom:3 }}><span style={{ background:accentColor, color:"#fff", fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:20 }}>{inList} sel.</span></div>}
                        <div style={{ fontWeight:700, fontSize:11, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{p.nombre}</div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: esModa&&(p.talles||[]).length>0?4:0 }}>
                          <span style={{ fontWeight:800, fontSize:12, color:"#111" }}>{fmtMoney(p.precio)}</span>
                          <span style={{ fontSize:9, color:totalStock<=3?"#d97706":"#bbb" }}>{totalStock} ud.</span>
                        </div>
                        {esModa && (p.talles||[]).length > 0 && (
                          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min((p.talles||[]).length,6)},1fr)`, gap:2 }}>
                            {(p.talles||[]).map(t => {
                              const cnt=(p.stockPorTalle||{})[t]||0;
                              return <div key={t} style={{ background:cnt===0?"#fff0f0":"#fafafa", border:`1px solid ${cnt===0?"#fca5a5":"#e5e7eb"}`, borderRadius:4, padding:"2px 1px", textAlign:"center" }}>
                                <div style={{ fontSize:7, color:"#999" }}>{t}</div>
                                <div style={{ fontWeight:700, fontSize:9, color:cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                              </div>;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : search ? (
              <div style={{ fontSize:12, color:"#bbb", padding:"12px 0", textAlign:"center" }}>Sin resultados para "{search}"</div>
            ) : (
              <div style={{ fontSize:12, color:"#bbb", padding:"8px 0", textAlign:"center" }}>Escribí para buscar productos</div>
            )}
          </div>
        )}

        {/* Items seleccionados */}
        {list.length === 0
          ? <div style={{ textAlign:"center", padding:"14px 0", color:"#bbb", fontSize:13 }}>Sin productos</div>
          : list.map(it => (
            <div key={it.cartKey} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #f3f4f6", fontSize:13 }}>
              <span style={{ flex:1, fontWeight:500, fontSize:12 }}>{it.nombre}</span>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <button onClick={() => updQty(setList, it.cartKey, it.cantidad - 1)} style={{ width:22, height:22, borderRadius:4, border:"1px solid #d1d5db", background:"#fff", cursor:"pointer" }}>−</button>
                <span style={{ minWidth:22, textAlign:"center", fontWeight:700 }}>{it.cantidad}</span>
                <button onClick={() => updQty(setList, it.cartKey, it.cantidad + 1)} style={{ width:22, height:22, borderRadius:4, border:"1px solid #d1d5db", background:"#fff", cursor:"pointer" }}>+</button>
              </div>
              <span style={{ minWidth:56, textAlign:"right", color:"#666", fontSize:12 }}>{fmtMoney(it.precio * it.cantidad)}</span>
            </div>
          ))
        }
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:13, paddingTop:10, marginTop:6, borderTop:"1px solid #e5e7eb" }}>
          <span>Subtotal:</span>
          <span style={{ color:accentColor }}>{fmtMoney(list.reduce((a,i)=>a+i.precio*i.cantidad,0))}</span>
        </div>
      </div>
    );
  };

  return (
    <Modal title="Cambio de Productos" subtitle="Registrá qué devuelve el cliente y qué se lleva" onClose={onClose} width={780}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16, marginBottom:20 }}>
        <SidePanel label="Productos que Devuelve" list={devuelve} setList={setDevuelve} search={searchDev} setSearch={setSearchDev} showSearch={showSearchDev} setShowSearch={setShowSearchDev} accentColor="#2563eb" soloConStock={false} />
        <SidePanel label="Productos que se Lleva" list={lleva} setList={setLleva} search={searchLleva} setSearch={setSearchLleva} showSearch={showSearchLleva} setShowSearch={setShowSearchLleva} accentColor="#16a34a" soloConStock={true} />
      </div>
      <div style={{ background:"#f9fafb", borderRadius:12, padding:"18px 20px", border:"1.5px solid #e5e7eb" }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:12 }}>Resumen del Cambio</div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ color:"#666" }}>Se lleva:</span><span style={{ color:"#16a34a", fontWeight:600 }}>+{fmtMoney(totLleva)}</span></div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:12 }}><span style={{ color:"#666" }}>Devuelve:</span><span style={{ color:"#dc2626", fontWeight:600 }}>-{fmtMoney(totDev)}</span></div>
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:17, borderTop:"1px solid #e5e7eb", paddingTop:12, marginBottom:16 }}>
          <span>{diff === 0 ? "Sin diferencia" : diff > 0 ? "Debe pagar" : "A devolver"}</span>
          <span style={{ color: diff === 0 ? "#111" : diff > 0 ? "#16a34a" : "#dc2626" }}>{fmtMoney(Math.abs(diff))}</span>
        </div>
        <FieldRow label="Notas (opcional)">
          <input style={G.inp()} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: cambio por talle incorrecto" />
        </FieldRow>
        <button style={{ ...G.btn(devuelve.length===0 && lleva.length===0 ? "light":"dark"), width:"100%", justifyContent:"center", padding:"13px", fontSize:15, marginTop:8 }} onClick={confirmar} disabled={devuelve.length===0 && lleva.length===0}>
          Confirmar Cambio
        </button>
      </div>
    </Modal>
  );
}

// ── Nuevo Producto ─────────────────────────────────────────
const RUBROS_CON_TALLES = ["👗 Ropa / Indumentaria", "👟 Calzado"];
const RUBROS_CON_COLORES = ["👗 Ropa / Indumentaria", "🏠 Bazar / Hogar", "🧸 Juguetería", "👟 Calzado"];
const CAMPOS_EXTRA_POR_RUBRO = {
  "👗 Ropa / Indumentaria": ["temporada"],
  "👟 Calzado": ["marca"],
  "📱 Electrónica / Tecnología": ["marca","modelo","garantia"],
  "💊 Farmacia / Perfumería": ["laboratorio","vencimiento"],
  "💄 Perfumería / Cosmética": ["marca","vencimiento"],
  "🔧 Ferretería / Construcción": ["marca","medida","material"],
  "🍬 Kiosko / Despensa": ["marca","vencimiento","codigoBarras"],
  "🥬 Almacén / Verdulería": ["unidadMedida","vencimiento","origen"],
  "🏠 Bazar / Hogar": ["marca","material"],
  "🧸 Juguetería": ["marca","edadRecomendada"],
  "📚 Librería / Papelería": ["marca","editorial"],
  "🐾 Pet Shop": ["marca","especie","vencimiento"],
  "🍷 Vinoteca / Bebidas": ["marca","origen","vencimiento"],
  "🥖 Panadería / Pastelería": ["unidadMedida","vencimiento"],
  "🥩 Carnicería / Fiambrería": ["unidadMedida","vencimiento"],
  "🕶️ Óptica": ["marca","modelo"],
  "🎉 Regalería / Cotillón": ["marca"],
  "🛒 Supermercado / Autoservicio": ["marca","vencimiento","codigoBarras"],
  "🌱 Vivero / Jardinería": ["marca","vencimiento"],
  "🏪 Otro / General": [],
};
const LABELS_CAMPOS = { temporada:"Temporada", marca:"Marca", modelo:"Modelo", garantia:"Garantía", laboratorio:"Laboratorio", vencimiento:"Vencimiento", medida:"Medida", material:"Material", codigoBarras:"Código de barras", unidadMedida:"Unidad de medida", origen:"Origen", edadRecomendada:"Edad recomendada", editorial:"Editorial", especie:"Especie" };

const RUBROS_CON_VENCIMIENTO = ["🍬 Kiosko / Despensa", "💊 Farmacia / Perfumería", "💄 Perfumería / Cosmética", "🥬 Almacén / Verdulería", "🐾 Pet Shop", "🍷 Vinoteca / Bebidas", "🥖 Panadería / Pastelería", "🥩 Carnicería / Fiambrería", "🛒 Supermercado / Autoservicio", "🌱 Vivero / Jardinería"];

function ProductoModal({ prod, onSave, onClose, cats, rubro }) {
  const esModa = RUBROS_CON_TALLES.includes(rubro);
  const tieneColores = RUBROS_CON_COLORES.includes(rubro);
  const camposExtra = CAMPOS_EXTRA_POR_RUBRO[rubro] || [];
  const [error, setError] = useState("");
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  // Calzado arranca con numeración 35-45, el resto de rubros con talles usa XS-XXL
  const tallesDefault = rubro === "👟 Calzado" ? ["35","36","37","38","39","40","41","42","43","44","45"] : ["XS","S","M","L","XL","XXL"];
  const stockPorTalleDefault = Object.fromEntries(tallesDefault.map(t => [t, 0]));

  const [f, setF] = useState(() => {
    const defaults = {
      nombre:"", descripcion:"", categoria:"", sku:"", precio:"", costo:"", imagen:"",
      talles: esModa ? tallesDefault : [],
      stockPorTalle: esModa ? stockPorTalleDefault : {},
      colores:[], talleCustom:"", colorCustom:"", stockMinimo:3, stock:0,
      temporada:"", marca:"", modelo:"", garantia:"", laboratorio:"", vencimiento:"",
      medida:"", material:"", codigoBarras:"", unidadMedida:"", origen:"", edadRecomendada:"", editorial:"", especie:""
    };
    if (!prod) return defaults;
    // Deep copy + merge with defaults for missing fields
    const base = { ...defaults, ...JSON.parse(JSON.stringify(prod)) };
    // Ensure arrays exist
    if (!Array.isArray(base.talles)) base.talles = esModa ? tallesDefault : [];
    if (!Array.isArray(base.colores)) base.colores = [];
    if (!base.stockPorTalle || typeof base.stockPorTalle !== "object") base.stockPorTalle = {};
    // Init stockPorTalle for talles that don't have it
    if (esModa) {
      (base.talles||[]).forEach(t => { if (!(t in base.stockPorTalle)) base.stockPorTalle[t] = 0; });
    }
    if (!base.talleCustom) base.talleCustom = "";
    if (!base.colorCustom) base.colorCustom = "";
    return base;
  });

  const u = (k, v) => setF(p => ({ ...p, [k]:v }));
  const [tallePreset, setTallePreset] = useState("Ropa — XS al XXL");

  const toggleTalle = (t) => {
    const talles = f.talles || [];
    const newTalles = talles.includes(t) ? talles.filter(x => x !== t) : [...talles, t];
    const newSPT = { ...(f.stockPorTalle || {}) };
    if (!newTalles.includes(t)) delete newSPT[t];
    else if (!(t in newSPT)) newSPT[t] = 0;
    setF(p => ({ ...p, talles: newTalles, stockPorTalle: newSPT }));
  };
  const setTalleStock = (t, val) => setF(p => ({ ...p, stockPorTalle: { ...(p.stockPorTalle||{}), [t]: Math.max(0, +val||0) } }));
  const toggleColor = (c) => u("colores", (f.colores||[]).includes(c) ? (f.colores||[]).filter(x => x !== c) : [...(f.colores||[]), c]);
  const addTalleCustom = () => {
    const t = (f.talleCustom||"").trim();
    if (t && !(f.talles||[]).includes(t)) {
      setF(p => ({ ...p, talles:[...(p.talles||[]), t], stockPorTalle:{...(p.stockPorTalle||{}),[t]:0}, talleCustom:"" }));
    }
  };
  const addColorCustom = () => {
    const c = (f.colorCustom||"").trim();
    if (c && !(f.colores||[]).includes(c)) { u("colores", [...(f.colores||[]), c]); u("colorCustom", ""); }
  };
  const applyPreset = (preset) => {
    const newTalles = TALLES_PRESET[preset] || [];
    const newSPT = Object.fromEntries(newTalles.map(t => [t, (f.stockPorTalle||{})[t] || 0]));
    setTallePreset(preset);
    setF(p => ({ ...p, talles: newTalles, stockPorTalle: newSPT }));
  };
  const totalStockTalles = esModa
    ? Object.values(f.stockPorTalle || {}).reduce((a, v) => a + (+v||0), 0)
    : +f.stock || 0;

  const save = () => {
    if (!f.nombre?.trim()) { setError("El nombre es requerido"); return; }
    if (!f.precio) { setError("El precio es requerido"); return; }
    setError("");
    const stockFinal = esModa ? totalStockTalles : +f.stock || 0;
    onSave({ ...f, id:prod?.id||uid(), precio:+f.precio, costo:+f.costo||0, stockMinimo:+f.stockMinimo||3, stock: stockFinal });
  };

  const coloresExistentes = Array.isArray(f.colores) ? f.colores : [];
  const COLORES_TODOS = [...COLORES_DEFAULT, ...coloresExistentes.filter(c => !COLORES_DEFAULT.includes(c))];

  return (
    <Modal title={prod ? "Editar Producto" : "Nuevo producto"} onClose={onClose} width={600}>
      {error && <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:13, color:"#dc2626" }}>{error}</div>}
      <FieldRow label="Nombre *">
        <input style={G.inp()} value={f.nombre} onChange={e => u("nombre", e.target.value)} placeholder="Nombre del producto" autoFocus />
      </FieldRow>
      <FieldRow label="Descripción">
        <textarea style={{ ...G.inp(), minHeight:70, resize:"vertical" }} value={f.descripcion} onChange={e => u("descripcion", e.target.value)} placeholder="Describe el producto..." />
      </FieldRow>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
        <FieldRow label="Categoría">
          <select style={G.inp()} value={f.categoria} onChange={e => u("categoria", e.target.value)}>
            <option value="">Seleccionar</option>
            {(cats || CATS_PROD_FALLBACK).map(c => <option key={c}>{c}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="SKU / Código">
          <input style={G.inp()} value={f.sku} onChange={e => u("sku", e.target.value)} placeholder="VES-001" />
        </FieldRow>
        <FieldRow label="Código de barras">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...G.inp(), flex: 1 }}
              value={f.codigoBarras}
              onChange={e => u("codigoBarras", e.target.value)}
              placeholder="7791234567890"
            />
            <button
              type="button"
              onClick={() => setEscanerAbierto(true)}
              style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
            >
              <Camera size={16}/> Escanear
            </button>
          </div>
        </FieldRow>
        <FieldRow label="Precio de venta *">
          <input style={G.inp()} type="number" min={0} step="0.01" value={f.precio} onChange={e => u("precio", e.target.value)} placeholder="0.00" />
        </FieldRow>
        <FieldRow label="Costo">
          <input style={G.inp()} type="number" min={0} step="0.01" value={f.costo} onChange={e => u("costo", e.target.value)} placeholder="0.00" />
        </FieldRow>
      </div>

      {/* Campos extra dinámicos por rubro */}
      {camposExtra.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
          {camposExtra.map(campo => (
            <FieldRow key={campo} label={LABELS_CAMPOS[campo] || campo}>
              <input style={G.inp()} value={f[campo]||""} onChange={e => u(campo, e.target.value)} placeholder={LABELS_CAMPOS[campo] || campo} />
            </FieldRow>
          ))}
        </div>
      )}

      {/* Stock — para rubros sin talles */}
      {!esModa && (
        <FieldRow label="Stock inicial">
          <input style={G.inp()} type="number" min={0} value={f.stock||""} onChange={e => u("stock", e.target.value)} placeholder="0" />
        </FieldRow>
      )}

      <FieldRow label="Stock mínimo (alerta)">
        <input style={G.inp()} type="number" min={0} value={f.stockMinimo} onChange={e => u("stockMinimo", e.target.value)} placeholder="3" />
      </FieldRow>
      <FieldRow label="Imagen">
        <div style={{ display:"flex", gap:8 }}>
          <input style={G.inp()} value={f.imagen} onChange={e => u("imagen", e.target.value)} placeholder="URL de la imagen o subí desde tu dispositivo" />
          <button
            type="button"
            style={G.btn("outline", { padding:"9px 12px", flexShrink:0 })}
            onClick={() => document.getElementById("prod-imagen-input")?.click()}
            title="Subir imagen desde tu dispositivo"
          >
            <Upload size={14}/>
          </button>
          <input
            id="prod-imagen-input"
            type="file"
            accept="image/*"
            style={{ display:"none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              // Validar tamaño (max 5MB antes de comprimir)
              if (file.size > 5 * 1024 * 1024) {
                alert("La imagen es muy grande. Máximo 5MB.");
                e.target.value = "";
                return;
              }
              // Leer, redimensionar (max 800px) y comprimir a JPEG 85%
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const MAX_W = 800;
                  const scale = img.width > MAX_W ? MAX_W / img.width : 1;
                  const w = Math.round(img.width * scale);
                  const h = Math.round(img.height * scale);
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, w, h);
                  const compressed = canvas.toDataURL("image/jpeg", 0.85);
                  u("imagen", compressed);
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
        </div>
        {/* Preview */}
        {f.imagen && (
          <div style={{ marginTop:10, position:"relative", display:"inline-block" }}>
            <img
              src={f.imagen}
              alt="preview"
              style={{ maxWidth:120, maxHeight:120, borderRadius:8, border:"1px solid var(--border-mid)", objectFit:"cover" }}
              onError={e => e.target.style.display="none"}
            />
            <button
              type="button"
              onClick={() => u("imagen", "")}
              title="Quitar imagen"
              style={{ position:"absolute", top:-6, right:-6, background:"#dc2626", color:"#fff", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
            >
              <X size={12}/>
            </button>
          </div>
        )}
      </FieldRow>

      {/* Talles + stock por talle — solo Ropa/Indumentaria */}
      {esModa && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={G.label}>Talles y Stock</label>
            {totalStockTalles > 0 && <span style={{ fontSize:12, color:"#16a34a", fontWeight:600 }}>Total: {totalStockTalles} uds</span>}
          </div>
          <select style={{ ...G.inp(), marginBottom:12 }} value={tallePreset} onChange={e => applyPreset(e.target.value)}>
            {Object.keys(TALLES_PRESET).map(k => <option key={k}>{k}</option>)}
          </select>
          {/* Grilla de talles con input de stock */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8, marginBottom:10 }}>
            {(f.talles||[]).map(t => {
              const cnt = f.stockPorTalle?.[t] || 0;
              return (
                <div key={t} style={{ border:`1.5px solid ${cnt>0?"#111":"#e5e7eb"}`, borderRadius:10, padding:"8px", textAlign:"center", background:cnt>0?"#f9f9f9":"#fff", position:"relative" }}>
                  <button onClick={() => toggleTalle(t)} style={{ position:"absolute", top:4, right:6, background:"none", border:"none", cursor:"pointer", fontSize:10, color:"#ccc", lineHeight:1 }}>✕</button>
                  <div style={{ fontSize:12, fontWeight:700, color:"#555", marginBottom:6 }}>{t}</div>
                  <input
                    type="number" min={0}
                    value={cnt === 0 ? "" : cnt}
                    placeholder="0"
                    onChange={e => setTalleStock(t, e.target.value)}
                    style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 4px", fontSize:14, fontWeight:700, textAlign:"center", outline:"none", color: cnt===0?"#bbb":"#111" }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...G.inp(), flex:1 }} placeholder="Agregar talle..." value={f.talleCustom} onChange={e => u("talleCustom", e.target.value)} onKeyDown={e => e.key==="Enter" && addTalleCustom()} />
            <button onClick={addTalleCustom} style={G.btn("outline", { padding:"9px 14px" })}>+</button>
          </div>
        </div>
      )}

      {/* Colores — solo rubros visuales */}
      {tieneColores && (
        <div style={{ marginBottom:20 }}>
          <label style={G.label}>Colores Disponibles</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:10 }}>
            {COLORES_TODOS.map(c => (
              <button key={c} onClick={() => toggleColor(c)} style={{ padding:"9px 12px", borderRadius:8, border:`1.5px solid ${coloresExistentes.includes(c)?"#111":"#e5e7eb"}`, fontSize:13, cursor:"pointer", background:coloresExistentes.includes(c)?"#f9f9f9":"#fff", fontWeight:coloresExistentes.includes(c)?700:400 }}>{c}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...G.inp(), flex:1 }} placeholder="Color personalizado..." value={f.colorCustom} onChange={e => u("colorCustom", e.target.value)} onKeyDown={e => e.key==="Enter" && addColorCustom()} />
            <button onClick={addColorCustom} style={G.btn("outline", { padding:"9px 14px" })}>+</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
        <button style={{ ...G.btn("dark"), flex:1, justifyContent:"center" }} onClick={save}>Guardar producto</button>
      </div>
      {escanerAbierto && (
        <EscanerModal
          onDetectado={(code) => { u("codigoBarras", code); setEscanerAbierto(false); }}
          onClose={() => setEscanerAbierto(false)}
        />
      )}
    </Modal>
  );
}

function AjusteStockModal({ prod, rubro, onSave, onClose }) {
  const esModa = RUBROS_CON_TALLES.includes(rubro) && prod.talles?.length > 0;
  const [op, setOp] = useState("add");
  const [cant, setCant] = useState("");
  const [talleSelec, setTalleSelec] = useState(prod.talles?.[0] || "");
  const [motivo, setMotivo] = useState("Reposición");
  const MOTIVOS = ["Reposición","Corrección","Devolución","Merma","Otro"];

  const stockActualTalle = esModa ? ((prod.stockPorTalle || {})[talleSelec] || 0) : prod.stock;
  const nuevoTalle = op === "add" ? stockActualTalle + (+cant||0) : Math.max(0, stockActualTalle - (+cant||0));
  const totalActual = esModa ? Object.values(prod.stockPorTalle||{}).reduce((a,v)=>a+(+v||0),0) : prod.stock;

  const confirmar = () => {
    if (!cant) return;
    if (esModa) {
      const newSPT = { ...(prod.stockPorTalle || {}) };
      newSPT[talleSelec] = nuevoTalle;
      const newTotal = Object.values(newSPT).reduce((a,v) => a+(+v||0), 0);
      onSave({ stockPorTalle: newSPT, stock: newTotal });
    } else {
      const nuevo = op === "add" ? prod.stock + (+cant||0) : Math.max(0, prod.stock - (+cant||0));
      onSave({ stock: nuevo });
    }
    onClose();
  };

  return (
    <Modal title="Ajustar stock" subtitle={prod.nombre} onClose={onClose} width={420}>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["add","+ Agregar"],["sub","− Restar"]].map(([v,l]) => (
          <button key={v} onClick={() => setOp(v)} style={{ flex:1, padding:"9px", borderRadius:8, border:"1px solid #e5e7eb", cursor:"pointer", fontSize:13, fontWeight:op===v?700:400, background:op===v?"#111":"#fff", color:op===v?"#fff":"#666" }}>{l}</button>
        ))}
      </div>

      {esModa && (
        <FieldRow label="Talle a ajustar">
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(prod.talles.length,6)},1fr)`, gap:8, marginBottom:4 }}>
            {(prod.talles||[]).map(t => {
              const cnt = (prod.stockPorTalle||{})[t]||0;
              return (
                <button key={t} onClick={() => setTalleSelec(t)} style={{ padding:"8px 4px", borderRadius:9, border:`2px solid ${talleSelec===t?"#111":"#e5e7eb"}`, background:talleSelec===t?"#111":"#fff", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:11, color:talleSelec===t?"#fff":"#888" }}>{t}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:talleSelec===t?"#fff":cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                </button>
              );
            })}
          </div>
        </FieldRow>
      )}

      <FieldRow label="Cantidad">
        <input style={G.inp()} type="number" min={0} value={cant} onChange={e => setCant(e.target.value)} autoFocus />
      </FieldRow>
      <FieldRow label="Motivo">
        <select style={G.inp()} value={motivo} onChange={e => setMotivo(e.target.value)}>
          {MOTIVOS.map(m => <option key={m}>{m}</option>)}
        </select>
      </FieldRow>

      <div style={{ background:"#f9fafb", borderRadius:9, padding:"12px 16px", marginBottom:20, fontSize:13 }}>
        {esModa ? (
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:"#666" }}>Talle {talleSelec}: <b>{stockActualTalle}</b> → <b style={{ color: nuevoTalle<(prod.stockMinimo||3)?"#d97706":"#16a34a" }}>{cant ? nuevoTalle : stockActualTalle}</b></span>
            <span style={{ color:"#aaa" }}>Total: {cant ? totalActual + (op==="add"?+cant||0:-(Math.min(+cant||0,stockActualTalle))) : totalActual}</span>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#666" }}>Stock actual: <b>{prod.stock}</b></span>
            <span style={{ fontSize:18, color:"#bbb" }}>→</span>
            <span style={{ fontWeight:700, color: nuevoTalle<(prod.stockMinimo||3)?"#d97706":"#16a34a" }}>Nuevo: {cant ? nuevoTalle : prod.stock}</span>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onClose}>Cancelar</button>
        <button style={{ ...G.btn("dark"), flex:1, justifyContent:"center" }} onClick={confirmar}>Confirmar</button>
      </div>
    </Modal>
  );
}

function GastoModal({ tipoInicial, mes, onSave, onClose }) {
  const [f, setF] = useState({ tipo:tipoInicial||"variable", descripcion:"", monto:"", categoria:"", metodoPago:"", notas:"", fecha:todayStr(), mes });
  const u = (k, v) => setF(p => ({ ...p, [k]:v }));
  return (
    <Modal title="Nuevo Gasto" onClose={onClose} width={480}>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[["fijo","Gasto Fijo"],["variable","Gasto Variable"]].map(([v,l]) => (
          <button key={v} onClick={() => u("tipo", v)} style={{ flex:1, padding:"10px", borderRadius:9, border:`1.5px solid ${f.tipo===v?"#111":"#e5e7eb"}`, cursor:"pointer", fontSize:14, fontWeight:700, background:f.tipo===v?"#111":"#fff", color:f.tipo===v?"#fff":"#555" }}>{l}</button>
        ))}
      </div>
      <FieldRow label="Descripción *">
        <input style={G.inp()} value={f.descripcion} onChange={e => u("descripcion", e.target.value)} placeholder="Ej: Alquiler del local" autoFocus />
      </FieldRow>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
        <FieldRow label="Monto *">
          <input style={G.inp()} type="number" min={0} step="0.01" value={f.monto} onChange={e => u("monto", e.target.value)} placeholder="0.00" />
        </FieldRow>
        <FieldRow label="Categoría *">
          <select style={G.inp()} value={f.categoria} onChange={e => u("categoria", e.target.value)}>
            <option value="">Seleccionar</option>
            {CATS_GASTO.map(c => <option key={c}>{c}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Fecha">
          <input type="date" style={G.inp()} value={f.tipo === "fijo" ? f.mes + "-01" : f.fecha} onChange={e => u(f.tipo === "fijo" ? "mes" : "fecha", e.target.value)} />
        </FieldRow>
        <FieldRow label="Método de pago">
          <select style={G.inp()} value={f.metodoPago} onChange={e => u("metodoPago", e.target.value)}>
            <option value="">Seleccionar</option>
            {PAGOS.map(p => <option key={p}>{p}</option>)}
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Notas">
        <textarea style={{ ...G.inp(), minHeight:70, resize:"vertical" }} value={f.notas} onChange={e => u("notas", e.target.value)} placeholder="Información adicional..." />
      </FieldRow>
      <button style={{ ...G.btn("dark"), width:"100%", justifyContent:"center", padding:"13px", fontSize:15, marginTop:4 }}
        onClick={() => { if (f.descripcion && f.monto) { onSave({ ...f, id:uid(), monto:+f.monto }); onClose(); } }}>
        Guardar Gasto
      </button>
    </Modal>
  );
}

function RemitoModal({ proveedores, products, setProducts, saveProducts, rubro, onSave, onClose }) {
  const esModa = RUBROS_CON_TALLES.includes(rubro);
  const [f, setF] = useState({ numero:"", proveedor:"", fecha:todayStr(), metodoPago:"", notas:"", items:[] });
  const [search, setSearch]           = useState("");
  const [prodPendiente, setProdPendiente] = useState(null); // producto esperando config de talles
  const u = (k, v) => setF(p => ({ ...p, [k]:v }));

  const filtProd = products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.sku||"").toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  // Agregar producto simple (sin talles)
  const addProdSimple = (prod) => {
    setF(p => {
      const idx = p.items.findIndex(i => i.cartKey === prod.id);
      if (idx >= 0) return { ...p, items: p.items.map((it, i) => i===idx ? { ...it, cantidad: it.cantidad+1 } : it) };
      return { ...p, items: [...p.items, { cartKey:prod.id, id:prod.id, nombre:prod.nombre, cantidad:1, precioCompra:prod.costo||0, talle:null, talles:null }] };
    });
    setSearch("");
  };

  // Agregar producto con talles (viene del selector)
  const addProdConTalles = (prod, tallesCantidades) => {
    // tallesCantidades: { "S": 5, "M": 3, ... }
    const entries = Object.entries(tallesCantidades).filter(([,v]) => +v > 0);
    if (!entries.length) return;
    setF(p => {
      let newItems = [...p.items];
      entries.forEach(([talle, cantidad]) => {
        const cartKey = `${prod.id}__${talle}`;
        const idx = newItems.findIndex(i => i.cartKey === cartKey);
        if (idx >= 0) newItems = newItems.map((it, i) => i===idx ? { ...it, cantidad: it.cantidad + +cantidad } : it);
        else newItems = [...newItems, { cartKey, id:prod.id, nombre:`${prod.nombre} — T.${talle}`, cantidad:+cantidad, precioCompra:prod.costo||0, talle }];
      });
      return { ...p, items: newItems };
    });
    setProdPendiente(null);
    setSearch("");
  };

  const updItem = (cartKey, k, v) => setF(p => ({ ...p, items: p.items.map(it => it.cartKey === cartKey ? { ...it, [k]:v } : it) }));
  const removeItem = (cartKey) => setF(p => ({ ...p, items: p.items.filter(it => it.cartKey !== cartKey) }));
  const total = f.items.reduce((a, i) => a + +i.cantidad * +i.precioCompra, 0);

  const crear = () => {
    if (!f.proveedor || f.items.length === 0) return;
    const affectedIds = new Set(f.items.map(i => i.id));
    const updated = products.map(p => {
      const items = f.items.filter(i => i.id === p.id);
      if (!items.length) return p;
      let upd = { ...p };
      if (esModa && upd.stockPorTalle) {
        const spt = { ...upd.stockPorTalle };
        items.forEach(it => {
          if (it.talle) {
            spt[it.talle] = (spt[it.talle]||0) + +it.cantidad;
            if (!upd.talles?.includes(it.talle)) upd = { ...upd, talles: [...(upd.talles||[]), it.talle] };
          }
        });
        const newTotal = Object.values(spt).reduce((a,v) => a+(+v||0), 0);
        upd = { ...upd, stockPorTalle: spt, stock: newTotal };
      } else {
        const suma = items.reduce((a, i) => a + +i.cantidad, 0);
        upd = { ...upd, stock: upd.stock + suma };
      }
      return upd;
    });
    setProducts(updated);
    if (saveProducts) saveProducts(updated.filter(p => affectedIds.has(p.id)));
    onSave({ ...f, total });
    onClose();
  };

  const [cantsPorTalle, setCantsPorTalle] = useState({});

  // Cuando cambia el prodPendiente, resetear cantidades
  useEffect(() => {
    if (prodPendiente) {
      setCantsPorTalle(Object.fromEntries((prodPendiente.talles||[]).map(t => [t, ""])));
    }
  }, [prodPendiente?.id]);

  const totalUnidades = Object.values(cantsPorTalle).reduce((a,v) => a+(+v||0), 0);

  // ── Selector de talles para remito ───────────────────────
  if (prodPendiente) {
    const prod = prodPendiente;
    return (
      <Modal title={`¿Cuántos ingresaron? — ${prod.nombre}`} subtitle="Ingresá la cantidad recibida por talle" onClose={() => setProdPendiente(null)} width={460}>
        {prod.colores?.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            {prod.colores.map(c => <span key={c} style={{ background:"#f3f4f6", borderRadius:20, padding:"4px 12px", fontSize:12, color:"#555" }}>{c}</span>)}
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:20 }}>
          {(prod.talles||[]).map(t => (
            <div key={t} style={{ background:"#f9fafb", borderRadius:10, padding:"12px 10px", textAlign:"center", border:"1px solid #e5e7eb" }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{t}</div>
              <div style={{ fontSize:11, color:"#bbb", marginBottom:8 }}>Stock actual: {(prod.stockPorTalle||{})[t]||0}</div>
              <input
                type="number" min={0} placeholder="0"
                value={cantsPorTalle[t] || ""}
                onChange={e => setCantsPorTalle(p => ({ ...p, [t]: e.target.value }))}
                style={{ ...G.inp({ padding:"6px 10px", textAlign:"center" }), width:"100%" }}
              />
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:13 }}>
          <span style={{ color:"#16a34a", fontWeight:600 }}>Total a ingresar</span>
          <span style={{ fontWeight:800, fontSize:16, color:"#16a34a" }}>{totalUnidades} unidades</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setProdPendiente(null)}>Cancelar</button>
          <button style={{ ...G.btn(totalUnidades>0?"dark":"light"), flex:2, justifyContent:"center" }} onClick={() => addProdConTalles(prod, cantsPorTalle)} disabled={totalUnidades===0}>
            Agregar {totalUnidades>0 ? `${totalUnidades} ud.` : ""}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nuevo Remito de Compra" onClose={onClose} width={780}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
        <FieldRow label="Número de Remito">
          <input style={G.inp()} value={f.numero} onChange={e => u("numero", e.target.value)} placeholder="Ej: R-001" autoFocus />
        </FieldRow>
        <FieldRow label="Fecha">
          <input type="date" style={G.inp()} value={f.fecha} onChange={e => u("fecha", e.target.value)} />
        </FieldRow>
      </div>
      <FieldRow label="Proveedor *">
        <select style={G.inp()} value={f.proveedor} onChange={e => u("proveedor", e.target.value)}>
          <option value="">Seleccionar proveedor</option>
          {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>
      </FieldRow>

      <div style={{ marginBottom:16 }}>
        <label style={G.label}>Agregar Productos</label>
        <div style={{ position:"relative", marginBottom:8 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#bbb", display:"flex" }}><Search size={14}/></span>
          <input style={{ ...G.inp(), paddingLeft:34 }} placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Grid de cards — igual a Nueva Venta */}
        {search && filtProd.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8, marginBottom:12, maxHeight:340, overflowY:"auto" }}>
            {filtProd.map(p => {
              const tieneTalles = esModa && (p.talles||[]).length > 0;
              const totalStock = esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).reduce((a,v)=>a+(+v||0),0) : p.stock;
              const enRemito = f.items.filter(i => i.id === p.id).reduce((a,i)=>a+i.cantidad,0);
              return (
                <div key={p.id} onClick={() => tieneTalles ? setProdPendiente(p) : addProdSimple(p)}
                  style={{ background:"#fff", border:`1.5px solid ${enRemito>0?"#16a34a":"#ebebeb"}`, borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"border-color .12s" }}>
                  {p.imagen
                    ? <img src={p.imagen} alt={p.nombre} style={{ width:"100%", height:90, objectFit:"cover", display:"block" }} onError={e=>e.target.style.display="none"} />
                    : <div style={{ width:"100%", height:75, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", color:"#ddd" }}><Package size={24}/></div>
                  }
                  <div style={{ padding:"7px 8px 5px" }}>
                    {enRemito > 0 && <div style={{ marginBottom:3 }}><span style={{ background:"#16a34a", color:"#fff", fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:20 }}>{enRemito} agregado{enRemito!==1?"s":""}</span></div>}
                    <div style={{ fontWeight:700, fontSize:11, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{p.nombre}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: tieneTalles?4:0 }}>
                      <span style={{ fontWeight:800, fontSize:12, color:"#111" }}>{fmtMoney(p.precio)}</span>
                      <span style={{ fontSize:9, color:totalStock<=3?"#d97706":"#bbb" }}>{totalStock} ud.</span>
                    </div>
                    {tieneTalles && (
                      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min((p.talles||[]).length,6)},1fr)`, gap:2 }}>
                        {(p.talles||[]).map(t => {
                          const cnt=(p.stockPorTalle||{})[t]||0;
                          return <div key={t} style={{ background:cnt===0?"#fff0f0":"#fafafa", border:`1px solid ${cnt===0?"#fca5a5":"#e5e7eb"}`, borderRadius:4, padding:"2px 1px", textAlign:"center" }}>
                            <div style={{ fontSize:7, color:"#999" }}>{t}</div>
                            <div style={{ fontWeight:700, fontSize:9, color:cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                          </div>;
                        })}
                      </div>
                    )}
                    {tieneTalles && <div style={{ fontSize:9, color:"#16a34a", fontWeight:600, marginTop:4, textAlign:"center" }}>Toca para elegir talles</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {search && filtProd.length === 0 && <div style={{ fontSize:12, color:"#bbb", padding:"8px 0", textAlign:"center" }}>Sin resultados para "{search}"</div>}

        {f.items.length > 0 && (
          <div style={{ marginTop:10, border:"1px solid #f0f0f0", borderRadius:10, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 130px 32px", gap:8, padding:"8px 12px", background:"#f9fafb", fontSize:11, fontWeight:600, color:"#888", textTransform:"uppercase" }}>
              <span>Producto</span><span>Cantidad</span><span>Precio costo</span><span/>
            </div>
            {f.items.map(it => (
              <div key={it.cartKey} style={{ display:"grid", gridTemplateColumns:"1fr 90px 130px 32px", gap:8, padding:"8px 12px", borderTop:"1px solid #f5f5f5", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{it.nombre}</span>
                <input style={G.inp({ padding:"7px 10px" })} type="number" min={1} value={it.cantidad} onChange={e => updItem(it.cartKey, "cantidad", e.target.value)} />
                <input style={G.inp({ padding:"7px 10px" })} type="number" min={0} placeholder="$ costo" value={it.precioCompra} onChange={e => updItem(it.cartKey, "precioCompra", e.target.value)} />
                <button onClick={() => removeItem(it.cartKey)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={14}/></button>
              </div>
            ))}
            <div style={{ padding:"10px 14px", borderTop:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:14 }}>
              <span>Total remito:</span><span style={{ color:"#16a34a" }}>{fmtMoney(total)}</span>
            </div>
          </div>
        )}
      </div>

      <FieldRow label="Método de Pago">
        <select style={G.inp()} value={f.metodoPago} onChange={e => u("metodoPago", e.target.value)}>
          <option value="">Seleccionar</option>
          {PAGOS.map(p => <option key={p}>{p}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Notas">
        <textarea style={{ ...G.inp(), minHeight:70, resize:"vertical" }} value={f.notas} onChange={e => u("notas", e.target.value)} placeholder="Información adicional..." />
      </FieldRow>
      <button style={{ ...G.btn(f.items.length > 0 && f.proveedor ? "dark":"light"), width:"100%", justifyContent:"center", padding:"13px", fontSize:15, marginTop:4 }} onClick={crear}>
        Crear Remito y Actualizar Stock
      </button>
    </Modal>
  );
}

function ProveedorModal({ prov, onSave, onClose }) {
  const [f, setF] = useState(prov || { nombre:"", contacto:"", telefono:"", email:"", direccion:"", notas:"" });
  return (
    <Modal title={prov ? "Editar Proveedor" : "Nuevo Proveedor"} onClose={onClose} width={440}>
      <FieldRow label="Nombre del Proveedor *">
        <input style={G.inp()} value={f.nombre} onChange={e => setF(p => ({ ...p, nombre:e.target.value }))} placeholder="Ej: Distribuidora XYZ" autoFocus />
      </FieldRow>
      <FieldRow label="Persona de Contacto">
        <input style={G.inp()} value={f.contacto||""} onChange={e => setF(p => ({ ...p, contacto:e.target.value }))} placeholder="Nombre del contacto" />
      </FieldRow>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
        <FieldRow label="Teléfono">
          <input style={G.inp()} value={f.telefono} onChange={e => setF(p => ({ ...p, telefono:e.target.value }))} placeholder="+54 9 11 1234-5678" />
        </FieldRow>
        <FieldRow label="Email">
          <input style={G.inp()} value={f.email} onChange={e => setF(p => ({ ...p, email:e.target.value }))} placeholder="email@ejemplo.com" />
        </FieldRow>
      </div>
      <FieldRow label="Dirección">
        <input style={G.inp()} value={f.direccion||""} onChange={e => setF(p => ({ ...p, direccion:e.target.value }))} placeholder="Dirección completa" />
      </FieldRow>
      <FieldRow label="Notas">
        <textarea style={{ ...G.inp(), minHeight:70, resize:"vertical" }} value={f.notas} onChange={e => setF(p => ({ ...p, notas:e.target.value }))} placeholder="Información adicional..." />
      </FieldRow>
      <button style={{ ...G.btn("dark"), width:"100%", justifyContent:"center", padding:"13px", fontSize:15, marginTop:4 }}
        onClick={() => { if (f.nombre.trim()) { onSave({ ...f, id:prov?.id||uid() }); onClose(); } }}>
        {prov ? "Guardar cambios" : "Crear Proveedor"}
      </button>
    </Modal>
  );
}

function TicketVentaModal({ venta, config, onClose }) {
  const hora = new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });

  const handlePrint = () => {
    const content = document.getElementById("ticket-print-content");
    if (!content) return;
    const w = window.open("", "_blank", "width=480,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Ticket #${String(venta.numero).padStart(6,"0")}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background:#fff; padding:32px 24px; max-width:420px; margin:0 auto; color:#111; }
      @media print { body { padding:16px; } button { display:none !important; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <Modal title="Ticket de venta" onClose={onClose} width={420}>
      <div id="ticket-print-content" style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", color:"#111" }}>

        {/* Header */}
        <div style={{ textAlign:"center", paddingBottom:20, borderBottom:"1px solid #f0f0f0", marginBottom:20 }}>
          {config.logo
            ? <img src={config.logo} alt="logo" style={{ height:48, marginBottom:10, display:"block", margin:"0 auto 10px" }} onError={e=>e.target.style.display="none"}/>
            : <div style={{ width:48, height:48, background:"#111", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", color:"#fff", fontWeight:900, fontSize:18 }}>
                {(config.nombre||"M").charAt(0).toUpperCase()}
              </div>
          }
          <div style={{ fontWeight:900, fontSize:18, letterSpacing:"-0.3px", marginBottom:3 }}>{config.nombre}</div>
          {config.telefono && <div style={{ fontSize:12, color:"#888", marginBottom:1 }}>{config.telefono}</div>}
          {config.instagram && <div style={{ fontSize:12, color:"#888" }}>{config.instagram}</div>}
        </div>

        {/* Ticket info */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:4, fontSize:12, marginBottom:20 }}>
          <div><span style={{ color:"#999" }}>Ticket</span><div style={{ fontWeight:700, fontSize:14 }}>#{String(venta.numero).padStart(6,"0")}</div></div>
          <div style={{ textAlign:"right" }}><span style={{ color:"#999" }}>Fecha y hora</span><div style={{ fontWeight:600, fontSize:13 }}>{fmtDate(venta.fecha)} {hora}</div></div>
          {venta.cliente && <div><span style={{ color:"#999" }}>Cliente</span><div style={{ fontWeight:600 }}>{venta.cliente}</div></div>}
          <div style={{ textAlign: venta.cliente ? "right" : "left" }}><span style={{ color:"#999" }}>Método de pago</span><div style={{ fontWeight:600 }}>{venta.metodoPago}</div></div>
        </div>

        {/* Items */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"0 16px", padding:"6px 0", borderBottom:"1.5px solid #111", fontSize:11, fontWeight:700, color:"#666", textTransform:"uppercase", letterSpacing:"0.5px" }}>
            <span>Producto</span><span style={{ textAlign:"right" }}>Cant.</span><span style={{ textAlign:"right" }}>Subtotal</span>
          </div>
          {(venta.items||[]).map((it, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"0 16px", padding:"10px 0", borderBottom:"1px solid #f5f5f5" }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{it.nombre}</div>
                <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>{fmtMoney(it.precio, config.moneda)} c/u</div>
              </div>
              <div style={{ fontWeight:500, fontSize:13, color:"#666", textAlign:"right", paddingTop:2 }}>{it.cantidad}</div>
              <div style={{ fontWeight:700, fontSize:13, textAlign:"right", paddingTop:2 }}>{fmtMoney(it.precio * it.cantidad, config.moneda)}</div>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ background:"#fafafa", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6, color:"#666" }}>
            <span>Subtotal</span><span style={{ fontWeight:500 }}>{fmtMoney(venta.subtotal, config.moneda)}</span>
          </div>
          {venta.descuento > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6, color:"#dc2626" }}>
              <span>Descuento</span><span style={{ fontWeight:600 }}>-{fmtMoney(venta.descuento, config.moneda)}</span>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, borderTop:"1px solid #e5e7eb", paddingTop:10, marginTop:6 }}>
            <span>Total</span>
            <span style={{ color:"#16a34a" }}>{fmtMoney(venta.total, config.moneda)}</span>
          </div>
          {venta.efectivoDado > 0 && (
            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:10, paddingTop:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#666", marginBottom:4 }}>
                <span>Efectivo recibido</span><span>{fmtMoney(venta.efectivoDado, config.moneda)}</span>
              </div>
              {venta.cambio > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:700, color:"#2563eb" }}>
                  <span>Vuelto</span><span>{fmtMoney(venta.cambio, config.moneda)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Factura info si aplica */}
        {venta.factura?.estado === "emitida" && (
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12 }}>
            <div style={{ fontWeight:700, color:"#16a34a", marginBottom:2 }}>✓ Factura {venta.factura.tipo} electrónica</div>
            <div style={{ color:"#555" }}>N° {venta.factura.numero} · CAE: {venta.factura.cae}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center", paddingTop:16, borderTop:"1px solid #f0f0f0" }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>¡Gracias por tu compra!</div>
          <div style={{ fontSize:11, color:"#bbb" }}>Conservá este comprobante</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onClose}>Cerrar</button>
        <button style={{ ...G.btn("dark"), flex:2, justifyContent:"center" }} onClick={handlePrint}>
          <Download size={14}/> Imprimir ticket
        </button>
      </div>
    </Modal>
  );
}

function VentaExitoModal({ venta, config, onClose }) {
  const [verTicket, setVerTicket] = useState(false);
  if (verTicket) return <TicketVentaModal venta={venta} config={config} onClose={onClose} />;
  return (
    <Modal title="" onClose={onClose} width={360}>
      <div style={{ textAlign:"center", padding:"12px 0 8px" }}>
        <div style={{ color:"#16a34a", marginBottom:12 }}><CheckCircle2 size={52}/></div>
        <h3 style={{ margin:"0 0 4px", fontSize:20, fontWeight:700 }}>¡Venta completada!</h3>
        <p style={{ margin:"0 0 20px", color:"#888", fontSize:13 }}>Ticket #{String(venta.numero).padStart(6,"0")}</p>
        <div style={{ background:"#f9fafb", borderRadius:10, padding:18, marginBottom:20, textAlign:"left" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ color:"#666" }}>Subtotal</span><span>{fmtMoney(venta.subtotal, config.moneda)}</span></div>
          {venta.descuento > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6, color:"#dc2626" }}><span>Descuento</span><span>-{fmtMoney(venta.descuento, config.moneda)}</span></div>}
          <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:18, borderTop:"1px solid #e5e7eb", paddingTop:10, marginTop:6 }}><span>Total</span><span style={{ color:"#16a34a" }}>{fmtMoney(venta.total, config.moneda)}</span></div>
          {venta.cambio > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#2563eb", marginTop:8 }}><span>Vuelto</span><span style={{ fontWeight:600 }}>{fmtMoney(venta.cambio, config.moneda)}</span></div>}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setVerTicket(true)}>
            🖨️ Ver ticket
          </button>
          <button style={{ ...G.btn("dark"), flex:1, justifyContent:"center" }} onClick={onClose}>
            Nueva venta
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetalleVentaModal({ venta, moneda, config, onAnular, onClose, onVerComprobante }) {
  const [verTicket, setVerTicket] = useState(false);
  if (verTicket) return <TicketVentaModal venta={venta} config={config} onClose={() => setVerTicket(false)} />;
  return (
    <Modal title={`Venta #${venta.numero}`} subtitle={`${fmtDate(venta.fecha)} · ${venta.metodoPago}${venta.cliente ? ` · ${venta.cliente}` : ""}`} onClose={onClose} width={480}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, marginBottom:16 }}>
        <thead><tr style={{ borderBottom:"1px solid #e5e7eb" }}>{["Producto","Cant.","Precio","Total"].map(h => <th key={h} style={{ textAlign:h==="Producto"?"left":"right", padding:"4px 0 8px", fontWeight:600, fontSize:12, color:"#666" }}>{h}</th>)}</tr></thead>
        <tbody>{(venta.items||[]).map((it,i) => <tr key={i} style={{ borderBottom:"1px solid #f3f4f6" }}><td style={{ padding:"8px 0" }}>{it.nombre}</td><td style={{ textAlign:"right", padding:"8px 0", color:"#666" }}>{it.cantidad}</td><td style={{ textAlign:"right", padding:"8px 0", color:"#666" }}>{fmtMoney(it.precio, moneda)}</td><td style={{ textAlign:"right", padding:"8px 0", fontWeight:600 }}>{fmtMoney(it.precio * it.cantidad, moneda)}</td></tr>)}</tbody>
      </table>
      <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:12, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}><span style={{ color:"#666" }}>Subtotal</span><span>{fmtMoney(venta.subtotal, moneda)}</span></div>
        {venta.descuento > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#dc2626", marginBottom:4 }}><span>Descuento</span><span>-{fmtMoney(venta.descuento, moneda)}</span></div>}
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:16 }}><span>Total</span><span>{fmtMoney(venta.total, moneda)}</span></div>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onClose}>Cerrar</button>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setVerTicket(true)}>🖨️ Ticket</button>
        {venta.factura?.estado === "emitida" && onVerComprobante && (
          <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onVerComprobante}>🏛️ Factura {venta.factura.tipo}</button>
        )}
        {!venta.anulada && <button style={{ ...G.btn("red"), flex:1, justifyContent:"center" }} onClick={onAnular}>Anular</button>}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════

function DashboardPage({ ctx }) {
  const { config, caja, setCaja, sales, products, setPage } = ctx;
  const [showCaja, setShowCaja] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const hoy = todayStr(), thisMes = hoy.slice(0, 7);
  const ventasHoy = sales.filter(s => !s.anulada && s.fecha === hoy);
  const ventasMes = sales.filter(s => !s.anulada && s.fecha.startsWith(thisMes));
  const totalHoy = ventasHoy.reduce((a, s) => a + s.total, 0);
  const totalMes = ventasMes.reduce((a, s) => a + s.total, 0);
  const totalStock = products.reduce((a, p) => a + p.stock, 0);
  const stockBajoCount = products.filter(p => p.stock <= (p.stockMinimo || 3)).length;
  const recientes = [...sales].sort((a, b) => b.numero - a.numero).slice(0, 5);
  const alertas = products.filter(p => p.stock <= (p.stockMinimo || 3)).slice(0, 6);
  const hace15 = subDays(hoy, 15), hace30 = subDays(hoy, 30);

  // Productos Calientes — top 5 más vendidos en últimos 15 días
  const prodMap15 = {};
  sales.filter(s => !s.anulada && s.fecha >= hace15).forEach(s =>
    (s.items||[]).forEach(i => { prodMap15[i.productoId] = (prodMap15[i.productoId]||0) + i.cantidad; })
  );
  const calientes = Object.entries(prodMap15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, qty]) => ({ prod: products.find(p => p.id === id), qty }))
    .filter(x => x.prod);

  // Productos Fríos — 5 menos vendidos en últimos 30 días (con stock > 0)
  const prodMap30 = {};
  sales.filter(s => !s.anulada && s.fecha >= hace30).forEach(s =>
    (s.items||[]).forEach(i => { prodMap30[i.productoId] = (prodMap30[i.productoId]||0) + i.cantidad; })
  );
  const frios = products
    .filter(p => p.stock > 0)
    .map(p => ({ prod: p, qty: prodMap30[p.id] || 0 }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5);

  // Productos por vencer — solo para rubros con vencimiento
  const tieneVencimiento = RUBROS_CON_VENCIMIENTO.includes(config.rubro);
  const en30dias = addDays(hoy, 30);
  const porVencer = tieneVencimiento
    ? products
        .filter(p => p.vencimiento && p.stock > 0)
        .map(p => {
          const dias = Math.ceil((new Date(p.vencimiento + "T12:00:00") - new Date(hoy + "T12:00:00")) / (1000 * 60 * 60 * 24));
          return { ...p, dias };
        })
        .filter(p => p.dias <= 30)
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 5)
    : [];

  const vencimientoBadge = (dias) => {
    if (dias < 0) return { label: "Vencido", bg: "#fee2e2", color: "#dc2626" };
    if (dias === 0) return { label: "Vence hoy", bg: "#fee2e2", color: "#dc2626" };
    if (dias <= 7) return { label: `${dias}d`, bg: "#fee2e2", color: "#dc2626" };
    if (dias <= 15) return { label: `${dias}d`, bg: "#fef3c7", color: "#d97706" };
    return { label: `${dias}d`, bg: "#fef9c3", color: "#a16207" };
  };

  return (
    <div className="app-page-pad" style={G.page}>
      {showCaja && <AbrirCajaModal setCaja={setCaja} saveCaja={ctx.saveCaja} onClose={() => setShowCaja(false)} />}
      {showCerrar && <CerrarCajaModal caja={caja} sales={sales} config={config} setCaja={setCaja} saveCaja={ctx.saveCaja} onClose={() => setShowCerrar(false)} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>¡Bienvenido de nuevo!</h1>
          <p style={{ margin:0, color:"#888", fontSize:14 }}>{new Date().toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" })}</p>
        </div>
        {caja.abierta && <button style={G.btn("outline")} onClick={() => setShowCerrar(true)}><Lock size={14}/> Cerrar Caja</button>}
      </div>
      <CajaBanner caja={caja} onAbrir={() => setShowCaja(true)} />
      {stockBajoCount > 0 && (
        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13 }}>
          <span style={{ display:"flex", alignItems:"center", gap:8, color:"#92400e" }}>
            <AlertTriangle size={15} color="#d97706"/>
            <b>{stockBajoCount} producto{stockBajoCount!==1?"s":""}</b> con stock bajo o sin stock
          </span>
          <button onClick={() => setPage("inventario")} style={{ background:"none", border:"none", color:"#92400e", fontWeight:700, cursor:"pointer", fontSize:12, textDecoration:"underline" }}>Ver inventario</button>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard icon={<DollarSign size={19}/>} bg="#dcfce7" label="Ventas del día" value={fmtMoney(totalHoy, config.moneda)} badge="Hoy" />
        <StatCard icon={<TrendingUp size={19}/>} bg="#ede9fe" label="Ventas del mes" value={fmtMoney(totalMes, config.moneda)} badge="Mes" />
        <StatCard icon={<Package size={19}/>} bg="#dbeafe" label="Unidades en stock" value={totalStock} />
        <StatCard icon={<AlertTriangle size={19}/>} bg="#fef3c7" label="Stock bajo" value={stockBajoCount} textColor={stockBajoCount > 0 ? "#d97706" : "#111"} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:20, marginBottom:20 }}>
        <div style={G.card()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Ventas recientes</h3>
            <button onClick={() => setPage("historial")} style={{ background:"none", border:"none", color:"#666", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>Ver todas <ChevronRight size={13}/></button>
          </div>
          {recientes.length === 0 ? (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#bbb" }}>
              <div style={{ marginBottom:8, opacity:0.25, color:"#aaa" }}><ShoppingBag size={32}/></div>
              <div style={{ fontSize:13, color:"#aaa" }}>No hay ventas aún</div>
              <button onClick={() => setPage("venta")} style={{ background:"none", border:"none", color:"#111", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>Registrar primera venta</button>
            </div>
          ) : recientes.map(s => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f5f5f5" }}>
              <div><div style={{ fontWeight:600, fontSize:13 }}>{s.cliente || "Cliente"}</div><div style={{ color:"#aaa", fontSize:11 }}>{fmtDate(s.fecha)} · {s.metodoPago}</div></div>
              <div style={{ fontWeight:700, color:"#16a34a", fontSize:13 }}>{fmtMoney(s.total, config.moneda)}</div>
            </div>
          ))}
        </div>
        <div style={G.card()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Alertas de stock</h3>
            <button onClick={() => setPage("inventario")} style={{ background:"none", border:"none", color:"#666", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>Ver productos <ChevronRight size={13}/></button>
          </div>
          {alertas.length === 0 ? (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#bbb" }}>
              <div style={{ marginBottom:8, opacity:0.25, color:"#aaa" }}><Package size={32}/></div>
              <div style={{ fontWeight:600, fontSize:13, color:"#aaa" }}>Todo el stock está bien</div>
              <div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>No hay productos con stock bajo</div>
            </div>
          ) : alertas.map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #f5f5f5" }}>
              <div style={{ fontWeight:500, fontSize:13 }}>{p.nombre}</div>
              <StockBadge stock={p.stock} min={p.stockMinimo} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:20 }}>
        <div style={G.card()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}><Flame size={15} color="#f97316"/>Productos Calientes</h3>
            <span style={{ fontSize:12, color:"#aaa" }}>Últimos 15 días</span>
          </div>
          {calientes.length === 0 ? <div style={{ textAlign:"center", padding:"24px 0", color:"#bbb", fontSize:13 }}><div style={{ marginBottom:8, opacity:0.25, color:"#aaa" }}><Package size={32}/></div>Sin ventas recientes</div> :
            calientes.map(({ prod, qty }) => (
              <div key={prod.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f5f5f5", fontSize:13 }}>
                <div style={{ fontWeight:500 }}>{prod.nombre}</div>
                <span style={{ color:"#16a34a", fontWeight:700 }}>{qty} vendidos</span>
              </div>
            ))}
        </div>
        <div style={G.card()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}><Snowflake size={15} color="#60a5fa"/>Productos Fríos</h3>
            <span style={{ fontSize:12, color:"#aaa" }}>Últimos 30 días</span>
          </div>
          {frios.length === 0
            ? <div style={{ textAlign:"center", padding:"24px 0", color:"#bbb", fontSize:13 }}><div style={{ marginBottom:8, opacity:0.25, color:"#aaa" }}><Package size={32}/></div>No hay productos con stock</div>
            : frios.map(({ prod, qty }) => (
              <div key={prod.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f5f5f5", fontSize:13 }}>
                <div style={{ fontWeight:500 }}>{prod.nombre}</div>
                <span style={{ color: qty === 0 ? "#ef4444" : "#f59e0b", fontWeight:700 }}>
                  {qty === 0 ? "Sin ventas" : `${qty} vendidos`}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Productos por vencer — solo rubros con vencimiento */}
      {tieneVencimiento && (
        <div style={{ ...G.card({ marginTop:20 }) }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}><Timer size={15} color="#f59e0b"/>Productos por Vencer</h3>
            <span style={{ fontSize:12, color:"#aaa" }}>Próximos 30 días</span>
          </div>
          {porVencer.length === 0 ? (
            <div style={{ textAlign:"center", padding:"24px 0", color:"#bbb" }}>
              <div style={{ marginBottom:8, opacity:0.5, color:"#16a34a" }}><CheckCircle2 size={32}/></div>
              <div style={{ fontSize:13 }}>No hay productos por vencer en los próximos 30 días</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:10 }}>
              {porVencer.map(p => {
                const badge = vencimientoBadge(p.dias);
                return (
                  <div key={p.id} style={{ background: badge.bg + "55", border:`1.5px solid ${badge.bg}`, borderRadius:10, padding:"12px 14px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, lineHeight:1.3, flex:1, marginRight:8 }}>{p.nombre}</span>
                      <span style={{ background:badge.bg, color:badge.color, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap", border:`1px solid ${badge.color}33` }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#888" }}>Vence: {fmtDate(p.vencimiento)}</div>
                    <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Stock: {p.stock} unidades</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Selector de Talle para Nueva Venta ────────────────────
function TalleSelectorModal({ prod, onSelect, onClose, moneda }) {
  const [talleSelec, setTalleSelec] = useState(null);
  const stockPorTalle = prod.stockPorTalle || {};
  const totalDisp = Object.values(stockPorTalle).reduce((a,v) => a+(+v||0), 0);

  return (
    <Modal title={prod.nombre} subtitle={prod.categoria} onClose={onClose} width={420}>
      {prod.imagen && (
        <img src={prod.imagen} alt={prod.nombre} style={{ width:"100%", height:160, objectFit:"cover", borderRadius:10, marginBottom:16 }} onError={e => e.target.style.display="none"} />
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span style={{ fontWeight:800, fontSize:22, color:"#111" }}>{fmtMoney(prod.precio, moneda)}</span>
        <span style={{ fontSize:12, color:"#888" }}>{totalDisp} unidades disponibles</span>
      </div>

      {/* Colores */}
      {prod.colores?.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {(prod.colores||[]).map(c => (
            <span key={c} style={{ background:"#f3f4f6", borderRadius:20, padding:"4px 12px", fontSize:12, color:"#555", fontWeight:500 }}>{c}</span>
          ))}
        </div>
      )}

      {/* Talles */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#666", marginBottom:10 }}>Seleccionar talle:</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8 }}>
          {(prod.talles||[]).map(t => {
            const cnt = stockPorTalle[t] || 0;
            const agotado = cnt === 0;
            const selec = talleSelec === t;
            return (
              <button key={t} onClick={() => !agotado && setTalleSelec(t)} style={{
                borderRadius:10, border:`2px solid ${selec?"#111":agotado?"#f5f5f5":"#e5e7eb"}`,
                padding:"10px 8px", cursor:agotado?"not-allowed":"pointer", textAlign:"center",
                background: selec?"#111":agotado?"#fafafa":"#fff",
                opacity: agotado ? 0.45 : 1, transition:"all .15s"
              }}>
                <div style={{ fontSize:13, fontWeight:700, color:selec?"#fff":agotado?"#bbb":"#111" }}>{t}</div>
                <div style={{ fontSize:11, color:selec?"#ccc":agotado?"#ccc":"#888", marginTop:2 }}>{cnt} ud.</div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        style={{ ...G.btn(talleSelec ? "dark" : "light"), width:"100%", justifyContent:"center", padding:"13px", fontSize:15 }}
        onClick={() => { if (talleSelec) { onSelect(talleSelec, stockPorTalle[talleSelec]); onClose(); } }}
        disabled={!talleSelec}
      >
        {talleSelec ? `Agregar talle ${talleSelec} al carrito` : "Seleccioná un talle"}
      </button>
    </Modal>
  );
}

// ── Buscador de Productos (popup en Nueva Venta) ───────────
function BuscadorProductosModal({ products, esModa, cart, moneda, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const inputRef = useRef();

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const filtrados = products.filter(p => {
    const tieneStock = esModa && p.stockPorTalle
      ? Object.values(p.stockPorTalle).some(v => +v > 0)
      : p.stock > 0;
    if (!tieneStock) return false;
    if (!q) return true;
    const busq = q.toLowerCase();
    const trimmed = q.trim();
    // Si es código de barras exacto (solo dígitos 8+) → match exacto
    if (/^\d{8,}$/.test(trimmed)) {
      return (p.codigoBarras || "").trim() === trimmed;
    }
    return p.nombre.toLowerCase().includes(busq) || (p.sku||"").toLowerCase().includes(busq) || (p.categoria||"").toLowerCase().includes(busq) || (p.codigoBarras||"").includes(trimmed);
  });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9500, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:40, paddingBottom:20, overflowY:"auto" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:14, width:780, maxWidth:"96vw", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f0f0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#f5f5f5", borderRadius:10, padding:"10px 14px" }}>
            <Search size={16} color="#888"/>
            <input
              ref={inputRef}
              style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:15, color:"#111" }}
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && <button onClick={() => setQ("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#bbb", display:"flex" }}><X size={16}/></button>}
          </div>
        </div>

        {/* Product grid — same card style as inventory */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
          {filtrados.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:"#bbb" }}>
              <div style={{ marginBottom:8, opacity:0.25 }}><Package size={36}/></div>
              <div>{q ? `Sin resultados para "${q}"` : "No hay productos con stock"}</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
              {filtrados.map(p => {
                const inCart = cart.filter(i => (i.productoId||i.id) === p.id);
                const totalEnCarrito = inCart.reduce((a, i) => a + i.cantidad, 0);
                const totalStock = esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).reduce((a,v)=>a+(+v||0),0) : p.stock;
                return (
                  <div key={p.id} onClick={() => onSelect(p)}
                    style={{ background:"#fff", border:`1.5px solid ${totalEnCarrito>0?"#111":"#ebebeb"}`, borderRadius:14, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,0.05)", transition:"border-color .15s" }}>
                    {p.imagen
                      ? <img src={p.imagen} alt={p.nombre} style={{ width:"100%", height:120, objectFit:"cover", display:"block" }} onError={e => e.target.style.display="none"} />
                      : <div style={{ width:"100%", height:100, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", color:"#ddd" }}><Package size={32}/></div>
                    }
                    <div style={{ padding:"9px 10px 6px" }}>
                      {totalEnCarrito > 0 && <div style={{ marginBottom:4 }}><span style={{ background:"#111", color:"#fff", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:20 }}>{totalEnCarrito} en carrito</span></div>}
                      <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:6 }}>
                        <span style={{ fontWeight:800, fontSize:12, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.nombre}</span>
                        {p.sku && <span style={{ fontSize:9, color:"#bbb", whiteSpace:"nowrap" }}>{p.sku}</span>}
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: esModa && (p.talles||[]).length>0 ? 6 : 0 }}>
                        <span style={{ fontWeight:800, fontSize:14, color:"#111" }}>{fmtMoney(p.precio, moneda)}</span>
                        <span style={{ fontSize:10, color: totalStock<=3?"#d97706":"#bbb" }}>{totalStock} ud.</span>
                      </div>
                      {esModa && (p.talles||[]).length > 0 && (
                        <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min((p.talles||[]).length,6)},1fr)`, gap:3 }}>
                          {(p.talles||[]).map(t => {
                            const cnt = (p.stockPorTalle||{})[t]||0;
                            return <div key={t} style={{ background:cnt===0?"#fff0f0":"#fafafa", border:`1px solid ${cnt===0?"#fca5a5":"#e5e7eb"}`, borderRadius:5, padding:"2px 1px", textAlign:"center" }}>
                              <div style={{ fontSize:7, color:"#999" }}>{t}</div>
                              <div style={{ fontWeight:700, fontSize:10, color:cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                            </div>;
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ borderTop:"1px solid #f5f5f5", padding:"7px 10px", display:"flex", alignItems:"center", gap:6 }}>
                      {p.colores?.[0] && <span style={{ fontSize:10, color:"#888" }}>{p.colores[0]}</span>}
                      <span style={{ fontSize:10, color:"#bbb", marginLeft:"auto" }}>{p.categoria}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"10px 20px", borderTop:"1px solid #f0f0f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#bbb" }}>{filtrados.length} producto{filtrados.length !== 1 ? "s" : ""} {q ? "encontrado" : "disponible"}{filtrados.length !== 1 ? "s" : ""}</span>
          <button onClick={onClose} style={{ ...G.btn("outline"), padding:"6px 14px", fontSize:12 }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function VentaPage({ ctx }) {
  const { config, caja, setCaja, products, setProducts, sales, setSales } = ctx;
  const esModa = RUBROS_CON_TALLES.includes(config.rubro);
  const [search, setSearch] = useState("");
  const [showBuscador, setShowBuscador] = useState(false);
  const [cart, setCart] = useState([]);
  const [cliente, setCliente] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [descTipo, setDescTipo] = useState("monto");
  const [descValor, setDescValor] = useState("");
  const [efectivoDado, setEfectivoDado] = useState("");
  const [showCaja, setShowCaja] = useState(false);
  const [showCambio, setShowCambio] = useState(false);
  const [ventaExito, setVentaExito] = useState(null);
  const [ventaParaFacturar, setVentaParaFacturar] = useState(null);
  const [comprobanteVer, setComprobanteVer] = useState(null);
  const [prodTalle, setProdTalle] = useState(null);
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  // Detección inteligente: si el texto de búsqueda es solo dígitos y tiene 8+ caracteres → busca por código de barras exacto
  const buscarPorCodigo = /^\d{8,}$/.test(search.trim());

  const prods = products.filter(p => {
    const tieneStock = esModa && p.stockPorTalle
      ? Object.values(p.stockPorTalle).some(v => +v > 0)
      : p.stock > 0;
    if (!tieneStock) return false;
    if (buscarPorCodigo) {
      return (p.codigoBarras || "").trim() === search.trim();
    }
    return p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.codigoBarras || "").includes(search);
  });

  // Cuando escanean con la cámara, procesamos el código directamente
  const procesarCodigoEscaneado = (codigo) => {
    setEscanerAbierto(false);
    const encontrado = products.find(p => (p.codigoBarras || "").trim() === codigo.trim());
    if (!encontrado) {
      setSearch(codigo);
      setShowBuscador(true);
      return;
    }
    // Verificar stock
    const tieneStock = esModa && encontrado.stockPorTalle
      ? Object.values(encontrado.stockPorTalle).some(v => +v > 0)
      : encontrado.stock > 0;
    if (!tieneStock) {
      alert(`"${encontrado.nombre}" no tiene stock disponible`);
      return;
    }
    handleProdClick(encontrado);
  };

  const subtotal = cart.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const descMonto = descTipo === "pct" ? subtotal * (+descValor / 100) : (+descValor || 0);
  const total = Math.max(0, subtotal - descMonto);
  const cambio = metodoPago === "Efectivo" && +efectivoDado > total ? +efectivoDado - total : 0;

  const addToCart = (prod, talle = null, stockMax = null) => {
    const cartKey = talle ? `${prod.id}__${talle}` : prod.id;
    const maxStock = stockMax !== null ? stockMax : prod.stock;
    setCart(prev => {
      const idx = prev.findIndex(i => i.cartKey === cartKey);
      if (idx >= 0) {
        if (prev[idx].cantidad >= maxStock) return prev;
        return prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it);
      }
      return [...prev, { cartKey, id: prod.id, nombre: prod.nombre + (talle ? ` — T.${talle}` : ""), precio: prod.precio, cantidad: 1, stock: maxStock, talle, productoId: prod.id }];
    });
  };

  const handleProdClick = (prod) => {
    if (esModa && prod.talles?.length > 0 && prod.stockPorTalle) {
      setProdTalle(prod);
    } else {
      addToCart(prod);
    }
  };

  const removeFromCart = (cartKey) => setCart(prev => prev.filter(i => i.cartKey !== cartKey));
  const updateQty = (cartKey, qty) => {
    if (+qty <= 0) { removeFromCart(cartKey); return; }
    setCart(prev => prev.map(i => i.cartKey === cartKey ? { ...i, cantidad: Math.min(+qty, i.stock) } : i));
  };

  const [guardandoVenta, setGuardandoVenta] = useState(false);

  const completarVenta = async () => {
    if (guardandoVenta) return; // evita doble click → venta duplicada
    if (cart.length === 0 || !metodoPago) return;
    if (!caja.abierta) { setShowCaja(true); return; }
    setGuardandoVenta(true);
    try {
    const venta = {
      id: uid(), numero: sales.reduce((mx, s) => Math.max(mx, +s.numero || 0), 0) + 1, fecha: todayStr(), cliente, metodoPago,
      items: cart.map(i => ({ productoId: i.productoId || i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, talle: i.talle || null })),
      subtotal, descuento: descMonto, descuentoTipo: descTipo, total, efectivoDado: +efectivoDado || 0, cambio: Math.round(cambio)
    };
    const affectedIds = new Set(cart.map(i => i.productoId || i.id));
    const updatedProducts = products.map(p => {
      const itemsTalle = cart.filter(i => (i.productoId || i.id) === p.id && i.talle);
      const itemsSin = cart.filter(i => (i.productoId || i.id) === p.id && !i.talle);
      if (!itemsTalle.length && !itemsSin.length) return p;
      let upd = { ...p };
      if (itemsTalle.length && upd.stockPorTalle) {
        const spt = { ...upd.stockPorTalle };
        itemsTalle.forEach(it => { spt[it.talle] = Math.max(0, (spt[it.talle] || 0) - it.cantidad); });
        upd = { ...upd, stockPorTalle: spt, stock: Object.values(spt).reduce((a, v) => a + (+v || 0), 0) };
      }
      if (itemsSin.length) {
        const desc = itemsSin.reduce((a, i) => a + i.cantidad, 0);
        upd = { ...upd, stock: Math.max(0, upd.stock - desc) };
      }
      return upd;
    });
    setProducts(updatedProducts);
    setSales(prev => [...prev, venta]);
    setVentaParaFacturar(venta);
    // Guardar en Supabase (await para asegurar persistencia)
    await ctx.saveVenta(venta);
    await ctx.saveProducts(updatedProducts.filter(p => affectedIds.has(p.id)));
    setCart([]); setCliente(""); setMetodoPago(""); setDescValor(""); setEfectivoDado("");
    } finally {
      setGuardandoVenta(false);
    }
  };

  return (
    <div className="app-page-pad" style={G.page}>
      {showCaja && <AbrirCajaModal setCaja={setCaja} onClose={() => setShowCaja(false)} />}
      {ventaExito && !ventaParaFacturar && <VentaExitoModal venta={ventaExito} config={config} onClose={() => setVentaExito(null)} />}
      {ventaParaFacturar && (
        <FacturarModal
          venta={ventaParaFacturar} config={config} sales={sales}
          onFacturar={async (facturaData) => {
            const updatedVenta = { ...ventaParaFacturar, factura: facturaData };
            setSales(prev => prev.map(s => s.id === ventaParaFacturar.id ? updatedVenta : s));
            setVentaParaFacturar(null);
            setVentaExito(ventaParaFacturar);
            await ctx.saveVenta(updatedVenta);
          }}
          onSinFactura={() => { setVentaParaFacturar(null); setVentaExito(ventaParaFacturar); }}
          onClose={() => { setVentaParaFacturar(null); setVentaExito(ventaParaFacturar); }}
        />
      )}
      {comprobanteVer && <ComprobanteModal venta={comprobanteVer} config={config} onClose={() => setComprobanteVer(null)} />}
      {showCambio && <CambioProductosModal products={products} setProducts={setProducts} saveProducts={ctx.saveProducts} rubro={config.rubro} onClose={() => setShowCambio(false)} />}
      {prodTalle && <TalleSelectorModal prod={prodTalle} moneda={config.moneda} onSelect={(talle, stock) => addToCart(prodTalle, talle, stock)} onClose={() => setProdTalle(null)} />}
      {escanerAbierto && (
        <EscanerModal
          titulo="Escanear producto"
          onDetectado={procesarCodigoEscaneado}
          onClose={() => setEscanerAbierto(false)}
        />
      )}
      {showBuscador && (
        <BuscadorProductosModal
          products={products} esModa={esModa} cart={cart} moneda={config.moneda}
          onSelect={(prod) => {
            setShowBuscador(false);
            // Esperar que el buscador se cierre antes de abrir el selector de talle
            requestAnimationFrame(() => handleProdClick(prod));
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Nueva Venta</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>Registra una venta rápidamente</p></div>
        <button style={G.btn("outline")} onClick={() => setShowCambio(true)}><RefreshCw size={14}/> Cambio</button>
      </div>
      <CajaBanner caja={caja} onAbrir={() => setShowCaja(true)} />
      <div className="venta-grid" style={{ display:"grid", gridTemplateColumns:"1fr 370px", gap:24, alignItems:"start" }}>
        <div>
          {/* Barra de búsqueda + botón de escanear */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div
              onClick={() => setShowBuscador(true)}
              style={{ flex: 1, display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"11px 16px", cursor:"pointer", transition:"border-color .15s" }}
            >
              <Search size={16} color="#bbb"/>
              <span style={{ color:"#bbb", fontSize:14 }}>Buscar producto o código de barras...</span>
            </div>
            <button
              onClick={() => setEscanerAbierto(true)}
              style={{ background:"#111", color:"#fff", border:"none", borderRadius:10, padding:"0 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600 }}
              title="Escanear código de barras con la cámara"
            >
              <ScanLine size={18}/> Escanear
            </button>
          </div>

          {/* Accesos rápidos — últimos 4 productos más vendidos o más recientes */}
          {products.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:"#999", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>Accesos rápidos</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
                {products
                  .filter(p => esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).some(v => +v > 0) : p.stock > 0)
                  .slice(0, 4)
                  .map(p => {
                    const inCart = cart.filter(i => (i.productoId||i.id) === p.id);
                    const totalEnCarrito = inCart.reduce((a, i) => a + i.cantidad, 0);
                    const totalStock = esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).reduce((a,v) => a+(+v||0),0) : p.stock;
                    return (
                      <div key={p.id} onClick={() => handleProdClick(p)}
                        style={{ background:"#fff", border:`1.5px solid ${totalEnCarrito>0?"#111":"#ebebeb"}`, borderRadius:14, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,0.05)", transition:"border-color .15s" }}>
                        {p.imagen
                          ? <img src={p.imagen} alt={p.nombre} style={{ width:"100%", height:130, objectFit:"cover", display:"block" }} onError={e => e.target.style.display="none"} />
                          : <div style={{ width:"100%", height:110, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", color:"#ddd" }}><Package size={36}/></div>
                        }
                        <div style={{ padding:"9px 12px 6px" }}>
                          {totalEnCarrito > 0 && <div style={{ marginBottom:4 }}><span style={{ background:"#111", color:"#fff", fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:20 }}>{totalEnCarrito} en carrito</span></div>}
                          <div style={{ display:"flex", alignItems:"baseline", gap:5, marginBottom:6 }}>
                            <span style={{ fontWeight:800, fontSize:12, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.nombre}</span>
                            {p.sku && <span style={{ fontSize:9, color:"#bbb", whiteSpace:"nowrap" }}>{p.sku}</span>}
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: esModa && (p.talles||[]).length>0 ? 6 : 0 }}>
                            <span style={{ fontWeight:800, fontSize:15, color:"#111" }}>{fmtMoney(p.precio, config.moneda)}</span>
                            <span style={{ fontSize:11, color: totalStock<=3?"#d97706":"#bbb" }}>{totalStock} ud.</span>
                          </div>
                          {esModa && (p.talles||[]).length > 0 && (
                            <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min((p.talles||[]).length,6)},1fr)`, gap:3 }}>
                              {(p.talles||[]).map(t => {
                                const cnt = (p.stockPorTalle||{})[t]||0;
                                return <div key={t} style={{ background:cnt===0?"#fff0f0":"#fafafa", border:`1px solid ${cnt===0?"#fca5a5":"#e5e7eb"}`, borderRadius:5, padding:"2px 1px", textAlign:"center" }}>
                                  <div style={{ fontSize:7, color:"#999" }}>{t}</div>
                                  <div style={{ fontWeight:700, fontSize:10, color:cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                                </div>;
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ borderTop:"1px solid #f5f5f5", padding:"7px 12px", display:"flex", alignItems:"center" }}>
                          {p.colores?.[0] && <span style={{ fontSize:10, color:"#888" }}>{p.colores[0]}</span>}
                          <span style={{ fontSize:10, color:"#bbb", marginLeft:"auto" }}>{p.categoria}</span>
                        </div>
                      </div>
                    );
                })}
              </div>
              <button onClick={() => setShowBuscador(true)} style={{ ...G.btn("ghost"), width:"100%", justifyContent:"center", marginTop:12, fontSize:13, color:"#888", border:"1px dashed #e5e7eb", borderRadius:9, padding:"10px" }}>
                <Search size={13}/> Ver todos los productos ({products.filter(p => esModa && p.stockPorTalle ? Object.values(p.stockPorTalle).some(v=>+v>0) : p.stock > 0).length} disponibles)
              </button>
            </>
          )}

          {products.length === 0 && (
            <Empty icon={<Package size={36}/>} text="No hay productos cargados" btnText="Ir a Inventario" onBtn={() => ctx.setPage("inventario")} />
          )}
        </div>
        <div style={{ ...G.card({ padding:20 }), position:"sticky", top:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <ShoppingCart size={18}/>
            <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>Carrito</h3>
            {cart.length > 0 && <span style={{ marginLeft:"auto", background:"#f3f4f6", color:"#666", fontSize:11, padding:"2px 9px", borderRadius:20 }}>{cart.reduce((a,i) => a+i.cantidad, 0)} items</span>}
          </div>
          {cart.length === 0 ? (
            <div style={{ textAlign:"center", padding:"22px 0 18px", color:"#ccc", borderBottom:"1px solid #f5f5f5", marginBottom:16 }}>
              <div style={{ marginBottom:6, opacity:0.25, color:"#aaa" }}><ShoppingBag size={30}/></div>
              <div style={{ fontSize:13, fontWeight:500, color:"#bbb" }}>Carrito vacío</div>
              <div style={{ fontSize:11, marginTop:2, color:"#ccc" }}>Selecciona productos</div>
            </div>
          ) : (
            <div style={{ borderBottom:"1px solid #f5f5f5", marginBottom:14, maxHeight:230, overflowY:"auto" }}>
              {cart.map(item => (
                <div key={item.cartKey} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #f9f9f9" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.nombre}</div>
                    <div style={{ color:"#bbb", fontSize:11 }}>{fmtMoney(item.precio, config.moneda)} c/u</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <button onClick={() => updateQty(item.cartKey, item.cantidad-1)} style={{ width:24, height:24, borderRadius:6, border:"1.5px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <span style={{ minWidth:22, textAlign:"center", fontWeight:700, fontSize:13 }}>{item.cantidad}</span>
                    <button onClick={() => updateQty(item.cartKey, item.cantidad+1)} style={{ width:24, height:24, borderRadius:6, border:"1.5px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  </div>
                  <div style={{ minWidth:54, textAlign:"right", fontWeight:700, fontSize:13 }}>{fmtMoney(item.precio*item.cantidad, config.moneda)}</div>
                  <button onClick={() => removeFromCart(item.cartKey)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:13, padding:"0 2px" }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <input style={{ ...G.inp(), marginBottom:10 }} placeholder="Nombre cliente (opcional)" value={cliente} onChange={e => setCliente(e.target.value)} />
          <select style={{ ...G.inp(), marginBottom:10 }} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
            <option value="">Método de pago *</option>
            {PAGOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {metodoPago === "Efectivo" && <input style={{ ...G.inp(), marginBottom:10 }} type="number" placeholder="Efectivo recibido" value={efectivoDado} onChange={e => setEfectivoDado(e.target.value)} />}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:"#999", marginBottom:6, fontWeight:600 }}>Descuento</div>
            <div style={{ display:"flex", marginBottom:8 }}>
              {[["monto","$ Monto"],["pct","% Porcentaje"]].map(([v,l]) => (
                <button key={v} onClick={() => { setDescTipo(v); setDescValor(""); }} style={{ flex:1, padding:"7px", border:"1px solid #e5e7eb", cursor:"pointer", fontSize:12, fontWeight:descTipo===v?700:400, background:descTipo===v?"#111":"#fff", color:descTipo===v?"#fff":"#666", borderRadius:v==="monto"?"7px 0 0 7px":"0 7px 7px 0", borderLeft:v==="pct"?"none":undefined }}>{l}</button>
              ))}
            </div>
            <input style={G.inp()} type="number" min={0} max={descTipo==="pct"?100:undefined} placeholder="0" value={descValor} onChange={e => setDescValor(e.target.value)} />
          </div>
          <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:12, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}><span style={{ color:"#999" }}>Subtotal</span><span>{fmtMoney(subtotal, config.moneda)}</span></div>
            {descMonto > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#dc2626", marginBottom:5 }}><span>Descuento</span><span>-{fmtMoney(descMonto, config.moneda)}</span></div>}
            {metodoPago === "Efectivo" && +efectivoDado > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#2563eb", marginBottom:5 }}><span>Cambio</span><span style={{ fontWeight:600 }}>{fmtMoney(cambio, config.moneda)}</span></div>}
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:17 }}><span>Total</span><span>{fmtMoney(total, config.moneda)}</span></div>
          </div>
          <button disabled={guardandoVenta} onClick={() => { if (!caja.abierta) setShowCaja(true); else completarVenta(); }} style={{ ...G.btn(cart.length>0&&metodoPago&&!guardandoVenta?"dark":"light"), width:"100%", justifyContent:"center", padding:"13px", fontSize:14, cursor: guardandoVenta ? "wait" : "pointer" }}>
            {guardandoVenta ? "Guardando..." : "Completar venta"}
          </button>
          {cart.length > 0 && <button onClick={() => setCart([])} style={{ ...G.btn("ghost"), width:"100%", justifyContent:"center", marginTop:8, fontSize:12, color:"#999" }}>Vaciar carrito</button>}
        </div>
      </div>
    </div>
  );
}

const CAMPOS_IMPORT = [
  { key:"nombre",      label:"Nombre *",      required:true  },
  { key:"precio",      label:"Precio *",      required:true  },
  { key:"costo",       label:"Costo",         required:false },
  { key:"stock",       label:"Stock",         required:false },
  { key:"stockMinimo", label:"Stock mínimo",  required:false },
  { key:"categoria",   label:"Categoría",     required:false },
  { key:"sku",         label:"SKU / Código",  required:false },
  { key:"descripcion", label:"Descripción",   required:false },
  { key:"marca",       label:"Marca",         required:false },
];

// Parseo robusto de números (todos los formatos)
function parseNumero(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  let s = String(val).trim().replace(/[$€\s]/g, "");
  if (!s) return 0;
  // "79,995.00" → americano: coma=miles, punto=decimal
  if (/\d,\d{3}\./.test(s)) return parseFloat(s.replace(/,/g,"")) || 0;
  // "79.995,00" → argentino: punto=miles, coma=decimal
  if (/\d\.\d{3},/.test(s)) return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
  // "79.995" → punto como miles sin decimal
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g,"")) || 0;
  // "79,995" → coma como miles sin decimal
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return parseFloat(s.replace(/,/g,"")) || 0;
  // Reemplazar coma por punto y parsear
  return parseFloat(s.replace(",",".")) || 0;
}

// Parser CSV con soporte para punto y coma como separador
function parsearCSV(texto, separador=",") {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  return lineas.map(linea => {
    const cols = [];
    let actual = "", enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      if (linea[i] === '"') { enComillas = !enComillas; }
      else if (linea[i] === separador && !enComillas) { cols.push(actual.trim()); actual = ""; }
      else { actual += linea[i]; }
    }
    cols.push(actual.trim());
    return cols;
  });
}

// Detectar si es formato Tiendanube y procesarlo agrupando variantes
function procesarTiendanube(hdrs, dataRows, cats) {
  const get = (row, col) => { const i = hdrs.indexOf(col); return i >= 0 ? String(row[i] ?? "").trim() : ""; };

  // Agrupar filas por Identificador de URL
  const grupos = {}, orden = [];
  dataRows.forEach(row => {
    const id = get(row, "Identificador de URL");
    if (!id) return;
    if (!grupos[id]) { grupos[id] = []; orden.push(id); }
    grupos[id].push(row);
  });

  return orden.map(id => {
    const rows = grupos[id];
    const first = rows.find(r => get(r, "Nombre")) || rows[0];

    const nombre    = get(first, "Nombre");
    const precio    = parseNumero(get(first, "Precio"));
    const categoria = get(first, "Categorías") || cats[0] || "General";
    const sku       = get(first, "SKU");
    const descripcion = get(first, "Descripción");
    const costo     = parseNumero(get(first, "Costo"));
    const marca     = get(first, "Marca");

    // Construir stockPorTalle y colores desde cada fila
    const stockPorTalle = {};
    const coloresSet = new Set();

    rows.forEach(row => {
      const p1nom = get(row, "Nombre de propiedad 1").toLowerCase();
      const p1val = get(row, "Valor de propiedad 1");
      const p2nom = get(row, "Nombre de propiedad 2").toLowerCase();
      const p2val = get(row, "Valor de propiedad 2");
      const stockVal = Math.round(parseNumero(get(row, "Stock")));

      // Detectar talle y color independientemente del orden de las propiedades
      let talle = "", color = "";
      if (p1nom === "talle" || p1nom === "size" || p1nom === "talla") talle = p1val;
      else if (p1nom === "color" || p1nom === "colour") color = p1val;
      if (p2nom === "talle" || p2nom === "size" || p2nom === "talla") talle = p2val;
      else if (p2nom === "color" || p2nom === "colour") color = p2val;

      // También revisar propiedad 3
      const p3nom = get(row, "Nombre de propiedad 3").toLowerCase();
      const p3val = get(row, "Valor de propiedad 3");
      if (p3nom === "talle" || p3nom === "size") talle = p3val;
      else if (p3nom === "color" || p3nom === "colour") color = p3val;

      if (color) coloresSet.add(color);
      if (talle) {
        stockPorTalle[talle] = (stockPorTalle[talle] || 0) + stockVal;
      }
    });

    const talles = Object.keys(stockPorTalle);
    const totalStock = Object.values(stockPorTalle).reduce((a, v) => a + v, 0);

    if (!nombre || precio <= 0) return null;
    return {
      id: uid(), nombre, precio, costo, categoria, sku, descripcion, marca,
      stock: totalStock, stockMinimo: 3,
      talles, stockPorTalle, colores: [...coloresSet], imagen: ""
    };
  }).filter(Boolean);
}

function detectarColumna(header) {
  const h = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if (/nombre|name|producto|articulo|item|titulo|title/.test(h)) return "nombre";
  if (/(precio|price|pvp|valor).*(venta|pub|lista)?$/.test(h) && !/costo|cost|compra/.test(h)) return "precio";
  if (/costo|cost|compra|neto/.test(h)) return "costo";
  if (/stock$|^stock|cantidad|cant\b|unidad|unid|existencia|inventario|qty|disponib/.test(h)) return "stock";
  if (/stock.*(min|alert)|min.*stock/.test(h)) return "stockMinimo";
  if (/categ|rubro|tipo|linea|familia|seccion/.test(h)) return "categoria";
  if (/\bsku\b|codigo|^cod$|code|barcode|ean|referencia|ref\b|interno/.test(h)) return "sku";
  if (/desc(ripcion)?$|detalle|obs|nota/.test(h) && !/descuento/.test(h)) return "descripcion";
  if (/marca|brand|fabricante/.test(h)) return "marca";
  return null;
}

function ImportarExcelModal({ cats, onImport, onClose }) {
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapeo, setMapeo] = useState({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const [tiendanubePreview, setTiendanubePreview] = useState(null); // productos ya procesados de TN

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target.result;

        // Intentar leer como XLSX/XLS primero
        const wb = XLSX.read(raw, { type:"binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        let data = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });

        // Si la primera fila tiene 1 sola columna con punto y coma → CSV con separador ";"
        if (data.length > 0 && data[0].length <= 2 && String(data[0][0]).includes(";")) {
          data = parsearCSV(raw, ";");
        }

        if (data.length < 2) return;
        const hdrs = data[0].map(h => String(h).trim());
        const dataRows = data.slice(1).filter(r => r.some(c => c !== "" && c !== null));

        // Detectar Tiendanube: tiene columnas específicas
        const esTiendanube = hdrs.includes("Identificador de URL") && hdrs.includes("Nombre de propiedad 1");

        if (esTiendanube) {
          const productos = procesarTiendanube(hdrs, dataRows, cats);
          setTiendanubePreview(productos);
          setStep(3); // ir directo al preview
          return;
        }

        // Flujo genérico: mapeo manual
        setHeaders(hdrs);
        setRows(dataRows);
        const autoMapeo = {};
        hdrs.forEach(h => {
          const campo = detectarColumna(h);
          if (campo && !Object.values(autoMapeo).includes(h)) autoMapeo[campo] = h;
        });
        setMapeo(autoMapeo);
        setStep(2);
      } catch(err) { console.error("Import error:", err); }
    };
    reader.readAsBinaryString(file);
  };

  // getVal robusto: maneja números, strings y valores falsy como 0
  const getVal = (row, campo) => {
    const col = mapeo[campo];
    if (!col) return "";
    const idx = headers.indexOf(col);
    if (idx < 0) return "";
    const v = row[idx];
    if (v === null || v === undefined || v === "") return "";
    return String(v).trim();
  };

  // Preview con valores ya parseados para que el usuario vea exactamente lo que se va a importar
  const preview = rows.slice(0, 6).map(row => {
    const stockRaw = getVal(row, "stock");
    const precioRaw = getVal(row, "precio");
    return {
      nombre:    getVal(row, "nombre"),
      precio:    precioRaw ? parseNumero(precioRaw) : "",
      costo:     getVal(row, "costo") ? parseNumero(getVal(row, "costo")) : "",
      stock:     stockRaw !== "" ? Math.round(parseNumero(stockRaw)) : "—",
      categoria: getVal(row, "categoria"),
      sku:       getVal(row, "sku"),
    };
  }).filter(p => p.nombre);

  const stockNoMapeado = !mapeo["stock"];
  const todosStockCero = preview.length > 0 && preview.every(p => p.stock === 0 || p.stock === "—");

  const confirmarImport = () => {
    setImporting(true);
    const nuevos = rows
      .map(row => {
        const nombre = getVal(row, "nombre");
        const precio = parseNumero(getVal(row, "precio"));
        const stockRaw = getVal(row, "stock");
        const stock = stockRaw !== "" ? Math.round(parseNumero(stockRaw)) : 0;
        return {
          id: uid(), nombre, precio,
          costo:       parseNumero(getVal(row, "costo")),
          stock,
          stockMinimo: Math.round(parseNumero(getVal(row, "stockMinimo"))) || 3,
          categoria:   getVal(row, "categoria") || cats[0] || "General",
          sku:         getVal(row, "sku"),
          descripcion: getVal(row, "descripcion"),
          marca:       getVal(row, "marca"),
          talles:[], colores:[], stockPorTalle:{}, imagen:""
        };
      })
      .filter(p => p.nombre && p.precio > 0);
    setTimeout(() => { onImport(nuevos); setImporting(false); }, 300);
  };

  const validRows = rows.filter(row => getVal(row, "nombre") && getVal(row, "precio")).length;

  return (
    <Modal title="Importar desde Excel" subtitle="Cargá productos desde cualquier planilla" onClose={onClose} width={680}>

      {/* STEP 1 — Upload */}
      {step === 1 && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border:"2px dashed #d1d5db", borderRadius:12, padding:"48px 24px", textAlign:"center", cursor:"pointer", background:"#fafafa", marginBottom:20 }}
          >
            <div style={{ color:"#111", marginBottom:12 }}><Download size={36}/></div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Hacé clic para subir tu Excel</div>
            <div style={{ fontSize:13, color:"#888" }}>Soporta .xlsx, .xls y .csv — cualquier formato de exportación</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleFile} />
          </div>
          <div style={{ ...G.card({ background:"#f9fafb", padding:"16px 20px" }) }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Compatible con cualquier sistema</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, fontSize:12, color:"#666" }}>
              {["Tiendanube","WooCommerce","Shopify","Odoo","Excel propio","Cualquier otro"].map(s => (
                <div key={s} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>✓ {s}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Mapeo */}
      {step === 2 && (
        <div>
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 16px", marginBottom:20, fontSize:13, color:"#166534" }}>
            <b>{rows.length} filas detectadas</b> · {headers.length} columnas · Revisá que los campos estén bien asignados
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12, marginBottom:16 }}>
            {CAMPOS_IMPORT.map(({ key, label, required }) => (
              <div key={key}>
                <label style={{ ...G.label, fontSize:12 }}>{label}{required && <span style={{ color:"#dc2626" }}> *</span>}</label>
                <select style={{ ...G.inp(), borderColor: key==="stock" && !mapeo[key] ? "#f59e0b" : "#e5e7eb" }} value={mapeo[key] || ""} onChange={e => setMapeo(m => ({ ...m, [key]: e.target.value || undefined }))}>
                  <option value="">— No importar —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {mapeo[key] && rows[0] !== undefined && (
                  <div style={{ fontSize:11, color:"#16a34a", marginTop:3 }}>
                    Ej: <b>{String(rows[0][headers.indexOf(mapeo[key])] ?? "").slice(0,25)}</b>
                  </div>
                )}
                {key === "stock" && !mapeo[key] && (
                  <div style={{ fontSize:11, color:"#d97706", marginTop:3 }}>
                    ⚠ Sin mapear → stock quedará en 0
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setStep(1)}>← Volver</button>
            <button style={{ ...G.btn(mapeo.nombre && mapeo.precio ? "dark" : "light"), flex:2, justifyContent:"center" }}
              onClick={() => { if (mapeo.nombre && mapeo.precio) setStep(3); }}
              disabled={!mapeo.nombre || !mapeo.precio}>
              Ver preview →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Preview */}
      {step === 3 && (
        <div>
          {tiendanubePreview ? (
            <>
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#166534", display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle2 size={16}/>
                <span><b>Formato Tiendanube detectado — {tiendanubePreview.length} productos</b> · Talles y colores importados automáticamente</span>
              </div>
              <div style={{ ...G.card({ padding:0, overflow:"hidden", marginBottom:16 }) }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                      {["Nombre","Precio","Categoría","Talles","Colores","Stock"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:"#888" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiendanubePreview.slice(0,8).map((p, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f5f5f5" }}>
                        <td style={{ padding:"9px 14px", fontWeight:600 }}>{p.nombre}</td>
                        <td style={{ padding:"9px 14px" }}>${p.precio.toLocaleString("es-AR")}</td>
                        <td style={{ padding:"9px 14px", color:"#888" }}>{p.categoria}</td>
                        <td style={{ padding:"9px 14px", color:"#555", fontSize:11 }}>{p.talles.join(", ") || "—"}</td>
                        <td style={{ padding:"9px 14px", color:"#555", fontSize:11 }}>{p.colores.join(", ") || "—"}</td>
                        <td style={{ padding:"9px 14px", fontWeight:600, color: p.stock > 0 ? "#16a34a" : "#aaa" }}>{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tiendanubePreview.length > 8 && <div style={{ fontSize:12, color:"#888", marginBottom:12, textAlign:"center" }}>+ {tiendanubePreview.length - 8} productos más</div>}
              {tiendanubePreview.every(p => p.stock === 0) && (
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"10px 16px", marginBottom:12, fontSize:13, color:"#92400e" }}>
                  ⚠ Todos los productos tienen stock 0 — normal si no gestionás stock en Tiendanube. Podés actualizar el stock desde Inventario después de importar.
                </div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => { setStep(1); setTiendanubePreview(null); }}>← Volver</button>
                <button style={{ ...G.btn("green"), flex:2, justifyContent:"center", padding:"11px" }}
                  onClick={() => { onImport(tiendanubePreview); }} disabled={importing}>
                  {importing ? "Importando..." : `Importar ${tiendanubePreview.length} productos`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 16px", marginBottom:12, fontSize:13, color:"#166534" }}>
                <b>{validRows} productos listos para importar</b> · Los valores que ves abajo son los que se van a guardar
              </div>
              {(stockNoMapeado || todosStockCero) && (
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"10px 16px", marginBottom:12, fontSize:13, color:"#92400e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>⚠ {stockNoMapeado ? "Stock no mapeado — todos quedarán en 0." : "El stock de todos los productos es 0. ¿Es correcto?"}</span>
                  {stockNoMapeado && <button onClick={() => setStep(2)} style={{ background:"none", border:"none", color:"#92400e", fontWeight:700, cursor:"pointer", fontSize:12, textDecoration:"underline" }}>Volver a mapear</button>}
                </div>
              )}
              <div style={{ ...G.card({ padding:0, overflow:"hidden", marginBottom:16 }) }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                      {["Nombre","Precio","Costo","Stock","Categoría","SKU"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:"#888" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f5f5f5" }}>
                        <td style={{ padding:"9px 14px", fontWeight:500 }}>{p.nombre}</td>
                        <td style={{ padding:"9px 14px", color: p.precio ? "#111" : "#dc2626" }}>{p.precio ? `$${p.precio}` : "—"}</td>
                        <td style={{ padding:"9px 14px", color:"#888" }}>{p.costo ? `$${p.costo}` : "—"}</td>
                        <td style={{ padding:"9px 14px", fontWeight:600, color: p.stock === "—" ? "#bbb" : p.stock > 0 ? "#16a34a" : "#dc2626" }}>{p.stock}</td>
                        <td style={{ padding:"9px 14px", color:"#888" }}>{p.categoria || "—"}</td>
                        <td style={{ padding:"9px 14px", color:"#bbb" }}>{p.sku || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 6 && <div style={{ fontSize:12, color:"#888", marginBottom:16, textAlign:"center" }}>+ {validRows - preview.length} productos más</div>}
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setStep(2)}>← Ajustar mapeo</button>
                <button style={{ ...G.btn("green"), flex:2, justifyContent:"center", padding:"11px" }} onClick={confirmarImport} disabled={importing}>
                  {importing ? "Importando..." : `Importar ${validRows} productos`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Export helpers ────────────────────────────────────────
function exportarInventario(products) {
  const rows = products.map(p => ({
    "Nombre":        p.nombre,
    "SKU":           p.sku || "",
    "Categoría":     p.categoria || "",
    "Precio":        p.precio,
    "Costo":         p.costo || 0,
    "Stock total":   p.stock,
    "Stock mínimo":  p.stockMinimo || 3,
    "Talles":        (p.talles||[]).join(", "),
    "Colores":       (p.colores||[]).join(", "),
    ...(p.talles?.length > 0 ? Object.fromEntries((p.talles||[]).map(t => [`Stock ${t}`, (p.stockPorTalle||{})[t]||0])) : {}),
    "Marca":         p.marca || "",
    "Descripción":   p.descripcion || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `inventario_${todayStr()}.xlsx`);
}

function exportarVentas(sales, config) {
  const rows = sales.map(s => ({
    "N° Venta":      s.numero,
    "Fecha":         fmtDate(s.fecha),
    "Cliente":       s.cliente || "—",
    "Método pago":   s.metodoPago,
    "Subtotal":      s.subtotal,
    "Descuento":     s.descuento || 0,
    "Total":         s.total,
    "Estado":        s.anulada ? "Anulada" : "Completada",
    "Factura":       s.factura?.estado === "emitida" ? `Factura ${s.factura.tipo} ${s.factura.numero}` : "Sin factura",
    "Productos":     (s.items||[]).map(i => `${i.nombre} x${i.cantidad}`).join(" | "),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas");
  XLSX.writeFile(wb, `ventas_${config.nombre.replace(/\s+/g,"_")}_${todayStr()}.xlsx`);
}

function InventarioPage({ ctx }) {
  const { config, products, setProducts } = ctx;
  const cats = CATS_POR_RUBRO[config.rubro] || CATS_PROD_FALLBACK;
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [filterStock, setFilterStock] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [ajusteProd, setAjusteProd] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const filtered = products.filter(p => { const ms = p.nombre.toLowerCase().includes(search.toLowerCase())||(p.sku||"").toLowerCase().includes(search.toLowerCase())||(p.codigoBarras||"").includes(search.trim()); const mc = filterCat==="Todas"||p.categoria===filterCat; const mst = filterStock==="Todos"||(filterStock==="En stock"&&p.stock>0&&p.stock>(p.stockMinimo||3))||(filterStock==="Stock bajo"&&p.stock>0&&p.stock<=(p.stockMinimo||3))||(filterStock==="Sin stock"&&p.stock===0); return ms&&mc&&mst; });
  const totalStock = products.reduce((a,p) => a+p.stock, 0), stockBajo = products.filter(p => p.stock>0&&p.stock<=(p.stockMinimo||3)).length, sinStock = products.filter(p => p.stock===0).length;
  const onSaveProd = async (p) => {
    setProducts(prev => editProd ? prev.map(x => x.id===p.id ? p : x) : [...prev, p]);
    await ctx.saveProduct(p);
    setShowModal(false); setEditProd(null);
  };
  const delProd = async (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await ctx.deleteProduct(id);
  };

  const [showImport, setShowImport] = useState(false);

  return (
    <div className="app-page-pad" style={G.page}>
      {(showModal||editProd) && <ProductoModal key={editProd?.id || "new"} prod={editProd} onSave={onSaveProd} onClose={() => { setShowModal(false); setEditProd(null); }} cats={cats} rubro={config.rubro} />}
      {ajusteProd && <AjusteStockModal prod={ajusteProd} rubro={config.rubro} onSave={async upd => { const updated = { ...ajusteProd, ...upd }; setProducts(prev => prev.map(p => p.id===ajusteProd.id ? updated : p)); await ctx.saveProduct(updated); }} onClose={() => setAjusteProd(null)} />}
      {showImport && <ImportarExcelModal cats={cats} onImport={async nuevos => { setProducts(prev => [...prev, ...nuevos]); setShowImport(false); await ctx.saveProducts(nuevos); }} onClose={() => setShowImport(false)} />}
      {confirmClearAll && (
        <Modal title="¿Borrar todos los productos?" onClose={() => setConfirmClearAll(false)} width={400}>
          <p style={{ fontSize:14, color:"#666", margin:"0 0 8px" }}>Se eliminarán <b>{products.length} productos</b> del inventario.</p>
          <p style={{ fontSize:13, color:"#dc2626", margin:"0 0 20px" }}>Esta acción no se puede deshacer.</p>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setConfirmClearAll(false)}>Cancelar</button>
            <button style={{ ...G.btn("red"), flex:2, justifyContent:"center" }} onClick={async () => { const ids = products.map(p => p.id); setProducts([]); setConfirmClearAll(false); await Promise.all(ids.map(id => ctx.deleteProduct(id))); }}>Sí, borrar todo</button>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="¿Eliminar producto?" onClose={() => setConfirmDelete(null)} width={360}>
          <p style={{ fontSize:14, color:"#666", margin:"0 0 20px" }}>Esta acción no se puede deshacer. El producto será eliminado del inventario.</p>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button style={{ ...G.btn("red"), flex:1, justifyContent:"center" }} onClick={() => { delProd(confirmDelete); setConfirmDelete(null); }}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Productos e Inventario</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>{products.length} productos registrados</p></div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={G.btn("outline")} onClick={() => setShowImport(true)}><Download size={14}/> Importar Excel</button>
          {products.length > 0 && <button style={G.btn("outline")} onClick={() => exportarInventario(products)}><Download size={14}/> Exportar Excel</button>}
          <button style={G.btn("dark")} onClick={() => setShowModal(true)}><Plus size={14}/> Nuevo producto</button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:20 }}>
        {[["Total en Stock", totalStock, "#111"], ["Stock Bajo", stockBajo, "#d97706"], ["Sin Stock", sinStock, "#dc2626"]].map(([label,val,color]) => (
          <div key={label} style={G.card()}><div style={{ fontSize:13, color:"#999", marginBottom:4 }}>{label}</div><div style={{ fontSize:24, fontWeight:800, color }}>{val}</div></div>
        ))}
      </div>
      {!config.rubro && (
        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"10px 16px", marginBottom:14, fontSize:13, color:"#92400e", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span><AlertTriangle size={14}/> Sin rubro configurado — las categorías son genéricas.</span>
          <button onClick={() => ctx.setPage("config")} style={{ background:"none", border:"none", color:"#92400e", fontWeight:700, cursor:"pointer", fontSize:13 }}>Configurar rubro →</button>
        </div>
      )}
      <div style={{ display:"flex", gap:12, marginBottom:16 }}>
        <input style={{ ...G.inp(), flex:1 }} placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={G.inp({ width:170 })} value={filterCat} onChange={e => setFilterCat(e.target.value)}><option>Todas</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <select style={G.inp({ width:170 })} value={filterStock} onChange={e => setFilterStock(e.target.value)}>{["Todos","En stock","Stock bajo","Sin stock"].map(o => <option key={o}>{o}</option>)}</select>
      </div>
      <div>
        {filtered.length === 0
          ? <Empty text={products.length===0?"No hay productos aún":"No se encontraron productos"} btnText="Agregar primer producto" onBtn={() => setShowModal(true)} />
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16 }}>
            {filtered.map(p => {
              const esModa = RUBROS_CON_TALLES.includes(config.rubro);
              const totalStock = esModa && p.stockPorTalle
                ? Object.values(p.stockPorTalle).reduce((a,v) => a+(+v||0), 0)
                : p.stock;
              const color1 = p.colores?.[0];
              return (
                <div key={p.id} style={{ background:"#fff", border:"1px solid #ebebeb", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
                  {/* Imagen */}
                  {p.imagen
                    ? <img src={p.imagen} alt={p.nombre} style={{ width:"100%", height:170, objectFit:"cover", display:"block" }} onError={e => e.target.style.display="none"} />
                    : <div style={{ width:"100%", height:150, background:"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", color:"#ddd" }}><Package size={40}/></div>
                  }
                  {/* Info */}
                  <div style={{ padding:"9px 12px 6px" }}>
                    {/* Nombre + SKU en la misma línea */}
                    <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                      <span style={{ fontWeight:800, fontSize:13, color:"#111", lineHeight:1.2 }}>{p.nombre}</span>
                      {p.sku && <span style={{ fontSize:10, color:"#bbb", fontWeight:500, whiteSpace:"nowrap" }}>{p.sku}</span>}
                    </div>

                    {/* Precio + stock badge */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontWeight:800, fontSize:17, color:"#111" }}>{fmtMoney(p.precio, config.moneda)}</span>
                      <span style={{ background: totalStock === 0 ? "#dc2626" : "#16a34a", color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>
                        {totalStock} uds
                      </span>
                    </div>

                    {/* Color + total en misma línea */}
                    {color1 && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", marginBottom:6, fontWeight:500 }}>
                        <span>{color1}</span>
                        <span style={{ color:"#bbb" }}>{totalStock}</span>
                      </div>
                    )}

                    {/* Grilla de talles */}
                    {esModa && (p.talles||[]).length > 0 && (
                      <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min((p.talles||[]).length, 6)}, 1fr)`, gap:3 }}>
                        {(p.talles||[]).map(t => {
                          const cnt = (p.stockPorTalle || {})[t] || 0;
                          return (
                            <div key={t} style={{ background: cnt===0?"#fff0f0":"#fff", border:`1px solid ${cnt===0?"#fca5a5":"#e5e7eb"}`, borderRadius:7, padding:"3px 2px", textAlign:"center" }}>
                              <div style={{ fontSize:8, color:"#999" }}>{t}</div>
                              <div style={{ fontWeight:700, fontSize:12, color: cnt===0?"#dc2626":"#111" }}>{cnt}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ borderTop:"1px solid #f0f0f0", display:"flex", alignItems:"center", padding:"2px 4px" }}>
                    <button onClick={() => setEditProd(p)} style={{ flex:1, padding:"8px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#555", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                      <Pencil size={13}/> Editar
                    </button>
                    <button onClick={() => setAjusteProd(p)} style={{ padding:"8px 10px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#888", borderLeft:"1px solid #f0f0f0" }} title="Ajustar stock"><BarChart2 size={13}/></button>
                    <button onClick={() => setConfirmDelete(p.id)} style={{ padding:"8px 10px", background:"none", border:"none", cursor:"pointer", color:"#dc2626", borderLeft:"1px solid #f0f0f0" }}><Trash2 size={14}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}

function HistorialPage({ ctx }) {
  const { config, sales, setSales } = ctx;
  const [search, setSearch] = useState(""), [filterPago, setFilterPago] = useState("Todos"), [filterPeriod, setFilterPeriod] = useState("Todos"), [detalle, setDetalle] = useState(null), [comprobanteVer, setComprobanteVer] = useState(null);
  const hoy = todayStr();
  const filtered = useMemo(() => sales.filter(s => { const ms = (s.cliente||"").toLowerCase().includes(search.toLowerCase())||String(s.numero).includes(search); const mp = filterPago==="Todos"||s.metodoPago===filterPago; const mf = filterPeriod==="Todos"||(filterPeriod==="Hoy"&&s.fecha===hoy)||(filterPeriod==="Esta semana"&&s.fecha>=subDays(hoy,7))||(filterPeriod==="Este mes"&&s.fecha.startsWith(hoy.slice(0,7))); return ms&&mp&&mf; }).sort((a,b) => b.numero-a.numero), [sales, search, filterPago, filterPeriod, hoy]);
  const totalFilt = filtered.filter(s => !s.anulada).reduce((a,s) => a+s.total, 0);
  const anular = async (id) => {
    const venta = sales.find(s => s.id === id);
    if (!venta) return;
    if (venta.anulada) return; // ya anulada: no devolver stock dos veces
    const updated = { ...venta, anulada: true };
    setSales(prev => prev.map(s => s.id===id ? updated : s));
    setDetalle(null);
    await ctx.saveVenta(updated);
    // Devolver stock al inventario
    const affectedIds = new Set((venta.items||[]).map(i => i.productoId || i.id));
    const updatedProducts = products.map(p => {
      const items = (venta.items||[]).filter(i => (i.productoId||i.id) === p.id);
      if (!items.length) return p;
      let upd = { ...p };
      const conTalle = items.filter(i => i.talle);
      const sinTalle = items.filter(i => !i.talle);
      if (conTalle.length && upd.stockPorTalle) {
        const spt = { ...upd.stockPorTalle };
        conTalle.forEach(it => { spt[it.talle] = (spt[it.talle]||0) + it.cantidad; });
        upd = { ...upd, stockPorTalle: spt, stock: Object.values(spt).reduce((a,v)=>a+(+v||0), 0) };
      }
      if (sinTalle.length) {
        const suma = sinTalle.reduce((a,i) => a + i.cantidad, 0);
        upd = { ...upd, stock: upd.stock + suma };
      }
      return upd;
    });
    setProducts(updatedProducts);
    await ctx.saveProducts(updatedProducts.filter(p => affectedIds.has(p.id)));
  };

  return (
    <div className="app-page-pad" style={G.page}>
      {detalle && <DetalleVentaModal venta={detalle} moneda={config.moneda} config={config} onAnular={() => anular(detalle.id)} onClose={() => setDetalle(null)} onVerComprobante={detalle.factura?.estado==="emitida" ? () => { setComprobanteVer(detalle); setDetalle(null); } : null} />}
      {comprobanteVer && <ComprobanteModal venta={comprobanteVer} config={config} onClose={() => setComprobanteVer(null)} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Historial de Ventas</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>{filtered.length} ventas registradas · Total: {fmtMoney(totalFilt, config.moneda)}</p></div>
        {sales.length > 0 && <button style={G.btn("outline")} onClick={() => exportarVentas(sales, config)}><Download size={14}/> Exportar Excel</button>}
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <input style={{ ...G.inp(), flex:1 }} placeholder="Buscar por cliente o número..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={G.inp({ width:180 })} value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>{["Todos","Hoy","Esta semana","Este mes"].map(o => <option key={o}>{o}</option>)}</select>
        <select style={G.inp({ width:200 })} value={filterPago} onChange={e => setFilterPago(e.target.value)}><option>Todos</option>{PAGOS.map(p => <option key={p}>{p}</option>)}</select>
      </div>
      <div style={{ ...G.card({ padding:0, overflow:"hidden" }) }}>
        {filtered.length === 0 ? <Empty icon={<ShoppingBag size={36}/>} text="No se encontraron ventas" /> :
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ borderBottom:"1px solid #f0f0f0", background:"#fafafa" }}>{["#","Fecha","Cliente","Método","Total","Estado","Factura",""].map(h => <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#999", fontSize:12 }}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(s => (
              <tr key={s.id} style={{ borderBottom:"1px solid #f5f5f5", opacity:s.anulada?0.55:1 }}>
                <td style={{ padding:"12px 16px", color:"#bbb" }}>#{s.numero}</td>
                <td style={{ padding:"12px 16px" }}>{fmtDate(s.fecha)}</td>
                <td style={{ padding:"12px 16px", fontWeight:600 }}>{s.cliente||"—"}</td>
                <td style={{ padding:"12px 16px", color:"#888" }}>{s.metodoPago}</td>
                <td style={{ padding:"12px 16px", fontWeight:700, color:s.anulada?"#dc2626":"#16a34a" }}>{fmtMoney(s.total, config.moneda)}</td>
                <td style={{ padding:"12px 16px" }}><span style={{ background:s.anulada?"#fee2e2":"#dcfce7", color:s.anulada?"#dc2626":"#16a34a", padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600 }}>{s.anulada?"Anulada":"Completada"}</span></td>
                <td style={{ padding:"12px 16px" }}>
                  {s.factura?.estado === "emitida" ? (
                    <button onClick={() => setDetalle(s)} style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600, color:"#16a34a", cursor:"pointer" }}>
                      Fact. {s.factura.tipo} ✓
                    </button>
                  ) : (
                    <span style={{ fontSize:11, color:"#bbb" }}>Sin factura</span>
                  )}
                </td>
                <td style={{ padding:"12px 16px" }}><button onClick={() => setDetalle(s)} style={{ background:"none", border:"none", cursor:"pointer", color:"#666", fontSize:12 }}>Ver <ChevronRight size={12}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        }
      </div>
    </div>
  );
}

function EstadisticasPage({ ctx }) {
  const { config, sales, products } = ctx;
  const hoy = todayStr();
  const [fechaIni, setFechaIni] = useState(subDays(hoy, 30));
  const [fechaFin, setFechaFin] = useState(hoy);
  const [preset, setPreset] = useState("Últimos 30 días");
  const [vista, setVista] = useState("dia");

  const setPresetRange = (p) => { setPreset(p); const n = todayStr(); if(p==="Hoy"){setFechaIni(n);setFechaFin(n);}else if(p==="Últimos 7 días"){setFechaIni(subDays(n,7));setFechaFin(n);}else if(p==="Este mes"){setFechaIni(n.slice(0,7)+"-01");setFechaFin(n);}else if(p==="Últimos 30 días"){setFechaIni(subDays(n,30));setFechaFin(n);}else if(p==="Este año"){setFechaIni(n.slice(0,4)+"-01-01");setFechaFin(n);} };

  const vf = sales.filter(s => !s.anulada && s.fecha >= fechaIni && s.fecha <= fechaFin);
  const ingresos = vf.reduce((a,s) => a+s.total, 0);
  const ticket = vf.length > 0 ? ingresos / vf.length : 0;

  const VISTAS = [{ v:"hora", l:"Ventas por hora" },{ v:"dia", l:"Ventas por día" },{ v:"mes", l:"Ventas por mes" },{ v:"anio", l:"Ventas por año" },{ v:"categoria", l:"Ventas por categoría" },{ v:"talla", l:"Ventas por talla" },{ v:"top", l:"Productos más vendidos" },{ v:"top_menos", l:"Productos menos vendidos" },{ v:"metodo", l:"Métodos de pago" }];

  // Ranking completo de productos: unidades vendidas + plata generada, en el rango de fechas elegido
  const rankingProductos = useMemo(() => {
    const porProducto = {}; // productoId -> { nombre, categoria, unidades, total }
    vf.forEach(s => (s.items||[]).forEach(i => {
      const key = i.productoId || i.nombre;
      if (!porProducto[key]) {
        const p = products.find(x => x.id === i.productoId);
        porProducto[key] = { nombre: i.nombre, categoria: p?.categoria || "—", unidades: 0, total: 0 };
      }
      porProducto[key].unidades += i.cantidad;
      porProducto[key].total += (i.precio||0) * i.cantidad;
    }));
    // Sumamos también los productos que NO tuvieron ninguna venta en el período (0 unidades)
    products.forEach(p => {
      if (!porProducto[p.id]) {
        porProducto[p.id] = { nombre: p.nombre, categoria: p.categoria || "—", unidades: 0, total: 0 };
      }
    });
    return Object.values(porProducto);
  }, [vf, products]);

  const chartData = useMemo(() => {
    if (vista === "dia") { const m={}; vf.forEach(s=>{m[s.fecha]=(m[s.fecha]||0)+s.total;}); return Object.entries(m).sort().map(([f,t])=>({label:f.slice(5),total:Math.round(t)})); }
    if (vista === "mes") { const m={}; vf.forEach(s=>{const k=s.fecha.slice(0,7);m[k]=(m[k]||0)+s.total;}); return Object.entries(m).sort().map(([f,t])=>({label:f,total:Math.round(t)})); }
    if (vista === "anio") { const m={}; vf.forEach(s=>{const k=s.fecha.slice(0,4);m[k]=(m[k]||0)+s.total;}); return Object.entries(m).sort().map(([f,t])=>({label:f,total:Math.round(t)})); }
    if (vista === "hora") { const m={}; for(let h=0;h<24;h++)m[h]=0; vf.forEach(s=>{const d=new Date(s.fecha+"T12:00:00");m[d.getHours()]=(m[d.getHours()]||0)+s.total;}); return Object.entries(m).map(([h,t])=>({label:h+"hs",total:Math.round(t)})); }
    if (vista === "metodo") { const m={}; vf.forEach(s=>{m[s.metodoPago]=(m[s.metodoPago]||0)+s.total;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([l,t])=>({label:l,total:Math.round(t)})); }
    if (vista === "categoria") { const m={}; vf.forEach(s=>(s.items||[]).forEach(i=>{const p=products.find(x=>x.id===i.productoId);const cat=p?.categoria||"Otro";m[cat]=(m[cat]||0)+i.precio*i.cantidad;})); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([l,t])=>({label:l,total:Math.round(t)})); }
    if (vista === "talla") { const m={}; vf.forEach(s=>(s.items||[]).forEach(i=>{const p=products.find(x=>x.id===i.productoId);if(p?.talle){m[p.talle]=(m[p.talle]||0)+i.cantidad;}})); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([l,t])=>({label:l,total:t})); }
    return [];
  }, [vf, vista, products]);

  const esPie = vista === "metodo" || vista === "categoria";
  const labelY = vista === "top" || vista === "top_menos" || vista === "talla" || vista === "hora" ? "unidades" : "ventas";

  return (
    <div className="app-page-pad" style={G.page}>
      <div style={{ marginBottom:24 }}><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Estadísticas de Ventas</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>Analiza el rendimiento de tu negocio</p></div>
      <div style={{ ...G.card({ marginBottom:20 }) }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          {["Hoy","Últimos 7 días","Este mes","Últimos 30 días","Este año"].map(p => (
            <button key={p} onClick={() => setPresetRange(p)} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid #e5e7eb", cursor:"pointer", fontSize:12, background:preset===p?"#111":"#fff", color:preset===p?"#fff":"#374151", fontWeight:preset===p?600:400 }}>{p}</button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16 }}>
          <div><label style={{ fontSize:11, color:"#999", display:"block", marginBottom:4 }}>Fecha inicio</label><input type="date" style={G.inp()} value={fechaIni} onChange={e => { setFechaIni(e.target.value); setPreset(""); }} /></div>
          <div><label style={{ fontSize:11, color:"#999", display:"block", marginBottom:4 }}>Fecha fin</label><input type="date" style={G.inp()} value={fechaFin} onChange={e => { setFechaFin(e.target.value); setPreset(""); }} /></div>
          <div><label style={{ fontSize:11, color:"#999", display:"block", marginBottom:4 }}>Vista</label>
            <select style={G.inp()} value={vista} onChange={e => setVista(e.target.value)}>
              {VISTAS.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard icon={<DollarSign size={19}/>} bg="#dcfce7" label="Ingresos totales" value={fmtMoney(ingresos, config.moneda)} />
        <StatCard icon={<ShoppingBag size={19}/>} bg="#dbeafe" label="Ventas realizadas" value={vf.length} />
        <StatCard icon={<TrendingUp size={19}/>} bg="#ede9fe" label="Ticket promedio" value={fmtMoney(ticket, config.moneda)} />
      </div>
      <div style={G.card()}>
        {(vista === "top" || vista === "top_menos") ? (
          rankingProductos.length === 0 ? (
            <div style={{ textAlign:"center", padding:"52px 0", color:"#bbb" }}><div style={{ marginBottom:10, opacity:0.25, color:"#aaa" }}><TrendingUp size={36}/></div><div>Todavía no cargaste productos</div></div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #e5e7eb" }}>
                    <th style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#888", width:50 }}>#</th>
                    <th style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#888" }}>Producto</th>
                    <th style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#888" }}>Categoría</th>
                    <th style={{ padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#888" }}>Unidades vendidas</th>
                    <th style={{ padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#888" }}>Plata generada</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rankingProductos]
                    .sort((a, b) => vista === "top" ? b.unidades - a.unidades : a.unidades - b.unidades)
                    .map((p, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f5f5f5" }}>
                        <td style={{ padding:"10px 12px", color:"#aaa", fontWeight:600 }}>{i + 1}</td>
                        <td style={{ padding:"10px 12px", fontWeight:600 }}>{p.nombre}</td>
                        <td style={{ padding:"10px 12px", color:"#888" }}>{p.categoria}</td>
                        <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:700, color: p.unidades === 0 ? "#dc2626" : "#111" }}>
                          {p.unidades === 0 ? "Sin ventas" : `${p.unidades} uds`}
                        </td>
                        <td style={{ padding:"10px 12px", textAlign:"right", color:"#888" }}>{fmtMoney(p.total, config.moneda)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
        ) : chartData.length === 0 ? (
          <div style={{ textAlign:"center", padding:"52px 0", color:"#bbb" }}><div style={{ marginBottom:10, opacity:0.25, color:"#aaa" }}><TrendingUp size={36}/></div><div>No hay ventas en el rango seleccionado</div></div>
        ) : esPie ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:20, alignItems:"center" }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={chartData.map((d,i) => ({ ...d, name:d.label }))} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie><Tooltip formatter={v => fmtMoney(v, config.moneda)} /></PieChart>
            </ResponsiveContainer>
            <div>{chartData.map((d, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f5f5f5", fontSize:13 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ width:10, height:10, borderRadius:"50%", background:PIE_COLORS[i%PIE_COLORS.length], display:"inline-block", flexShrink:0 }} /><span style={{ fontWeight:500 }}>{d.label}</span></div>
                <span style={{ fontWeight:700 }}>{fmtMoney(d.total, config.moneda)}</span>
              </div>
            ))}</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top:4, right:8, left:8, bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize:11, fill:"#bbb" }} />
              <YAxis tick={{ fontSize:11, fill:"#bbb" }} tickFormatter={v => labelY==="ventas" ? `${config.moneda}${v>=1000?(v/1000).toFixed(0)+"k":v}` : v} />
              <Tooltip formatter={v => [labelY==="ventas" ? fmtMoney(v, config.moneda) : v+" uds", ""]} labelStyle={{ fontSize:12 }} />
              <Bar dataKey="total" fill="#111" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function FinanzasPage({ ctx }) {
  const { config, sales, gastos, setGastos } = ctx;
  const [mes, setMes] = useState(todayStr().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [tipoInicial, setTipoInicial] = useState("variable");
  const ingresos = sales.filter(s => !s.anulada && s.fecha.startsWith(mes)).reduce((a,s) => a+s.total, 0);
  const gastosFijos = gastos.filter(g => g.tipo === "fijo");
  const gastosVar = gastos.filter(g => g.tipo === "variable" && (g.fecha||"").startsWith(mes));
  const totalFijos = gastosFijos.reduce((a,g) => a+g.monto, 0), totalVar = gastosVar.reduce((a,g) => a+g.monto, 0);
  const ganancia = ingresos - totalFijos - totalVar;
  const delGasto = async (id) => { setGastos(prev => prev.filter(g => g.id !== id)); await ctx.deleteGasto(id); };

  return (
    <div className="app-page-pad" style={G.page}>
      {showModal && <GastoModal tipoInicial={tipoInicial} mes={mes} onSave={async g => { setGastos(prev => [...prev, g]); await ctx.saveGasto(g); }} onClose={() => setShowModal(false)} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Finanzas</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>Controla tus gastos y rentabilidad</p></div>
        <button style={G.btn("dark")} onClick={() => { setTipoInicial("variable"); setShowModal(true); }}><Plus size={14}/> Agregar Gasto</button>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <span style={{ fontSize:14, color:"#888" }}>Ver mes:</span>
        <input type="month" style={G.inp({ width:200 })} value={mes} onChange={e => setMes(e.target.value)} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard icon={<TrendingUp size={19}/>} bg="#dcfce7" label="Ingresos del mes" value={fmtMoney(ingresos, config.moneda)} />
        <StatCard icon={<ClipboardList size={19}/>} bg="#fef3c7" label="Gastos fijos" value={fmtMoney(totalFijos, config.moneda)} />
        <StatCard icon={<Receipt size={19}/>} bg="#dbeafe" label="Gastos variables" value={fmtMoney(totalVar, config.moneda)} />
        <div style={{ ...G.card(), background:ganancia>=0?"#f0fdf4":"#fef2f2" }}>
          <div style={{ marginBottom:10 }}>{ganancia>=0?<TrendingUp size={19} color="#16a34a"/>:<TrendingUp size={19} color="#dc2626" style={{transform:"rotate(180deg)"}}/>}</div>
          <div style={{ fontSize:24, fontWeight:800, color:ganancia>=0?"#16a34a":"#dc2626" }}>{fmtMoney(ganancia, config.moneda)}</div>
          <div style={{ fontSize:13, color:ganancia>=0?"#16a34a":"#dc2626", marginTop:4 }}>{ganancia>=0?"Ganancia neta":"Pérdida neta"}</div>
        </div>
      </div>
      <div style={{ ...G.card({ marginBottom:20 }) }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}><ClipboardList size={15}/> Gastos Fijos Mensuales</h3>
          <button style={G.btn("outline", { padding:"6px 14px", fontSize:12 })} onClick={() => { setTipoInicial("fijo"); setShowModal(true); }}><Plus size={13}/> Agregar</button>
        </div>
        {gastosFijos.length === 0 ? (
          <div style={{ textAlign:"center", padding:"28px 0", color:"#bbb" }}><div style={{ marginBottom:8, opacity:0.25, color:"#aaa" }}><AlertCircle size={32}/></div><div style={{ fontSize:13 }}>No hay gastos fijos registrados</div><div style={{ fontSize:12, marginTop:4, color:"#ccc" }}>Los gastos fijos se cobran todos los meses</div></div>
        ) : gastosFijos.map(g => (
          <div key={g.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f5f5f5" }}>
            <div><div style={{ fontWeight:600, fontSize:13 }}>{g.descripcion}</div><div style={{ fontSize:11, color:"#bbb" }}>{g.categoria}{g.metodoPago ? ` · ${g.metodoPago}` : ""}</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}><span style={{ fontWeight:700, color:"#dc2626", fontSize:14 }}>{fmtMoney(g.monto, config.moneda)}</span><button onClick={() => delGasto(g.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}><Trash2 size={14}/></button></div>
          </div>
        ))}
      </div>
      <div style={G.card()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}> {monthLabel(mes)}</h3>
          <button style={G.btn("outline", { padding:"6px 14px", fontSize:12 })} onClick={() => { setTipoInicial("variable"); setShowModal(true); }}><Plus size={13}/> Agregar</button>
        </div>
        {gastosVar.length === 0 ? <div style={{ textAlign:"center", padding:"28px 0", color:"#bbb", fontSize:13 }}>No hay gastos variables este mes</div> :
          gastosVar.map(g => (
            <div key={g.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f5f5f5" }}>
              <div><div style={{ fontWeight:600, fontSize:13 }}>{g.descripcion}</div><div style={{ fontSize:11, color:"#bbb" }}>{g.categoria} · {fmtDate(g.fecha)}{g.metodoPago ? ` · ${g.metodoPago}` : ""}</div></div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}><span style={{ fontWeight:700, color:"#dc2626", fontSize:14 }}>{fmtMoney(g.monto, config.moneda)}</span><button onClick={() => delGasto(g.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}><Trash2 size={14}/></button></div>
            </div>
          ))}
      </div>
    </div>
  );
}

function RemitosPage({ ctx }) {
  const { config, products, setProducts, remitos, setRemitos, proveedores, setProveedores } = ctx;
  const [tab, setTab] = useState("remitos");
  const [mes, setMes] = useState(todayStr().slice(0, 7));
  const [showRemito, setShowRemito] = useState(false);
  const [showProveedor, setShowProveedor] = useState(false);
  const [editProv, setEditProv] = useState(null);
  const remitosMes = remitos.filter(r => r.fecha.startsWith(mes));
  const totalMes = remitosMes.reduce((a,r) => a+r.total, 0);
  const delRemito = (id) => { setRemitos(prev => prev.filter(r => r.id !== id)); };
  const delProv = async (id) => { setProveedores(prev => prev.filter(p => p.id !== id)); await ctx.deleteProveedor(id); };

  return (
    <div className="app-page-pad" style={G.page}>
      {showRemito && <RemitoModal proveedores={proveedores} products={products} setProducts={setProducts} saveProducts={ctx.saveProducts} rubro={config.rubro} onSave={async r => { const newRemito = { ...r, id:uid(), numero: remitos.reduce((mx, x) => Math.max(mx, +x.numero || 0), 0) + 1 }; setRemitos(prev => [...prev, newRemito]); await ctx.saveRemito(newRemito); }} onClose={() => setShowRemito(false)} />}
      {(showProveedor||editProv) && <ProveedorModal prov={editProv} onSave={async p => { setProveedores(prev => editProv?prev.map(x=>x.id===p.id?p:x):[...prev,p]); setShowProveedor(false); setEditProv(null); await ctx.saveProveedor(p); }} onClose={() => { setShowProveedor(false); setEditProv(null); }} />}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Remitos y Proveedores</h1><p style={{ margin:0, color:"#888", fontSize:14 }}>Gestiona compras y proveedores</p></div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={G.btn("outline")} onClick={() => setShowProveedor(true)}><Truck size={14}/> Nuevo Proveedor</button>
          <button style={G.btn("dark")} onClick={() => setShowRemito(true)}><Plus size={14}/> Nuevo Remito</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:2, background:"#f5f5f5", padding:4, borderRadius:10, width:"fit-content", marginBottom:24 }}>
        {[["remitos","Remitos"],["proveedores","Proveedores"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"8px 24px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:tab===id?700:400, background:tab===id?"#fff":"transparent", color:tab===id?"#111":"#888", boxShadow:tab===id?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>{label}</button>
        ))}
      </div>
      {tab === "remitos" ? (
        <>
          <div style={{ ...G.card({ marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }) }}>
            <div><label style={{ fontSize:13, color:"#888", display:"block", marginBottom:4 }}>Filtrar por mes</label><input type="month" style={G.inp({ width:200 })} value={mes} onChange={e => setMes(e.target.value)} /></div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:12, color:"#aaa" }}>Total compras del mes</div><div style={{ fontSize:22, fontWeight:800 }}>{fmtMoney(totalMes, config.moneda)}</div><div style={{ fontSize:12, color:"#aaa" }}>{remitosMes.length} remitos</div></div>
          </div>
          <div style={{ ...G.card({ padding:0, overflow:"hidden" }) }}>
            {remitosMes.length === 0 ? <Empty icon={<FileText size={36}/>} text="No hay remitos en este mes" btnText="Nuevo Remito" onBtn={() => setShowRemito(true)} /> :
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr style={{ borderBottom:"1px solid #f0f0f0", background:"#fafafa" }}>{["#","Fecha","Proveedor","Productos","Método","Total","Notas",""].map(h => <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#999", fontSize:12 }}>{h}</th>)}</tr></thead>
                <tbody>{remitosMes.map(r => (
                  <tr key={r.id} style={{ borderBottom:"1px solid #f5f5f5" }}>
                    <td style={{ padding:"12px 16px", color:"#bbb" }}>#{r.numero}</td>
                    <td style={{ padding:"12px 16px" }}>{fmtDate(r.fecha)}</td>
                    <td style={{ padding:"12px 16px", fontWeight:600 }}>{r.proveedor||"—"}</td>
                    <td style={{ padding:"12px 16px", color:"#888" }}>{r.items?.length||0} items</td>
                    <td style={{ padding:"12px 16px", color:"#888" }}>{r.metodoPago||"—"}</td>
                    <td style={{ padding:"12px 16px", fontWeight:700 }}>{fmtMoney(r.total, config.moneda)}</td>
                    <td style={{ padding:"12px 16px", color:"#bbb", fontSize:12 }}>{r.notas||"—"}</td>
                    <td style={{ padding:"12px 16px" }}><button onClick={() => delRemito(r.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}><Trash2 size={14}/></button></td>
                  </tr>
                ))}</tbody>
              </table>
            }
          </div>
        </>
      ) : (
        <div style={{ ...G.card({ padding:0, overflow:"hidden" }) }}>
          {proveedores.length === 0 ? <Empty icon={<Truck size={36}/>} text="No hay proveedores registrados" btnText="Nuevo Proveedor" onBtn={() => setShowProveedor(true)} /> :
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ borderBottom:"1px solid #f0f0f0", background:"#fafafa" }}>{["Nombre","Contacto","Teléfono","Email","Dirección",""].map(h => <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#999", fontSize:12 }}>{h}</th>)}</tr></thead>
              <tbody>{proveedores.map(p => (
                <tr key={p.id} style={{ borderBottom:"1px solid #f5f5f5" }}>
                  <td style={{ padding:"12px 16px", fontWeight:600 }}>{p.nombre}</td>
                  <td style={{ padding:"12px 16px", color:"#888" }}>{p.contacto||"—"}</td>
                  <td style={{ padding:"12px 16px", color:"#888" }}>{p.telefono||"—"}</td>
                  <td style={{ padding:"12px 16px", color:"#888" }}>{p.email||"—"}</td>
                  <td style={{ padding:"12px 16px", color:"#888", fontSize:12 }}>{p.direccion||"—"}</td>
                  <td style={{ padding:"12px 16px" }}><div style={{ display:"flex", gap:8 }}><button onClick={() => setEditProv(p)} style={{ background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:14 }}><Pencil size={14}/></button><button onClick={() => delProv(p.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}><Trash2 size={14}/></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          }
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FACTURACIÓN — constantes y helpers
// ─────────────────────────────────────────────────────────────
const CONDICIONES_IVA = ["Responsable Inscripto","Monotributista","Exento","Consumidor Final","No Responsable"];
const TIPOS_DOC = ["DNI","CUIT","CUIL","Pasaporte","Sin identificar"];

function tipoFactura(tipoContrib, condicionReceptor) {
  if (tipoContrib === "responsable_inscripto") {
    if (condicionReceptor === "Responsable Inscripto") return "A";
    return "B";
  }
  return "C"; // Monotributista siempre emite C
}

function nroComprobante(puntoVenta, nro) {
  const pv = String(puntoVenta||"1").padStart(4,"0");
  const n  = String(nro||1).padStart(8,"0");
  return `${pv}-${n}`;
}

function generarCAE() {
  // Simula un CAE de 14 dígitos (en producción viene de AFIP)
  return Array.from({length:14}, () => Math.floor(Math.random()*10)).join("");
}

// ─── Modal de facturación (abre al completar venta) ───────────
function FacturarModal({ venta, config, sales, onFacturar, onSinFactura, onClose }) {
  const [step, setStep] = useState(1); // 1=elegir, 2=datos receptor, 3=procesando, 4=exito
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [nroDoc, setNroDoc] = useState("");
  const [nombreReceptor, setNombreReceptor] = useState("Consumidor Final");
  const [condReceptor, setCondReceptor] = useState("Consumidor Final");
  const [cae, setCae] = useState("");
  const [caeVto, setCaeVto] = useState("");

  const tipo = tipoFactura(config.tipoContrib, condReceptor);
  // Número secuencial: tomar el más alto ya emitido + 1 (AFIP exige correlatividad sin duplicados)
  const nroFacturasEmitidas = sales.reduce((mx, s) => {
    if (s.factura?.estado === "emitida" && s.factura?.numero) {
      const n = parseInt(String(s.factura.numero).split("-").pop(), 10) || 0;
      return Math.max(mx, n);
    }
    return mx;
  }, 0);
  const nroComprobante = nroComprobante_fn(config.puntoVenta, nroFacturasEmitidas + 1);

  function nroComprobante_fn(pv, n) {
    return `${String(pv||"1").padStart(4,"0")}-${String(n).padStart(8,"0")}`;
  }

  const emitir = () => {
    if (step === 3) return; // ya procesando: evita doble emisión
    setStep(3);
    // Simula llamada a AFIP (en producción: llamada real a la API)
    setTimeout(() => {
      const caeNum = generarCAE();
      const vto = addDays(todayStr(), 10);
      setCae(caeNum);
      setCaeVto(vto);
      setStep(4);
      const facturaData = {
        tipo, numero: nroComprobante,
        fecha: todayStr(), cae: caeNum, caeVto: vto,
        estado: "emitida",
        receptor: { nombre: nombreReceptor || "Consumidor Final", tipoDoc, nroDoc, condIVA: condReceptor }
      };
      onFacturar(facturaData);
    }, 2000);
  };

  // ── Step 1: Elegir ────────────────────────────────────────
  if (step === 1) return (
    <Modal title="¿Cómo querés registrar esta venta?" onClose={onClose} width={440}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12, marginBottom:20 }}>
        <button onClick={onSinFactura} style={{ background:"#fff", border:"2px solid #e5e7eb", borderRadius:12, padding:"24px 16px", cursor:"pointer", textAlign:"center", transition:"border-color .15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#111"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
          <div style={{ fontSize:32, marginBottom:10 }}>🧾</div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Sin comprobante</div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.4 }}>Ticket interno. No se envía a AFIP.</div>
        </button>
        <button onClick={() => { if (!config.facturacionActiva || !config.cuit) { setStep(0); } else setStep(2); }}
          style={{ background:config.facturacionActiva?"#fff":"#fafafa", border:`2px solid ${config.facturacionActiva?"#e5e7eb":"#e5e7eb"}`, borderRadius:12, padding:"24px 16px", cursor:"pointer", textAlign:"center", transition:"border-color .15s", position:"relative" }}
          onMouseEnter={e=>{if(config.facturacionActiva)e.currentTarget.style.borderColor="#111"}} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
          {!config.facturacionActiva && <div style={{ position:"absolute", top:10, right:10, background:"#fef3c7", color:"#92400e", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>Config. requerida</div>}
          <div style={{ fontSize:32, marginBottom:10 }}>🏛️</div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Factura Electrónica</div>
          <div style={{ fontSize:12, color:"#888", lineHeight:1.4 }}>Se envía a AFIP. Genera CAE.</div>
        </button>
      </div>
      {!config.facturacionActiva && (
        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"10px 16px", fontSize:13, color:"#92400e" }}>
          <b>Facturación no configurada.</b> Completá los datos fiscales en Configuración → Facturación para habilitarla.
        </div>
      )}
    </Modal>
  );

  // ── Step 0: Config incompleta ─────────────────────────────
  if (step === 0) return (
    <Modal title="Configuración requerida" onClose={onClose} width={400}>
      <p style={{ fontSize:14, color:"#666", margin:"0 0 20px" }}>Para emitir facturas electrónicas necesitás completar los datos fiscales en Configuración.</p>
      <div style={{ display:"flex", gap:10 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onSinFactura}>Continuar sin factura</button>
        <button style={{ ...G.btn("dark"), flex:1, justifyContent:"center" }} onClick={onClose}>Ir a Configuración</button>
      </div>
    </Modal>
  );

  // ── Step 2: Datos del receptor ────────────────────────────
  if (step === 2) return (
    <Modal title={`Emitir Factura ${tipo}`} subtitle={`Comprobante ${nroComprobante} · ${fmtDate(todayStr())}`} onClose={onClose} width={500}>
      {/* Tipo de factura badge */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <div style={{ background:"#111", color:"#fff", borderRadius:10, padding:"8px 20px", fontWeight:900, fontSize:22, letterSpacing:2 }}>
          {tipo}
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>Factura {tipo} Electrónica</div>
          <div style={{ fontSize:12, color:"#888" }}>
            {tipo==="A" ? "Operación entre Responsables Inscriptos" : tipo==="B" ? "Receptor Exento o Consumidor Final (RI)" : "Emisor Monotributista"}
          </div>
        </div>
      </div>

      <div style={{ background:"#f9fafb", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#666" }}>Emisor</span>
          <span style={{ fontWeight:600 }}>{config.razonSocial || config.nombre}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#666" }}>CUIT</span>
          <span style={{ fontWeight:600 }}>{config.cuit}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:"#666" }}>Condición IVA</span>
          <span style={{ fontWeight:600 }}>{config.condicionIVA}</span>
        </div>
      </div>

      <FieldRow label="Condición IVA del receptor">
        <select style={G.inp()} value={condReceptor} onChange={e => {
          setCondReceptor(e.target.value);
          if (e.target.value === "Consumidor Final") { setNombreReceptor("Consumidor Final"); setTipoDoc("DNI"); setNroDoc(""); }
        }}>
          {CONDICIONES_IVA.map(c => <option key={c}>{c}</option>)}
        </select>
      </FieldRow>

      <div style={{ display:"grid", gridTemplateColumns:"140px 1fr", gap:12 }}>
        <FieldRow label="Tipo de documento">
          <select style={G.inp()} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
            {TIPOS_DOC.map(d => <option key={d}>{d}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Número">
          <input style={G.inp()} value={nroDoc} onChange={e => setNroDoc(e.target.value)} placeholder={tipoDoc==="CUIT"?"20-12345678-0":"12345678"} />
        </FieldRow>
      </div>

      <FieldRow label="Nombre / Razón social del receptor">
        <input style={G.inp()} value={nombreReceptor} onChange={e => setNombreReceptor(e.target.value)} placeholder="Consumidor Final" />
      </FieldRow>

      {/* Resumen de la factura */}
      <div style={{ background:"#f9fafb", borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#111" }}>Resumen</div>
        {(venta.items||[]).map((it,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
            <span style={{ color:"#666" }}>{it.nombre} x{it.cantidad}</span>
            <span>{fmtMoney(it.precio*it.cantidad, config.moneda)}</span>
          </div>
        ))}
        {venta.descuento > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#dc2626", marginBottom:4 }}><span>Descuento</span><span>-{fmtMoney(venta.descuento, config.moneda)}</span></div>}
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:16, borderTop:"1px solid #e5e7eb", paddingTop:10, marginTop:6 }}>
          <span>Total</span><span>{fmtMoney(venta.total, config.moneda)}</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={() => setStep(1)}>← Volver</button>
        <button style={{ ...G.btn("dark"), flex:2, justifyContent:"center", padding:"12px" }} onClick={emitir}>
          Emitir Factura {tipo} →
        </button>
      </div>
    </Modal>
  );

  // ── Step 3: Procesando ────────────────────────────────────
  if (step === 3) return (
    <Modal title="" onClose={() => {}} width={380}>
      <div style={{ textAlign:"center", padding:"32px 0" }}>
        <div style={{ fontSize:48, marginBottom:16, animation:"spin 1s linear infinite" }}>⚙️</div>
        <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Enviando a AFIP...</div>
        <div style={{ fontSize:13, color:"#888" }}>Aguardá mientras se procesa la factura electrónica</div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    </Modal>
  );

  // ── Step 4: Éxito ─────────────────────────────────────────
  if (step === 4) return (
    <Modal title="" onClose={onClose} width={460}>
      <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
        <div style={{ color:"#16a34a", marginBottom:12 }}><CheckCircle2 size={56}/></div>
        <h3 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800 }}>¡Factura emitida!</h3>
        <p style={{ margin:"0 0 20px", color:"#888", fontSize:13 }}>CAE generado correctamente</p>
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"16px 20px", marginBottom:20, textAlign:"left" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, color:"#666" }}>Tipo</span>
            <span style={{ fontWeight:700 }}>Factura {tipo} · {nroComprobante}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, color:"#666" }}>CAE N°</span>
            <span style={{ fontWeight:700, fontFamily:"monospace", fontSize:14 }}>{cae}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, color:"#666" }}>Vto. CAE</span>
            <span style={{ fontWeight:600 }}>{fmtDate(caeVto)}</span>
          </div>
        </div>
        <button style={{ ...G.btn("dark"), width:"100%", justifyContent:"center", padding:"12px" }} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );

  return null;
}

// ─── Comprobante visual imprimible ────────────────────────────
function ComprobanteModal({ venta, config, onClose }) {
  const f = venta.factura;
  if (!f) return null;

  const handlePrint = () => {
    const printContent = document.getElementById("comprobante-print");
    if (!printContent) return;
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Factura ${f.tipo} ${f.numero}</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      td, th { padding: 8px; border: 1px solid #ddd; font-size: 13px; }
      th { background: #f5f5f5; font-weight: 700; }
      .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
      .tipo-box { border: 3px solid #000; padding: 10px 20px; font-size: 36px; font-weight: 900; text-align: center; }
      @media print { button { display: none; } }
    </style></head><body>${printContent.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <Modal title="Comprobante Electrónico" onClose={onClose} width={620}>
      <div id="comprobante-print" style={{ border:"2px solid #e5e7eb", borderRadius:10, padding:"24px", marginBottom:20 }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:16, marginBottom:20, alignItems:"center" }}>
          {/* Datos emisor */}
          <div>
            {config.logo && <img src={config.logo} alt="logo" style={{ height:40, marginBottom:8, display:"block" }} onError={e=>e.target.style.display="none"} />}
            <div style={{ fontWeight:800, fontSize:16 }}>{config.razonSocial || config.nombre}</div>
            <div style={{ fontSize:12, color:"#666", marginTop:4 }}>CUIT: {config.cuit}</div>
            <div style={{ fontSize:12, color:"#666" }}>Condición IVA: {config.condicionIVA}</div>
            {config.telefono && <div style={{ fontSize:12, color:"#666" }}>Tel: {config.telefono}</div>}
          </div>
          {/* Tipo de comprobante */}
          <div style={{ textAlign:"center", border:"3px solid #111", padding:"12px 20px", borderRadius:8 }}>
            <div style={{ fontWeight:900, fontSize:40, lineHeight:1 }}>{f.tipo}</div>
            <div style={{ fontSize:10, color:"#666", marginTop:4 }}>FACTURA</div>
            <div style={{ fontSize:10, marginTop:6, fontWeight:600 }}>Nro: {f.numero}</div>
          </div>
          {/* Número y fecha */}
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, color:"#666", marginBottom:4 }}>Punto de venta: {String(config.puntoVenta||"1").padStart(4,"0")}</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:4 }}>Fecha: {fmtDate(f.fecha)}</div>
            <div style={{ fontSize:11, color:"#888" }}>Fecha de vto. pago: {fmtDate(f.fecha)}</div>
          </div>
        </div>

        <div style={{ height:1, background:"#e5e7eb", margin:"0 0 16px" }} />

        {/* Receptor */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>RECEPTOR</div>
            <div style={{ fontWeight:700 }}>{f.receptor?.nombre || "Consumidor Final"}</div>
            <div style={{ fontSize:12, color:"#666" }}>Condición IVA: {f.receptor?.condIVA}</div>
          </div>
          <div>
            {f.receptor?.nroDoc && <div style={{ fontSize:12, color:"#666" }}>{f.receptor?.tipoDoc}: {f.receptor?.nroDoc}</div>}
          </div>
        </div>

        <div style={{ height:1, background:"#e5e7eb", margin:"0 0 16px" }} />

        {/* Items */}
        <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:16, fontSize:13 }}>
          <thead>
            <tr style={{ background:"#f9fafb" }}>
              <th style={{ textAlign:"left", padding:"8px 12px", border:"1px solid #e5e7eb" }}>Descripción</th>
              <th style={{ textAlign:"center", padding:"8px 12px", border:"1px solid #e5e7eb" }}>Cant.</th>
              <th style={{ textAlign:"right", padding:"8px 12px", border:"1px solid #e5e7eb" }}>Precio unit.</th>
              <th style={{ textAlign:"right", padding:"8px 12px", border:"1px solid #e5e7eb" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(venta.items||[]).map((it, i) => (
              <tr key={i}>
                <td style={{ padding:"8px 12px", border:"1px solid #e5e7eb" }}>{it.nombre}</td>
                <td style={{ textAlign:"center", padding:"8px 12px", border:"1px solid #e5e7eb" }}>{it.cantidad}</td>
                <td style={{ textAlign:"right", padding:"8px 12px", border:"1px solid #e5e7eb" }}>{fmtMoney(it.precio, config.moneda)}</td>
                <td style={{ textAlign:"right", padding:"8px 12px", border:"1px solid #e5e7eb", fontWeight:600 }}>{fmtMoney(it.precio*it.cantidad, config.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <div style={{ minWidth:240 }}>
            {venta.descuento > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4, color:"#dc2626" }}>
                <span>Descuento</span><span>-{fmtMoney(venta.descuento, config.moneda)}</span>
              </div>
            )}
            {f.tipo === "A" && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                  <span style={{ color:"#666" }}>Subtotal neto</span>
                  <span>{fmtMoney(venta.total / 1.21, config.moneda)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                  <span style={{ color:"#666" }}>IVA 21%</span>
                  <span>{fmtMoney(venta.total - venta.total/1.21, config.moneda)}</span>
                </div>
              </>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:18, borderTop:"2px solid #111", paddingTop:8, marginTop:4 }}>
              <span>TOTAL</span><span>{fmtMoney(venta.total, config.moneda)}</span>
            </div>
          </div>
        </div>

        <div style={{ height:1, background:"#e5e7eb", margin:"16px 0" }} />

        {/* CAE */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16, fontSize:12 }}>
          <div>
            <span style={{ color:"#666" }}>CAE N°: </span>
            <span style={{ fontWeight:700, fontFamily:"monospace" }}>{f.cae}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ color:"#666" }}>Fecha Vto. CAE: </span>
            <span style={{ fontWeight:600 }}>{fmtDate(f.caeVto)}</span>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <button style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }} onClick={onClose}>Cerrar</button>
        <button style={{ ...G.btn("dark"), flex:1, justifyContent:"center" }} onClick={handlePrint}>
          <Download size={14}/> Imprimir / PDF
        </button>
      </div>
    </Modal>
  );
}

function ConfigPage({ ctx }) {
  const { config, setConfig, setPage, products, deleteProduct } = ctx;
  const [f, setF] = useState({ ...config });
  const [saved, setSaved] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passOk, setPassOk] = useState(false);
  const u = (k, v) => setF(p => ({ ...p, [k]:v }));
  const save = async () => { await ctx.setConfig(f); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // ── Cambiar contraseña ──
  const handleCambiarPassword = async () => {
    setPassError(""); setPassOk(false);
    if (nuevaPass.length < 6) { setPassError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (nuevaPass !== confirmarPass) { setPassError("Las contraseñas no coinciden"); return; }
    setCambiandoPass(true);
    try {
      await sb.updatePassword(nuevaPass);
      setPassOk(true);
      setNuevaPass(""); setConfirmarPass("");
      setTimeout(() => setPassOk(false), 3500);
    } catch (e) {
      setPassError(e?.message || "No pudimos cambiar la contraseña");
    }
    setCambiandoPass(false);
  };

  // ── Borrar todos los productos ──
  const handleResetProducts = async () => {
    if (resetConfirmText !== config.nombre) return;
    setResetting(true);
    try {
      const ids = products.map(p => p.id);
      ctx.setProducts([]);
      await Promise.all(ids.map(id => deleteProduct(id)));
      setShowResetModal(false);
      setResetConfirmText("");
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setResetting(false);
  };

  const catsPreview = CATS_POR_RUBRO[f.rubro] || [];

  return (
    <div style={{ ...G.page, maxWidth:820 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:800 }}>Configuración del Local</h1>
        <p style={{ margin:0, color:"#888", fontSize:14 }}>Personaliza la información de tu negocio</p>
      </div>

      <div style={{ ...G.card({ marginBottom:20 }) }}>
        <h3 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}><Store size={15}/>Información Básica</h3>
        <FieldRow label="Logo del local">
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={G.inp()} placeholder="URL del logo (https://...)" value={f.logo||""} onChange={e => u("logo", e.target.value)} />
            {f.logo && <img src={f.logo} alt="logo" style={{ height:40, borderRadius:8, border:"1px solid #e5e7eb", flexShrink:0 }} onError={e => e.target.style.display="none"} />}
          </div>
        </FieldRow>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:16, marginBottom:4 }}>
          <FieldRow label="Nombre del local *"><input style={G.inp()} value={f.nombre} onChange={e => u("nombre", e.target.value)} /></FieldRow>
          <FieldRow label="Moneda"><input style={G.inp()} value={f.moneda} onChange={e => u("moneda", e.target.value)} maxLength={5} /></FieldRow>
        </div>
        <FieldRow label="Nombre del dueño/a"><input style={G.inp()} value={f.dueno} onChange={e => u("dueno", e.target.value)} placeholder="Tu nombre" /></FieldRow>
      </div>

      {/* Rubro con preview de categorías */}
      <div style={{ ...G.card({ marginBottom:20 }) }}>
        <h3 style={{ margin:"0 0 6px", fontSize:16, fontWeight:700 }}><Tag size={15}/>Tipo de Negocio / Rubro</h3>
        <p style={{ margin:"0 0 16px", fontSize:13, color:"#888" }}>
          Esto define las categorías disponibles al cargar productos. Elegí el rubro que mejor describa tu negocio.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:20 }}>
          {RUBROS.map(r => (
            <button key={r} onClick={() => u("rubro", r)} style={{
              padding:"12px 14px", borderRadius:10,
              border:`2px solid ${f.rubro===r?"#111":"#e5e7eb"}`,
              cursor:"pointer", fontSize:13, textAlign:"left",
              background:f.rubro===r?"#111":"#fff",
              color:f.rubro===r?"#fff":"#333",
              fontWeight:f.rubro===r?700:400,
              transition:"all .15s"
            }}>{r}</button>
          ))}
        </div>

        {/* Preview categorías del rubro seleccionado */}
        {f.rubro && catsPreview.length > 0 && (
          <div style={{ background:"#f9fafb", borderRadius:10, padding:"16px 20px", border:"1px solid #f0f0f0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>Categorías para {f.rubro}</span>
              <span style={{ background:"#e5e7eb", color:"#666", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>{catsPreview.length} categorías</span>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {catsPreview.map(c => (
                <span key={c} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:20, padding:"4px 12px", fontSize:12, color:"#555", fontWeight:500 }}>{c}</span>
              ))}
            </div>
          </div>
        )}
        {!f.rubro && (
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"12px 16px", fontSize:13, color:"#92400e" }}>
            <span style={{display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={14}/>Seleccioná un rubro para ver las categorías que se usarán al crear productos.</span>
          </div>
        )}
      </div>

      {/* Contacto */}
      <div style={{ ...G.card({ marginBottom:24 }) }}>
        <h3 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700 }}><User size={15}/>Contacto</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
          <FieldRow label="Teléfono"><input style={G.inp()} value={f.telefono} onChange={e => u("telefono", e.target.value)} placeholder="+54 9 11 1234-5678" /></FieldRow>
          <FieldRow label="Instagram"><input style={G.inp()} value={f.instagram} onChange={e => u("instagram", e.target.value)} placeholder="@tunegocio" /></FieldRow>
          <FieldRow label="Dirección del local"><input style={G.inp()} value={f.direccion||""} onChange={e => u("direccion", e.target.value)} placeholder="Ej: Av. Rivadavia 1234, CABA" /></FieldRow>
        </div>
      </div>

      {/* Facturación Electrónica — Próximamente */}
      <div style={{ ...G.card({ marginBottom:24 }) }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>🏛️ Facturación Electrónica (AFIP/ARCA)</h3>
          <span style={{ background:"#f4ecff", color:"#7c3aed", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>Próximamente</span>
        </div>
        <p style={{ margin:0, fontSize:13, color:"#888", lineHeight:1.5 }}>
          Estamos preparando la emisión de facturas electrónicas con CAE, integrada a AFIP. Vas a poder activarla directamente desde acá apenas esté disponible.
        </p>
      </div>

      <div style={{ display:"flex", gap:12 }}>
        <button style={{ ...G.btn(saved?"green":"dark"), fontSize:14, padding:"12px 28px" }} onClick={save}>
          {saved?<span style={{display:"flex",alignItems:"center",gap:6}}><CheckCircle2 size={15}/>¡Guardado!</span>:<span style={{display:"flex",alignItems:"center",gap:6}}><Download size={15}/>Guardar cambios</span>}
        </button>
        {saved && !config.rubro && f.rubro && (
          <button style={{ ...G.btn("outline"), fontSize:14, padding:"12px 28px" }} onClick={() => setPage("inventario")}>
            Ir a Productos →
          </button>
        )}
      </div>

      {/* ── Seguridad: cambiar contraseña ── */}
      <div style={{ ...G.card(), marginTop:40 }}>
        <h3 style={{ margin:"0 0 4px", fontSize:16, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}><Lock size={16}/>Seguridad</h3>
        <p style={{ margin:"0 0 20px", fontSize:13, color:"#888" }}>Cambiá la contraseña con la que iniciás sesión en MiLocal.</p>

        {passOk && (
          <div style={{ background:"#dcfce7", border:"1px solid #86efac", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#15803d", display:"flex", alignItems:"center", gap:8 }}>
            <CheckCircle2 size={15}/> Contraseña actualizada correctamente
          </div>
        )}
        {passError && (
          <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", display:"flex", alignItems:"center", gap:8 }}>
            <AlertCircle size={15}/> {passError}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:18 }}>
          <FieldRow label="Nueva contraseña">
            <input
              style={G.inp()}
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={nuevaPass}
              onChange={e => { setNuevaPass(e.target.value); setPassError(""); }}
            />
          </FieldRow>
          <FieldRow label="Confirmar contraseña">
            <input
              style={G.inp()}
              type="password"
              placeholder="Repetí la contraseña"
              value={confirmarPass}
              onChange={e => { setConfirmarPass(e.target.value); setPassError(""); }}
              onKeyDown={e => e.key === "Enter" && handleCambiarPassword()}
            />
          </FieldRow>
        </div>

        <button
          onClick={handleCambiarPassword}
          disabled={cambiandoPass || !nuevaPass || !confirmarPass}
          style={{
            ...G.btn((cambiandoPass || !nuevaPass || !confirmarPass) ? "light" : "dark"),
            fontSize:14, padding:"11px 24px",
          }}
        >
          {cambiandoPass ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </div>

      {/* ── Zona de peligro ── */}
      <div style={{ marginTop:48, marginBottom:24, background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:12, padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
          <AlertTriangle size={17} color="#dc2626"/>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:"#dc2626" }}>Zona de peligro</h3>
        </div>
        <p style={{ margin:"0 0 18px", fontSize:13.5, color:"#7f1d1d", lineHeight:1.5 }}>
          Las acciones de esta sección son <b>irreversibles</b>. Actuá con cuidado.
        </p>

        <div style={{ background:"#fff", border:"1px solid #fecaca", borderRadius:10, padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#111", marginBottom:3 }}>Borrar todos los productos</div>
            <div style={{ fontSize:12.5, color:"#666", lineHeight:1.5 }}>
              Elimina permanentemente los {products.length} producto{products.length!==1?"s":""} del inventario. Las ventas, remitos, gastos y proveedores <b>no se tocan</b>.
            </div>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            disabled={products.length === 0}
            style={{
              background: products.length === 0 ? "#f3f4f6" : "#dc2626",
              color: products.length === 0 ? "#9ca3af" : "#fff",
              border:"none", borderRadius:8, padding:"10px 18px",
              fontSize:13.5, fontWeight:600,
              cursor: products.length === 0 ? "not-allowed" : "pointer",
              flexShrink:0, fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:7,
            }}
          >
            <Trash2 size={14}/> Borrar
          </button>
        </div>
      </div>

      {/* Modal de confirmación */}
      {showResetModal && (
        <Modal title="¿Borrar todos los productos?" subtitle="Esta acción es irreversible" onClose={() => { setShowResetModal(false); setResetConfirmText(""); }} width={440}>
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"12px 14px", marginBottom:18, display:"flex", gap:10, alignItems:"flex-start" }}>
            <AlertTriangle size={16} color="#dc2626" style={{ flexShrink:0, marginTop:2 }}/>
            <div style={{ fontSize:13, color:"#7f1d1d", lineHeight:1.55 }}>
              Vas a eliminar <b>{products.length} producto{products.length!==1?"s":""}</b> permanentemente. No hay forma de recuperarlos.
            </div>
          </div>

          <p style={{ fontSize:14, color:"#333", margin:"0 0 10px" }}>
            Para confirmar, escribí el nombre de tu negocio: <b>{config.nombre}</b>
          </p>
          <input
            style={G.inp()}
            value={resetConfirmText}
            onChange={e => setResetConfirmText(e.target.value)}
            placeholder={config.nombre}
            autoFocus
            disabled={resetting}
          />

          <div style={{ display:"flex", gap:10, marginTop:22 }}>
            <button
              style={{ ...G.btn("outline"), flex:1, justifyContent:"center" }}
              onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}
              disabled={resetting}
            >
              Cancelar
            </button>
            <button
              onClick={handleResetProducts}
              disabled={resetConfirmText !== config.nombre || resetting}
              style={{
                flex:1, justifyContent:"center",
                background: (resetConfirmText === config.nombre && !resetting) ? "#dc2626" : "#f3f4f6",
                color: (resetConfirmText === config.nombre && !resetting) ? "#fff" : "#9ca3af",
                border:"none", borderRadius:8, padding:"10px 18px",
                fontSize:14, fontWeight:600,
                cursor: (resetConfirmText === config.nombre && !resetting) ? "pointer" : "not-allowed",
                display:"flex", alignItems:"center", gap:6,
                fontFamily:"inherit",
              }}
            >
              {resetting ? "Borrando..." : "Sí, borrar todo"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING — primer uso
// ═══════════════════════════════════════════════════════════
function OnboardingScreen({ onDone, initialNombre = "" }) {
  const [step, setStep] = useState(1); // 1: bienvenida, 2: rubro, 3: datos
  const [rubro, setRubro] = useState("");
  const [nombre, setNombre] = useState(initialNombre);
  const [dueno, setDueno] = useState("");
  const [moneda, setMoneda] = useState("$");
  const [whatsapp, setWhatsapp] = useState("");
  const [direccion, setDireccion] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsappError, setWhatsappError] = useState("");

  const catsPreview = CATS_POR_RUBRO[rubro] || [];

  const C = {
    ink: "#0a0a0a", body: "#4b5563", mut: "#9ca3af", line: "#e5e7eb",
    bg: "#ffffff", bgSoft: "#f9fafb",
    purple: "#9238FF", purpleDark: "#7a1de6", purpleSoft: "#f4ecff",
    green: "#16a34a",
  };
  const font = "'DM Sans', system-ui, -apple-system, sans-serif";

  const handleDone = () => {
    if (!nombre.trim() || !rubro) return;
    // Validar WhatsApp: mínimo 8 dígitos (número corto sin código de país o completo con)
    const wpDigits = whatsapp.replace(/\D/g, "");
    if (!wpDigits || wpDigits.length < 8) {
      setWhatsappError("Ingresá un número de WhatsApp válido (ej: 11 3456-7890)");
      return;
    }
    setWhatsappError("");
    onDone({
      nombre: nombre || "Mi Negocio",
      moneda, dueno, rubro,
      telefono: whatsapp,
      direccion,
      instagram,
      logo: ""
    });
  };

  // Estilos comunes
  const inputStyle = {
    width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 6,
    fontSize: 14.5, outline: "none", boxSizing: "border-box", fontFamily: font,
    background: C.bg, transition: "border-color .15s",
  };
  const labelStyle = { fontSize: 13, fontWeight: 500, color: C.ink, display: "block", marginBottom: 8 };
  const primaryBtn = {
    padding: "14px 32px", background: C.purple, color: "#fff", border: "none", borderRadius: 4,
    fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "background .15s",
  };
  const outlineBtn = {
    padding: "13px 24px", background: "transparent", color: C.ink, border: `1.5px solid ${C.line}`, borderRadius: 4,
    fontSize: 14.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
  };
  const disabledBtn = { ...primaryBtn, background: C.line, color: C.mut, cursor: "not-allowed" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .onb-input:focus { border-color: ${C.purple} !important; }
        .onb-btn-primary:hover:not(:disabled) { background: ${C.purpleDark} !important; }
        .onb-rubro:hover { border-color: ${C.purple} !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: C.purple, width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Store size={18}/>
          </div>
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.5px" }}>MiLocal</span>
        </div>
        <div style={{ fontSize: 13, color: C.mut }}>Configuración inicial</div>
      </div>

      {/* Progress bar */}
      {step > 1 && (
        <div style={{ background: C.bgSoft, borderBottom: `1px solid ${C.line}`, padding: "16px 32px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, minWidth: 76 }}>Paso {step - 1} de 2</div>
            <div style={{ flex: 1, height: 4, background: C.line, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${((step - 1) / 2) * 100}%`, background: C.purple, borderRadius: 2, transition: "width .3s ease" }}/>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>

          {/* Step 1 — Bienvenida */}
          {step === 1 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.purpleSoft, color: C.purple, borderRadius: 30, padding: "6px 14px", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple }}/> ¡Cuenta creada!
              </div>
              <h1 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-1.5px", margin: "0 0 18px" }}>
                Bienvenido a MiLocal
              </h1>
              <p style={{ fontSize: 17, color: C.body, margin: "0 0 40px", lineHeight: 1.55, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
                Configuremos tu negocio en 2 pasos rápidos. Después ya podés empezar a vender.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 44, textAlign: "left" }}>
                {[
                  { ic: <Package size={20}/>, t: "Inventario", d: "Cargá productos con categorías de tu rubro" },
                  { ic: <ShoppingCart size={20}/>, t: "Ventas", d: "Cobrás rápido, el stock se descuenta solo" },
                  { ic: <BarChart2 size={20}/>, t: "Estadísticas", d: "Sabés qué se vende y qué te deja plata" },
                ].map((f, i) => (
                  <div key={i} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "22px 20px" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: C.purpleSoft, color: C.purple, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{f.ic}</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, letterSpacing: "-0.2px" }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: C.body, lineHeight: 1.5 }}>{f.d}</div>
                  </div>
                ))}
              </div>
              <button
                className="onb-btn-primary"
                onClick={() => setStep(2)}
                style={{ ...primaryBtn, padding: "15px 40px", fontSize: 16 }}
              >
                Empezar configuración →
              </button>
            </div>
          )}

          {/* Step 2 — Rubro */}
          {step === 2 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h2 style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 500, letterSpacing: "-1px", margin: "0 0 12px" }}>
                  ¿Qué tipo de negocio tenés?
                </h2>
                <p style={{ fontSize: 15.5, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  Elegí tu rubro y MiLocal se configura solo con las categorías y campos que necesitás.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 22 }}>
                {RUBROS.map(r => (
                  <button
                    key={r}
                    className="onb-rubro"
                    onClick={() => setRubro(r)}
                    style={{
                      padding: "14px 14px", borderRadius: 8,
                      border: `2px solid ${rubro === r ? C.purple : C.line}`,
                      cursor: "pointer", fontSize: 14, textAlign: "left",
                      background: rubro === r ? C.purpleSoft : C.bg,
                      color: rubro === r ? C.purple : C.ink,
                      fontWeight: rubro === r ? 600 : 500,
                      transition: "all .15s", lineHeight: 1.4,
                      fontFamily: font,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Preview categorías */}
              {rubro && (
                <div style={{ background: C.bgSoft, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <CheckCircle2 size={16} color={C.green}/>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Categorías para {rubro}</span>
                    <span style={{ background: C.purple, color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{catsPreview.length}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {catsPreview.map(c => (
                      <span key={c} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: C.body }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                <button style={outlineBtn} onClick={() => setStep(1)}>← Atrás</button>
                <button
                  className="onb-btn-primary"
                  onClick={() => { if (rubro) setStep(3); }}
                  disabled={!rubro}
                  style={rubro ? primaryBtn : disabledBtn}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Datos del negocio */}
          {step === 3 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <h2 style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 500, letterSpacing: "-1px", margin: "0 0 12px" }}>
                  Datos de tu negocio
                </h2>
                <p style={{ fontSize: 15.5, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  Solo lo básico para empezar. Después podés ajustar todo desde Configuración.
                </p>
              </div>

              <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "28px 30px", marginBottom: 24 }}>
                {/* Rubro elegido */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.purpleSoft, borderRadius: 8, padding: "12px 16px", marginBottom: 24 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.purple, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CheckCircle2 size={17}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.body, fontWeight: 500 }}>RUBRO SELECCIONADO</div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>{rubro}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Nombre del negocio *</label>
                  <input
                    className="onb-input"
                    style={inputStyle}
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Mi Showroom, La Ferretería del Sur..."
                    autoFocus
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Tu nombre (dueño/a)</label>
                    <input
                      className="onb-input"
                      style={inputStyle}
                      value={dueno}
                      onChange={e => setDueno(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Moneda</label>
                    <select
                      className="onb-input"
                      style={inputStyle}
                      value={moneda}
                      onChange={e => setMoneda(e.target.value)}
                    >
                      {[["$","$ (Pesos ARS)"],["USD","USD (Dólar)"],["€","€ (Euro)"],["R$","R$ (Real BRL)"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Separador visual */}
                <div style={{ borderTop: `1px solid ${C.line}`, margin: "24px 0 22px" }}/>

                <div style={{ fontSize: 13, fontWeight: 600, color: C.body, marginBottom: 14, letterSpacing: "-0.2px" }}>
                  Datos de contacto
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>WhatsApp de contacto *</label>
                  <input
                    className="onb-input"
                    style={{
                      ...inputStyle,
                      borderColor: whatsappError ? "#dc2626" : C.line,
                    }}
                    value={whatsapp}
                    onChange={e => { setWhatsapp(e.target.value); if (whatsappError) setWhatsappError(""); }}
                    placeholder="Ej: 11 3456-7890"
                    type="tel"
                  />
                  {whatsappError && (
                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertCircle size={13}/> {whatsappError}
                    </div>
                  )}
                  {!whatsappError && (
                    <div style={{ fontSize: 12, color: C.mut, marginTop: 6 }}>
                      Va a aparecer en los tickets de venta para que tus clientes te contacten.
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Dirección del local <span style={{ color: C.mut, fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    className="onb-input"
                    style={inputStyle}
                    value={direccion}
                    onChange={e => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Rivadavia 1234, CABA"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Instagram del negocio <span style={{ color: C.mut, fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    className="onb-input"
                    style={inputStyle}
                    value={instagram}
                    onChange={e => setInstagram(e.target.value.replace(/^@/, ""))}
                    placeholder="@tunegocio"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                <button style={outlineBtn} onClick={() => setStep(2)}>← Atrás</button>
                <button
                  className="onb-btn-primary"
                  onClick={handleDone}
                  disabled={!nombre.trim() || !whatsapp.trim()}
                  style={(nombre.trim() && whatsapp.trim()) ? primaryBtn : disabledBtn}
                >
                  ¡Comenzar a usar MiLocal!
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// LANDING PAGE — estilo violeta+blanco (inspirado en Caibe)
// ══════════════════════════════════════════════════════════
const WHATSAPP_NUMERO = "5492954587394"; // ← WhatsApp real de MiLocal
const PRECIO_MENSUAL = "30.000"; // ← precio de la mensualidad en ARS

function LandingPage({ onIngresar }) {
  const [faqOpen, setFaqOpen] = useState(null);

  const C = {
    ink: "#0a0a0a", body: "#4b5563", mut: "#9ca3af", line: "#e5e7eb",
    bg: "#ffffff", bgSoft: "#f9fafb",
    purple: "#9238FF", purpleDark: "#7a1de6", purpleSoft: "#f4ecff",
    green: "#16a34a",
  };
  const font = "'DM Sans', system-ui, -apple-system, sans-serif";
  const wrap = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };

  const rubros = [
    "Indumentaria", "Calzado", "Kioscos", "Almacenes", "Perfumerías",
    "Farmacias", "Librerías", "Jugueterías", "Verdulerías", "Carnicerías",
    "Pañaleras", "Ferreterías", "Electrónica", "Bazar", "Panaderías",
  ];

  const faqs = [
    { q: "¿Necesito instalar algo?", a: "No. MiLocal funciona 100% en la web. Entrás desde cualquier computadora, tablet o celular con internet, sin descargar ni instalar nada." },
    { q: "¿Mis datos están seguros?", a: "Sí. Toda tu información se guarda en la nube con respaldo automático. Cada negocio ve únicamente sus propios datos, protegidos con tu usuario y contraseña." },
    { q: "¿Sirve para mi rubro?", a: "MiLocal es multirrubro. Se adapta a indumentaria, calzado, electrónica, kioscos, farmacias y prácticamente cualquier comercio minorista. Al crear tu cuenta elegís tu rubro y el sistema se configura solo." },
    { q: "¿Puedo emitir facturas?", a: "Sí. El sistema emite comprobantes tipo A, B y C con numeración correlativa, listos para AFIP. También podés dar tickets de venta comunes cuando no hace falta factura." },
    { q: "¿Puedo usar MiLocal desde el celular?", a: "Sí. La app se adapta a cualquier dispositivo. Vendé desde el mostrador con la compu y controlá el negocio desde el celular cuando estás afuera." },
    { q: "¿Qué pasa si tengo un problema?", a: "Nos escribís por WhatsApp y te ayudamos. Estamos para que puedas vender tranquilo." },
  ];

  const funciones = [
    { t: "Control total del stock", d: "Alta y baja de productos, stock por talle y color, y alertas de faltantes automáticas.", ic: <Package size={24}/> },
    { t: "Ventas y ganancias visibles", d: "Cada venta queda registrada con precio, cantidad y margen. Sabés cuánto ganás por día.", ic: <TrendingUp size={24}/> },
    { t: "Escaneo de códigos de barra", d: "Cargá y vendé más rápido escaneando con la cámara o un lector USB.", ic: <ScanLine size={24}/> },
    { t: "Ahorro de tiempo real", d: "Vendé en segundos, sin hacer cuentas mentales. Descontá stock y calculá vuelto solo.", ic: <Timer size={24}/> },
    { t: "Estadísticas que sirven", d: "Qué se vende, qué no, a qué hora y qué día. Decisiones con datos, no a ojo.", ic: <BarChart2 size={24}/> },
    { t: "Todo en la nube", d: "Acceso desde cualquier dispositivo con internet. Sin instalar, sin perder datos, siempre al día.", ic: <RefreshCw size={24}/> },
  ];

  return (
    <div style={{ fontFamily: font, color: C.ink, background: C.bg, minHeight: "100vh" }}>
      {/* Cargar DM Sans + estilos de animaciones */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 40s linear infinite; }
        .btn-primary:hover { background: ${C.purpleDark} !important; }
        .btn-ghost:hover { background: ${C.purpleSoft} !important; }
        .faq-btn:hover { background: ${C.bgSoft}; }
        @media (max-width: 800px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-h1 { font-size: 44px !important; }
          .funciones-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          <img src="/milocal-logo.png" alt="MiLocal" style={{ height: 40, width: "auto" }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onIngresar} className="btn-ghost" style={{ background: "transparent", border: "none", color: C.ink, fontWeight: 500, fontSize: 14.5, cursor: "pointer", padding: "10px 16px", borderRadius: 6, fontFamily: font }}>Iniciar sesión</button>
            <button onClick={onIngresar} className="btn-primary" style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 14.5, cursor: "pointer", padding: "11px 20px", fontFamily: font }}>Empezar gratis</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ ...wrap, padding: "80px 24px 60px" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 60, alignItems: "center" }}>
          <div>
            <h1 className="hero-h1" style={{ fontSize: 68, lineHeight: 1.02, fontWeight: 500, letterSpacing: "-2.5px", margin: "0 0 24px" }}>
              Menos planillas.<br/>Más ventas.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: C.body, margin: "0 0 32px", maxWidth: 520 }}>
              MiLocal reemplaza el cuaderno, la calculadora y las tres planillas de Excel. Cargás productos, cobrás y controlás el stock — todo desde un mismo lugar.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={onIngresar} className="btn-primary" style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 16, cursor: "pointer", padding: "14px 28px", fontFamily: font }}>¡Empezar gratis!</button>
              <a href={`https://wa.me/${WHATSAPP_NUMERO}`} target="_blank" rel="noreferrer" style={{ background: "transparent", color: C.ink, border: `1.5px solid ${C.ink}`, borderRadius: 4, fontWeight: 600, fontSize: 16, cursor: "pointer", padding: "12.5px 24px", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: font }}>Hablar por WhatsApp</a>
            </div>
            <div style={{ display: "flex", gap: 22, marginTop: 34, fontSize: 13.5, color: C.mut, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color={C.green}/> Sin tarjeta de crédito</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color={C.green}/> Sin instalaciones</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} color={C.green}/> Listo en 2 minutos</span>
            </div>
          </div>

          {/* Signature: dashboard mockup */}
          <div style={{ position: "relative" }}>
            <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 22, boxShadow: "0 20px 60px rgba(146, 56, 255, 0.15), 0 8px 24px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }}/>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24" }}/>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }}/>
                <span style={{ fontSize: 12, color: C.mut, marginLeft: 8 }}>milocal.com.ar</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
                <div style={{ background: C.purpleSoft, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: C.purpleDark, fontWeight: 600, marginBottom: 4 }}>VENTAS HOY</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.purple }}>$127.400</div>
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600, marginBottom: 4 }}>GANANCIA</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>$52.100</div>
                </div>
              </div>
              {[
                ["Remera oversize · T.M", "$18.900", "3"],
                ["Jean recto azul · T.42", "$34.500", "2"],
                ["Buzo canguro · T.L", "$29.900", "1"],
              ].map(([n, p, q], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: i < 2 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ fontSize: 13, color: C.body }}>{n}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.mut, background: C.bgSoft, borderRadius: 4, padding: "2px 8px" }}>×{q}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, background: C.ink, color: "#fff", borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>TOTAL</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>$83.300</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUESINA de rubros ── */}
      <div style={{ background: C.ink, color: "#fff", padding: "22px 0", overflow: "hidden", marginBottom: 60 }}>
        <div className="marquee-track" style={{ display: "flex", gap: 48, whiteSpace: "nowrap" }}>
          {[...rubros, ...rubros].map((r, i) => (
            <span key={i} style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.3px", flexShrink: 0 }}>
              {r} <span style={{ color: C.purple, margin: "0 0 0 40px" }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── QUÉ ES / PROPUESTA ── */}
      <section style={{ ...wrap, padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 60px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Por qué MiLocal</div>
          <h2 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-1.5px", margin: "0 0 20px" }}>
            Diseñado para el mostrador.
          </h2>
          <p style={{ fontSize: 17.5, lineHeight: 1.6, color: C.body, margin: 0 }}>
            Nada de menús interminables ni cursos para aprender a usarlo. Cargás un producto y ya podés venderlo. Tu vendedor se pone al día en 5 minutos. Y si el cliente devuelve algo, el stock se ajusta solo.
          </p>
        </div>

        <div className="funciones-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {funciones.map((f, i) => (
            <div key={i} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "28px 26px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: C.purpleSoft, color: C.purple, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>{f.ic}</div>
              <h3 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-0.3px" }}>{f.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.body, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section style={{ background: C.bgSoft, padding: "90px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...wrap }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Cómo se usa</div>
            <h2 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-1.5px", margin: 0 }}>
              Andando en 5 minutos.
            </h2>
          </div>
          <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30 }}>
            {[
              { n: "1", t: "Registrate gratis", d: "Creá tu cuenta rápido, gratis y sin tarjeta. Podés hacerlo desde tu celular o computadora.", nota: "✅ No necesitás descargar nada ni instalar programas. Funciona 100% online." },
              { n: "2", t: "Cargá tus productos", d: "Elegí tu rubro y cargá tus productos manualmente o importalos desde un Excel/CSV.", nota: "✅ El sistema se adapta a tu rubro con talles, colores, categorías y todo lo que necesites." },
              { n: "3", t: "Empezá a vender", d: "Buscá productos por nombre, cobrá con cualquier método y emití factura AFIP si hace falta. Cada venta descuenta stock automáticamente.", nota: "✅ Cada venta genera datos útiles: qué se vendió más, alertas de stock bajo y reportes." },
            ].map((s, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "32px 28px", position: "relative" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.purple, color: "#fff", fontWeight: 700, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{s.n}</div>
                <h3 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px", letterSpacing: "-0.4px" }}>{s.t}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: C.body, margin: "0 0 14px" }}>{s.d}</p>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: C.body, margin: 0, background: C.bgSoft, padding: "10px 12px", borderRadius: 6 }}>{s.nota}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIO ── */}
      <section style={{ ...wrap, padding: "90px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Precio</div>
          <h2 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-1.5px", margin: "0 0 14px" }}>Un precio. Todo el sistema.</h2>
          <p style={{ fontSize: 17, color: C.body, margin: 0 }}>Sin planes básicos que después te cobran los "extra". Con MiLocal accedés a todo desde el día uno.</p>
        </div>
        <div style={{ maxWidth: 440, margin: "0 auto", background: C.bg, border: `2px solid ${C.purple}`, borderRadius: 14, padding: "40px 36px", position: "relative", boxShadow: "0 20px 60px rgba(146,56,255,0.15)" }}>
          <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: C.purple, color: "#fff", fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, letterSpacing: "0.5px" }}>PLAN ÚNICO</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.mut, marginBottom: 8, marginTop: 6 }}>MiLocal</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 600, color: C.ink }}>$</span>
            <span style={{ fontSize: 60, fontWeight: 700, letterSpacing: "-2.5px" }}>{PRECIO_MENSUAL}</span>
            <span style={{ fontSize: 17, color: C.mut, fontWeight: 500 }}>/mes</span>
          </div>
          <p style={{ fontSize: 14, color: C.mut, margin: "0 0 18px" }}>Sin contratos. Cancelás cuando quieras.</p>
          <div style={{ background: C.green + "15", border: `1.5px solid ${C.green}`, borderRadius: 10, padding: "12px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.green, display: "flex", flexShrink: 0 }}><CheckCircle2 size={20}/></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, letterSpacing: "-0.2px" }}>7 días de prueba gratis</div>
              <div style={{ fontSize: 12, color: C.body }}>Sin tarjeta. Sin compromisos.</div>
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            {["Ventas y tickets ilimitados", "Productos ilimitados", "Control de stock por talle y color", "Escáner de códigos de barra", "Estadísticas y reportes", "Remitos, proveedores y caja", "Acceso desde cualquier dispositivo", "Respaldo automático en la nube", "Soporte por WhatsApp"].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, fontSize: 15, color: C.ink }}>
                <span style={{ color: C.green, display: "flex", flexShrink: 0 }}><CheckCircle2 size={17}/></span> {f}
              </div>
            ))}
          </div>
          <button onClick={onIngresar} className="btn-primary" style={{ width: "100%", background: C.purple, color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 16, cursor: "pointer", padding: "15px", fontFamily: font }}>¡Empezar ahora!</button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: C.bgSoft, padding: "90px 0", borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 14 }}>Preguntas frecuentes</div>
            <h2 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-1.5px", margin: 0 }}>Lo que más nos preguntan</h2>
          </div>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <button className="faq-btn" onClick={() => setFaqOpen(faqOpen === i ? null : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "20px 26px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 17, fontWeight: 500, color: C.ink, fontFamily: font }}>
                {f.q}
                <span style={{ flexShrink: 0, transition: "transform .25s", transform: faqOpen === i ? "rotate(45deg)" : "none", color: C.purple, fontSize: 26, lineHeight: 1, fontWeight: 300 }}>+</span>
              </button>
              {faqOpen === i && <div style={{ padding: "0 26px 22px", fontSize: 15.5, lineHeight: 1.65, color: C.body }}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ background: C.ink, color: "#fff", padding: "90px 0" }}>
        <div style={{ ...wrap, textAlign: "center" }}>
          <h2 style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-2px", margin: "0 0 20px" }}>
            Dejá de perder plata en detalles.
          </h2>
          <p style={{ fontSize: 18, color: "#c9c9c9", maxWidth: 560, margin: "0 auto 40px" }}>
            Cada venta mal cargada, cada producto que se te pasa. Empezá hoy y no vuelvas a preguntarte "¿cuánto vendí ayer?".
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onIngresar} className="btn-primary" style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 17, cursor: "pointer", padding: "16px 34px", fontFamily: font }}>¡Empezar gratis!</button>
            <a href={`https://wa.me/${WHATSAPP_NUMERO}`} target="_blank" rel="noreferrer" style={{ background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 4, fontWeight: 600, fontSize: 17, cursor: "pointer", padding: "14.5px 30px", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: font }}>WhatsApp</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#000", color: C.mut, padding: "40px 0", textAlign: "center" }}>
        <div style={{ ...wrap }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <img src="/milocal-logo.png" alt="MiLocal" style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }}/>
          </div>
          <p style={{ fontSize: 13, margin: 0 }}>Sistema de gestión para comercios · Argentina · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// LOGIN / REGISTER SCREEN
// ══════════════════════════════════════════════════════════
function LoginScreen({ onLogin, onVolver }) {
  const [modo, setModo] = useState("login"); // login | register | confirmar | recuperar | recuperar_enviado
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const C = {
    ink: "#0a0a0a", body: "#4b5563", mut: "#9ca3af", line: "#e5e7eb",
    bg: "#ffffff", bgSoft: "#f9fafb",
    purple: "#9238FF", purpleDark: "#7a1de6", purpleSoft: "#f4ecff",
    green: "#16a34a",
  };
  const font = "'DM Sans', system-ui, -apple-system, sans-serif";

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (modo === "register") {
        if (!nombreNegocio.trim()) { setError("Ingresá el nombre de tu negocio"); setLoading(false); return; }
        const data = await sb.signUp(email, password, nombreNegocio);
        if (data.session?.access_token) {
          onLogin(data.session.access_token, data.user?.id);
        } else {
          setModo("confirmar");
        }
      } else {
        const data = await sb.signIn(email, password);
        onLogin(data.session.access_token, data.user?.id);
      }
    } catch (e) {
      setError(e?.message || "Error de conexión");
    }
    setLoading(false);
  };

  const enviarRecuperacion = async () => {
    if (!email.trim()) { setError("Ingresá tu email primero"); return; }
    setError(""); setLoading(true);
    try {
      await sb.resetPasswordForEmail(email.trim());
      setModo("recuperar_enviado");
    } catch (e) {
      setError(e?.message || "No pudimos enviar el email. Intentá de nuevo.");
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 6,
    fontSize: 14.5, outline: "none", boxSizing: "border-box", fontFamily: font,
    background: C.bg, transition: "border-color .15s",
  };
  const inputWithIconStyle = { ...inputStyle, paddingLeft: 42 };
  const labelStyle = { fontSize: 13, fontWeight: 500, color: C.ink, display: "block", marginBottom: 8 };

  const submitDisabled = loading || !email || !password;

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: font, background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .login-input:focus { border-color: ${C.purple} !important; }
        .login-btn:hover:not(:disabled) { background: ${C.purpleDark} !important; }
        @media (max-width: 900px) {
          .login-left { display: none !important; }
          .login-right { flex: 1 !important; }
        }
      `}</style>

      {/* ═══ PANEL IZQUIERDO — Branding ═══ */}
      <div className="login-left" style={{
        flex: "0 0 46%",
        background: `linear-gradient(155deg, ${C.ink} 0%, #1a1a2e 100%)`,
        color: "#fff",
        padding: "48px 56px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Orbe violeta decorativo */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: `radial-gradient(circle, ${C.purple}44 0%, transparent 70%)`, pointerEvents: "none" }}/>
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, background: `radial-gradient(circle, ${C.purple}22 0%, transparent 70%)`, pointerEvents: "none" }}/>

        {/* Logo con back */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <button onClick={onVolver} style={{
            display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none",
            color: "#fff", cursor: "pointer", padding: 0, fontFamily: font,
          }}>
            <img src="/milocal-icon.png" alt="MiLocal" style={{ width: 40, height: 40, borderRadius: 8 }}/>
            <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.7px" }}>MiLocal</span>
          </button>
        </div>

        {/* Mensaje central */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.purple, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 16 }}>
            {modo === "register" ? "Bienvenido" : "Hola de nuevo"}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-1.5px", margin: "0 0 20px" }}>
            {modo === "register" ? "Un negocio ordenado empieza acá." : "Volvamos a lo tuyo."}
          </h1>
          <p style={{ fontSize: 16, color: "#c9c9c9", lineHeight: 1.55, margin: 0, maxWidth: 400 }}>
            {modo === "register"
              ? "Creá tu cuenta en menos de un minuto y empezá a controlar stock, ventas y facturación desde un solo lugar."
              : "Ingresá para ver cómo anduvo el día, cargar ventas y controlar tu stock."}
          </p>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "Ventas y stock en tiempo real",
              "Escáner de códigos de barra",
              "Acceso desde cualquier dispositivo",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14.5, color: "#e5e7eb" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckCircle2 size={13} color="#fff"/>
                </div>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Footer izquierdo */}
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "#8a97a8" }}>
          © {new Date().getFullYear()} MiLocal · Sistema de gestión para comercios
        </div>
      </div>

      {/* ═══ PANEL DERECHO — Formulario ═══ */}
      <div className="login-right" style={{
        flex: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        background: C.bg,
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Título */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-1px", margin: "0 0 8px", color: C.ink }}>
              {modo === "confirmar" ? "Revisá tu email" :
               modo === "register" ? "Crear cuenta" :
               modo === "recuperar" ? "Recuperar contraseña" :
               modo === "recuperar_enviado" ? "Revisá tu email" :
               "Iniciar sesión"}
            </h2>
            <p style={{ fontSize: 15, color: C.body, margin: 0 }}>
              {modo === "confirmar"
                ? `Te enviamos un link a ${email}`
                : modo === "register"
                  ? "Registrate gratis y arrancá hoy"
                  : modo === "recuperar"
                    ? "Ingresá tu email y te mandamos un link para elegir una nueva contraseña"
                    : modo === "recuperar_enviado"
                      ? `Te enviamos un link a ${email} para que elijas una nueva contraseña`
                      : "Ingresá con tus datos para acceder"}
            </p>
          </div>

          {modo === "recuperar_enviado" ? (
            <>
              <div style={{ background: C.purpleSoft, borderRadius: 10, padding: "24px 20px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ color: C.purple, marginBottom: 12, display: "flex", justifyContent: "center" }}>
                  <Mail size={40}/>
                </div>
                <p style={{ fontSize: 14, color: C.ink, margin: "0 0 6px", fontWeight: 600 }}>Revisá tu bandeja de entrada</p>
                <p style={{ fontSize: 13, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  Hacé clic en el link del email para elegir una nueva contraseña. Si no lo ves, revisá spam.
                </p>
              </div>
              <button
                onClick={() => setModo("login")}
                style={{
                  width: "100%", padding: "14px", background: C.purple, color: "#fff",
                  border: "none", borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: "pointer",
                  fontFamily: font,
                }}
                className="login-btn"
              >
                Volver al login
              </button>
            </>
          ) : modo === "recuperar" ? (
            <>
              {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "11px 14px", marginBottom: 18, fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={15}/> {error}
                </div>
              )}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email</label>
                <div style={{ position: "relative" }}>
                  <Mail size={17} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.mut }}/>
                  <input
                    className="login-input"
                    style={inputWithIconStyle}
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && enviarRecuperacion()}
                    autoFocus
                  />
                </div>
              </div>
              <button
                onClick={enviarRecuperacion}
                disabled={loading || !email}
                className="login-btn"
                style={{
                  width: "100%", padding: "14px", background: (loading || !email) ? C.line : C.purple,
                  color: (loading || !email) ? C.mut : "#fff", border: "none", borderRadius: 4,
                  fontSize: 15, fontWeight: 600, cursor: (loading || !email) ? "not-allowed" : "pointer",
                  transition: "background .15s", fontFamily: font,
                }}
              >
                {loading ? "Enviando..." : "Enviar link de recuperación"}
              </button>
              <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: C.body }}>
                <button onClick={() => { setModo("login"); setError(""); }} style={{ background: "none", border: "none", color: C.purple, fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: font, padding: 0 }}>← Volver al login</button>
              </div>
            </>
          ) : modo === "confirmar" ? (
            <>
              <div style={{ background: C.purpleSoft, borderRadius: 10, padding: "24px 20px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ color: C.purple, marginBottom: 12, display: "flex", justifyContent: "center" }}>
                  <Mail size={40}/>
                </div>
                <p style={{ fontSize: 14, color: C.ink, margin: "0 0 6px", fontWeight: 600 }}>Un paso más</p>
                <p style={{ fontSize: 13, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  Hacé clic en el link que te enviamos por email y volvé acá para iniciar sesión.
                </p>
              </div>
              <button
                onClick={() => setModo("login")}
                style={{
                  width: "100%", padding: "14px", background: C.purple, color: "#fff",
                  border: "none", borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: "pointer",
                  fontFamily: font,
                }}
                className="login-btn"
              >
                Ir al login
              </button>
            </>
          ) : (<>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "11px 14px", marginBottom: 18, fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={15}/> {error}
              </div>
            )}

            {modo === "register" && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nombre del negocio</label>
                <input
                  className="login-input"
                  style={inputStyle}
                  placeholder="Ej: Bahamas Store"
                  value={nombreNegocio}
                  onChange={e => setNombreNegocio(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <div style={{ position: "relative" }}>
                <Mail size={17} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.mut }}/>
                <input
                  className="login-input"
                  style={inputWithIconStyle}
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position: "relative" }}>
                <Lock size={17} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.mut }}/>
                <input
                  className="login-input"
                  style={{ ...inputWithIconStyle, paddingRight: 44 }}
                  type={showPass ? "text" : "password"}
                  placeholder={modo === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.mut, display: "flex", padding: 4 }}
                  type="button"
                >
                  {showPass ? <EyeOff size={17}/> : <Eye size={17}/>}
                </button>
              </div>
              {modo === "login" && (
                <div style={{ textAlign: "right", marginTop: 8 }}>
                  <button
                    onClick={() => { setModo("recuperar"); setError(""); }}
                    type="button"
                    style={{ background: "none", border: "none", color: C.mut, cursor: "pointer", fontSize: 13, fontFamily: font, padding: 0 }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={submit}
              disabled={submitDisabled}
              className="login-btn"
              style={{
                width: "100%", padding: "14px", background: submitDisabled ? C.line : C.purple,
                color: submitDisabled ? C.mut : "#fff", border: "none", borderRadius: 4,
                fontSize: 15, fontWeight: 600, cursor: submitDisabled ? "not-allowed" : "pointer",
                transition: "background .15s", fontFamily: font,
              }}
            >
              {loading ? "Un momento..." : modo === "login" ? "Iniciar sesión" : "Crear mi cuenta"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: C.body }}>
              {modo === "login" ? (
                <>¿Todavía no tenés cuenta? <button onClick={() => { setModo("register"); setError(""); }} style={{ background: "none", border: "none", color: C.purple, fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: font, padding: 0 }}>Crear cuenta gratis</button></>
              ) : (
                <>¿Ya tenés cuenta? <button onClick={() => { setModo("login"); setError(""); }} style={{ background: "none", border: "none", color: C.purple, fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: font, padding: 0 }}>Iniciar sesión</button></>
              )}
            </div>

            {/* Volver a la landing (solo móvil visible como texto) */}
            <div style={{ textAlign: "center", marginTop: 32, fontSize: 13, color: C.mut }}>
              <button onClick={onVolver} style={{ background: "none", border: "none", color: C.mut, cursor: "pointer", fontSize: 13, fontFamily: font, textDecoration: "underline", padding: 0 }}>
                ← Volver al inicio
              </button>
            </div>

          </>)}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// NUEVA CONTRASEÑA — pantalla que se muestra al volver del link
// de "recuperar contraseña" que llega por email
// ══════════════════════════════════════════════════════════
function NuevaPasswordScreen({ onDone, onCancelar }) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const C = {
    ink: "#0a0a0a", body: "#4b5563", mut: "#9ca3af", line: "#e5e7eb",
    bg: "#ffffff", bgSoft: "#f9fafb",
    purple: "#9238FF", purpleDark: "#7a1de6", purpleSoft: "#f4ecff",
    green: "#16a34a",
  };
  const font = "'DM Sans', system-ui, -apple-system, sans-serif";

  const inputStyle = {
    width: "100%", padding: "13px 16px", border: `1.5px solid ${C.line}`, borderRadius: 6,
    fontSize: 14.5, outline: "none", boxSizing: "border-box", fontFamily: font,
    background: C.bg,
  };
  const labelStyle = { fontSize: 13, fontWeight: 500, color: C.ink, display: "block", marginBottom: 8 };

  const submit = async () => {
    setError("");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirmar) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      await sb.updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e?.message || "No pudimos actualizar la contraseña. Probá de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, background: C.bg, padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 32 }}>
          <img src="/milocal-icon.png" alt="MiLocal" style={{ width: 36, height: 36, borderRadius: 8 }}/>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px", color: C.ink }}>MiLocal</span>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: C.purpleSoft, borderRadius: 10, padding: "24px 20px", marginBottom: 20 }}>
              <div style={{ color: C.green, marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <CheckCircle2 size={40}/>
              </div>
              <p style={{ fontSize: 15, color: C.ink, margin: 0, fontWeight: 600 }}>¡Contraseña actualizada!</p>
            </div>
            <button
              onClick={onDone}
              style={{ width: "100%", padding: "14px", background: C.purple, color: "#fff", border: "none", borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: font }}
            >
              Ir a MiLocal
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.7px", margin: "0 0 8px", color: C.ink, textAlign: "center" }}>
              Elegí una nueva contraseña
            </h2>
            <p style={{ fontSize: 14.5, color: C.body, margin: "0 0 28px", textAlign: "center" }}>
              Tiene que tener al menos 6 caracteres
            </p>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "11px 14px", marginBottom: 18, fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={15}/> {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nueva contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPass ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  type="button"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.mut, display: "flex", padding: 4 }}
                >
                  {showPass ? <EyeOff size={17}/> : <Eye size={17}/>}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input
                style={inputStyle}
                type={showPass ? "text" : "password"}
                placeholder="Repetí la contraseña"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
              />
            </div>

            <button
              onClick={submit}
              disabled={loading || !password || !confirmar}
              style={{
                width: "100%", padding: "14px",
                background: (loading || !password || !confirmar) ? C.line : C.purple,
                color: (loading || !password || !confirmar) ? C.mut : "#fff",
                border: "none", borderRadius: 4, fontSize: 15, fontWeight: 600,
                cursor: (loading || !password || !confirmar) ? "not-allowed" : "pointer",
                fontFamily: font,
              }}
            >
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={onCancelar} style={{ background: "none", border: "none", color: C.mut, cursor: "pointer", fontSize: 13, fontFamily: font, textDecoration: "underline", padding: 0 }}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ADMIN PANEL — solo el dueño de MiLocal puede ver esto
// ══════════════════════════════════════════════════════════
function AdminPage({ onVolver }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroRubro, setFiltroRubro] = useState("Todos");
  const [procesando, setProcesando] = useState(null); // id del negocio con acción en curso
  const [confirmCancelar, setConfirmCancelar] = useState(null); // negocio a confirmar cancelación

  const cargar = async () => {
    try {
      const session = await sb.getSession();
      if (!session) { setError("Sesión no válida"); setLoading(false); return; }
      const resp = await fetch(`${SUPABASE_FUNC_URL}/admin-dashboard`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || "No autorizado"); setLoading(false); return; }
      setResumen(data.resumen);
      setNegocios(data.negocios || []);
    } catch (e) {
      setError(e.message || "Error de conexión");
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const ejecutarAccion = async (negocioId, action) => {
    setProcesando(negocioId + action);
    try {
      const session = await sb.getSession();
      const resp = await fetch(`${SUPABASE_FUNC_URL}/admin-actions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ negocio_id: negocioId, action }),
      });
      const data = await resp.json();
      if (!resp.ok) { alert("Error: " + (data.error || "algo salió mal")); setProcesando(null); return; }
      await cargar(); // refrescar la tabla con el estado actualizado
    } catch (e) {
      alert("Error de conexión: " + e.message);
    }
    setProcesando(null);
    setConfirmCancelar(null);
  };

  const ESTADOS = {
    trial: { label: "Prueba", bg: "#fef3c7", color: "#92400e" },
    active: { label: "Activo", bg: "#dcfce7", color: "#15803d" },
    past_due: { label: "Atrasado", bg: "#fee2e2", color: "#dc2626" },
    cancelled: { label: "Cancelado", bg: "#f3f4f6", color: "#6b7280" },
  };

  const rubrosDisponibles = [...new Set(negocios.map(n => n.rubro).filter(Boolean))].sort();

  const negociosFiltrados = negocios.filter(n => {
    const matchBusqueda = !busqueda ||
      (n.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.email || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.telefono || "").includes(busqueda);
    const matchEstado = filtroEstado === "Todos" || n.subscription_status === filtroEstado;
    const matchRubro = filtroRubro === "Todos" || n.rubro === filtroRubro;
    return matchBusqueda && matchEstado && matchRubro;
  });

  const fmtFecha = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const diasDesde = (iso) => {
    if (!iso) return "";
    const dias = Math.floor((new Date() - new Date(iso)) / (1000 * 60 * 60 * 24));
    if (dias === 0) return "hoy";
    if (dias === 1) return "ayer";
    return `hace ${dias} días`;
  };

  const linkWhatsApp = (telefono) => {
    if (!telefono) return null;
    let digits = telefono.replace(/\D/g, "");
    if (!digits.startsWith("54")) digits = "549" + digits;
    return `https://wa.me/${digits}`;
  };

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Sans',sans-serif", color:"#888" }}>
        Cargando panel...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Sans',sans-serif", flexDirection:"column", gap:16 }}>
        <div style={{ color:"#dc2626", fontSize:15, fontWeight:600 }}>{error === "No autorizado" ? "No tenés acceso a esta sección" : error}</div>
        <button onClick={onVolver} style={{ background:"#111", color:"#fff", border:"none", borderRadius:6, padding:"10px 20px", cursor:"pointer", fontFamily:"inherit" }}>Volver a MiLocal</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'DM Sans',system-ui,sans-serif", padding:"28px 32px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ margin:"0 0 4px", fontSize:26, fontWeight:800, letterSpacing:"-0.5px" }}>Panel de administración</h1>
          <p style={{ margin:0, color:"#888", fontSize:14 }}>Todos los negocios registrados en MiLocal</p>
        </div>
        <button onClick={onVolver} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 18px", cursor:"pointer", fontSize:14, fontFamily:"inherit", fontWeight:500 }}>← Volver a MiLocal</button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
        {[
          { label: "Total negocios", value: resumen.total, bg: "#ede9fe", color: "#7c3aed" },
          { label: "En prueba", value: resumen.trial, bg: "#fef3c7", color: "#92400e" },
          { label: "Activos", value: resumen.active, bg: "#dcfce7", color: "#15803d" },
          { label: "Atrasados", value: resumen.past_due, bg: "#fee2e2", color: "#dc2626" },
          { label: "Cancelados", value: resumen.cancelled, bg: "#f3f4f6", color: "#6b7280" },
          { label: "MRR", value: fmtMoney(resumen.mrr, "$"), bg: "#dbeafe", color: "#1e40af" },
        ].map((k, i) => (
          <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"18px 20px" }}>
            <div style={{ display:"inline-block", background:k.bg, color:k.color, fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, marginBottom:10 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:800, letterSpacing:"-1px" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input
          placeholder="Buscar por nombre, email o WhatsApp..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex:1, minWidth:220, padding:"10px 14px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:14, fontFamily:"inherit" }}
        />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ padding:"10px 14px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:14, fontFamily:"inherit" }}>
          <option value="Todos">Todos los estados</option>
          <option value="trial">En prueba</option>
          <option value="active">Activos</option>
          <option value="past_due">Atrasados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <select value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)} style={{ padding:"10px 14px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:14, fontFamily:"inherit" }}>
          <option value="Todos">Todos los rubros</option>
          {rubrosDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #e5e7eb" }}>
                {["Negocio","Dueño/a","Email","WhatsApp","Rubro","Instagram","Registrado","Estado","Vence / Próx. cobro","Acciones"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#666", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {negociosFiltrados.map(n => {
                const est = ESTADOS[n.subscription_status] || ESTADOS.trial;
                const fechaRelevante = n.subscription_status === "active" ? n.next_billing_date : n.trial_ends_at;
                const wa = linkWhatsApp(n.telefono);
                const tieneCortesia = n.acceso_manual_hasta && new Date(n.acceso_manual_hasta) > new Date();
                const puedeAccionar = n.subscription_status !== "cancelled";
                return (
                  <tr key={n.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"12px 16px", fontWeight:600 }}>{n.nombre}</td>
                    <td style={{ padding:"12px 16px", color:"#666" }}>{n.dueno || "—"}</td>
                    <td style={{ padding:"12px 16px", color:"#666" }}>{n.email || "—"}</td>
                    <td style={{ padding:"12px 16px" }}>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color:"#16a34a", fontWeight:600, textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>
                          {n.telefono}
                        </a>
                      ) : "—"}
                    </td>
                    <td style={{ padding:"12px 16px", color:"#666" }}>{n.rubro || "—"}</td>
                    <td style={{ padding:"12px 16px", color:"#666" }}>{n.instagram ? `@${n.instagram.replace(/^@/,"")}` : "—"}</td>
                    <td style={{ padding:"12px 16px", color:"#666", whiteSpace:"nowrap" }}>
                      <div>{fmtFecha(n.created_at)}</div>
                      <div style={{ fontSize:11, color:"#aaa" }}>{diasDesde(n.created_at)}</div>
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <span style={{ background:est.bg, color:est.color, fontSize:11.5, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{est.label}</span>
                      {tieneCortesia && (
                        <div style={{ marginTop:5, fontSize:10.5, color:"#7c3aed", fontWeight:600 }}>🎁 cortesía hasta {fmtFecha(n.acceso_manual_hasta)}</div>
                      )}
                    </td>
                    <td style={{ padding:"12px 16px", color:"#666", whiteSpace:"nowrap" }}>{fmtFecha(fechaRelevante)}</td>
                    <td style={{ padding:"12px 16px", whiteSpace:"nowrap" }}>
                      {puedeAccionar && (
                        <div style={{ display:"flex", gap:6 }}>
                          <button
                            onClick={() => ejecutarAccion(n.id, "regalar_mes")}
                            disabled={procesando === n.id + "regalar_mes"}
                            title="Regalar 30 días de acceso sin cobrar"
                            style={{ background:"#f4ecff", color:"#7c3aed", border:"none", borderRadius:6, padding:"6px 10px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
                          >
                            {procesando === n.id + "regalar_mes" ? "..." : "🎁 Regalar mes"}
                          </button>
                          {tieneCortesia && (
                            <button
                              onClick={() => setConfirmCancelar(n)}
                              disabled={procesando === n.id + "cancelar_regalo"}
                              title="Deshacer el mes regalado"
                              style={{ background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:6, padding:"6px 10px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
                            >
                              {procesando === n.id + "cancelar_regalo" ? "..." : "Quitar regalo"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {negociosFiltrados.length === 0 && (
                <tr><td colSpan={10} style={{ padding:"32px 16px", textAlign:"center", color:"#aaa" }}>No hay negocios que coincidan con el filtro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación para quitar el mes regalado */}
      {confirmCancelar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={() => setConfirmCancelar(null)}>
          <div style={{ background:"#fff", borderRadius:12, padding:"24px 26px", width:"90%", maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:"0 0 10px", fontSize:17, fontWeight:700 }}>¿Quitar el mes regalado a {confirmCancelar.nombre}?</h3>
            <p style={{ margin:"0 0 20px", fontSize:14, color:"#666", lineHeight:1.5 }}>
              Esto deshace la cortesía que le diste. No afecta ni cancela nada en Mercado Pago — si el negocio tiene una suscripción real pagando, sigue intacta.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmCancelar(null)} style={{ flex:1, background:"#f3f4f6", border:"none", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"inherit", fontWeight:500 }}>Volver</button>
              <button onClick={() => ejecutarAccion(confirmCancelar.id, "cancelar_regalo")} style={{ flex:1, background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Sí, quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const WHATSAPP_SOPORTE = "5492954587394"; // ← número de MiLocal para cancelar/soporte
const PRECIO_SUSCRIPCION = 30000;
const SUPABASE_FUNC_URL = "https://sdizrjbeasubjkpixmro.supabase.co/functions/v1";

// Devuelve el estado computado de la suscripción
function getSubscriptionState(config) {
  const status = config?.subscriptionStatus || 'trial';
  const trialEnd = config?.trialEndsAt ? new Date(config.trialEndsAt) : null;
  const now = new Date();

  // ── Acceso regalado por el administrador ──
  // Si tiene una fecha futura, nunca bloqueamos, sin importar el estado real de MP
  if (config?.accesoManualHasta) {
    const cortesiaHasta = new Date(config.accesoManualHasta);
    if (cortesiaHasta > now) {
      const daysLeft = Math.max(1, Math.ceil((cortesiaHasta - now) / (1000 * 60 * 60 * 24)));
      return { status: 'cortesia', isActive: true, isTrial: false, isBlocked: false, daysLeft };
    }
  }

  // Los negocios activos "permanentes" (los pre-existentes) no tienen trialEndsAt
  if (status === 'active' && !trialEnd) {
    return { status: 'active', isActive: true, isTrial: false, isBlocked: false, daysLeft: Infinity };
  }

  if (status === 'active') {
    return { status: 'active', isActive: true, isTrial: false, isBlocked: false, daysLeft: Infinity };
  }

  if (status === 'trial') {
    // Si trialEnd no está seteado aún (cuenta recién creada, config todavía cargando),
    // asumimos que es válido y NO bloqueamos - la DB tiene el default de 7 días
    if (!trialEnd) {
      return { status: 'trial', isActive: true, isTrial: true, isBlocked: false, daysLeft: 7 };
    }
    const msLeft = trialEnd - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    if (daysLeft === 0) {
      return { status: 'trial_expired', isActive: false, isTrial: true, isBlocked: true, daysLeft: 0 };
    }
    return { status: 'trial', isActive: true, isTrial: true, isBlocked: false, daysLeft };
  }

  if (status === 'past_due') {
    // 3 días de gracia desde payment_failed_at
    const failedAt = config?.paymentFailedAt ? new Date(config.paymentFailedAt) : now;
    const graceEnd = new Date(failedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const isBlocked = now >= graceEnd;
    const daysLeft = Math.max(0, Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24)));
    return { status: 'past_due', isActive: !isBlocked, isTrial: false, isBlocked, daysLeft };
  }

  if (status === 'cancelled') {
    return { status: 'cancelled', isActive: false, isTrial: false, isBlocked: true, daysLeft: 0 };
  }

  return { status, isActive: false, isTrial: false, isBlocked: true, daysLeft: 0 };
}

// Llamar a la Edge Function para crear suscripción y redirigir a MP
async function iniciarSuscripcion() {
  const session = await sb.getSession();
  if (!session?.access_token) throw new Error("Sesión inválida");
  const resp = await fetch(SUPABASE_FUNC_URL + "/subscription-create", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || "Error creando suscripción");
  // Redirigir al usuario a MP para cargar la tarjeta
  window.location.href = data.init_point;
}

// Abrir WhatsApp con mensaje pre-armado para cancelar
function abrirCancelacionWhatsApp(nombreNegocio) {
  const msg = encodeURIComponent(
    `Hola, soy ${nombreNegocio} y quiero cancelar mi suscripción de MiLocal.`
  );
  window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${msg}`, "_blank");
}

// ─── Banner de trial (arriba de todas las páginas) ─────────
function TrialBanner({ daysLeft, onSuscribir }) {
  const isCritical = daysLeft <= 1;
  return (
    <div style={{
      background: isCritical ? "#fef3c7" : "#fef9c3",
      border: `1px solid ${isCritical ? "#fbbf24" : "#facc15"}`,
      padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, fontSize: 13.5
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#92400e", flex: 1 }}>
        <Clock size={16}/>
        <span>
          <b>Tu prueba gratis termina en {daysLeft} {daysLeft === 1 ? "día" : "días"}.</b>
          {" "}Suscribite para no perder acceso a tus datos.
        </span>
      </div>
      <button onClick={onSuscribir} style={{
        background: "#111", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px",
        cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap"
      }}>
        Suscribirme por $30.000
      </button>
    </div>
  );
}

// ─── Banner de past_due (pago falló) ────────────────────────
function PastDueBanner({ daysLeft, onSuscribir }) {
  return (
    <div style={{
      background: "#fee2e2", border: "1px solid #fca5a5",
      padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, fontSize: 13.5
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#991b1b", flex: 1 }}>
        <AlertCircle size={16}/>
        <span>
          <b>El último cobro falló.</b>
          {" "}Actualizá tu método de pago en los próximos {daysLeft} {daysLeft === 1 ? "día" : "días"} o se cortará el acceso.
        </span>
      </div>
      <button onClick={onSuscribir} style={{
        background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px",
        cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap"
      }}>
        Actualizar tarjeta
      </button>
    </div>
  );
}

// ─── Pantalla de bloqueo cuando trial/pago venció ──────────
function AccesoBloqueadoScreen({ config, onSuscribir, onLogout }) {
  const state = getSubscriptionState(config);
  const isTrial = state.status === 'trial_expired';
  const isCancelled = state.status === 'cancelled';

  const [loading, setLoading] = useState(false);
  const handleSuscribir = async () => {
    setLoading(true);
    try { await onSuscribir(); }
    catch (e) { alert("Error: " + e.message); setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f9fafb", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 44px", maxWidth: 480, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)", textAlign: "center"
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, background: "#fef3c7", color: "#d97706",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
        }}>
          <Lock size={32}/>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 12px", color: "#111", letterSpacing: "-0.5px" }}>
          {isTrial ? "Tu prueba gratis terminó" :
           isCancelled ? "Tu suscripción está cancelada" :
           "Servicio suspendido por falta de pago"}
        </h1>
        <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.6, margin: "0 0 28px" }}>
          {isTrial ? "Suscribite ahora para seguir usando MiLocal. Tus datos y productos están intactos, los recuperás al reactivar." :
           isCancelled ? "Reactivá tu suscripción cuando quieras y volvés a tener acceso a todos tus datos." :
           "No pudimos procesar tu último cobro y ya pasó el período de gracia de 3 días. Actualizá tu método de pago para reactivar tu cuenta."}
        </p>

        <div style={{
          background: "#f9fafb", borderRadius: 10, padding: "18px 20px", marginBottom: 24, textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Plan</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>MiLocal — Completo</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Precio</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>$30.000<span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}>/mes</span></span>
          </div>
        </div>

        <button onClick={handleSuscribir} disabled={loading} style={{
          width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 10,
          padding: "14px", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
          marginBottom: 12
        }}>
          {loading ? "Un momento..." : "Suscribirme por $30.000/mes"}
        </button>
        <button onClick={onLogout} style={{
          width: "100%", background: "transparent", color: "#6b7280", border: "none",
          padding: "10px", fontSize: 13, cursor: "pointer"
        }}>
          Cerrar sesión
        </button>

        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 20, lineHeight: 1.5 }}>
          Con tu suscripción tenés acceso completo al sistema. Podés cancelar cuando quieras.
        </p>
      </div>
    </div>
  );
}

// ─── Página de gestión de suscripción ───────────────────────
function SuscripcionPage({ config, onSuscribir, onCancelar }) {
  const state = getSubscriptionState(config);
  const [loading, setLoading] = useState(false);

  const statusLabel = {
    trial: "Prueba gratis",
    trial_expired: "Prueba expirada",
    active: "Activa",
    past_due: "Con pago pendiente",
    cancelled: "Cancelada",
  }[state.status] || state.status;

  const statusColor = {
    trial: { bg: "#fef9c3", color: "#a16207", border: "#facc15" },
    trial_expired: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
    active: { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
    past_due: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
    cancelled: { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
  }[state.status] || { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" };

  const handleSuscribir = async () => {
    setLoading(true);
    try { await onSuscribir(); }
    catch (e) { alert("Error: " + e.message); setLoading(false); }
  };

  return (
    <div className="app-page-pad" style={G.page}>
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800 }}>Suscripción</h1>
          <p style={{ margin: 0, color: "#888", fontSize: 14 }}>Gestioná tu plan y tu método de pago</p>
        </div>

        {/* Card principal — estado de suscripción */}
        <div style={{ ...G.card(), marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Plan actual</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>MiLocal — Completo</div>
            </div>
            <span style={{
              background: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}`,
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700
            }}>
              {statusLabel}
            </span>
          </div>

          {state.status === 'trial' && (
            <div style={{ background: "#fef9c3", border: "1px solid #facc15", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              <b>Tenés {state.daysLeft} {state.daysLeft === 1 ? "día" : "días"}</b> de prueba gratis.
              {" "}Suscribite para no perder acceso cuando termine.
            </div>
          )}

          {state.status === 'active' && config.nextBillingDate && (
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#4b5563" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Próximo cobro</span>
                <span style={{ fontWeight: 600, color: "#111" }}>{fmtDate(config.nextBillingDate.split("T")[0])}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Monto</span>
                <span style={{ fontWeight: 600, color: "#111" }}>{fmtMoney(PRECIO_SUSCRIPCION, "$")}</span>
              </div>
            </div>
          )}

          {state.status === 'past_due' && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
              <b>El último cobro falló.</b>
              {" "}Tenés {state.daysLeft} {state.daysLeft === 1 ? "día" : "días"} para actualizar tu tarjeta antes de que se corte el acceso.
            </div>
          )}

          {(state.status === 'trial' || state.status === 'trial_expired' || state.status === 'past_due' || state.status === 'cancelled') && (
            <button onClick={handleSuscribir} disabled={loading} style={{
              width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer"
            }}>
              {loading ? "Un momento..." :
               state.status === 'past_due' ? "Actualizar método de pago" : "Suscribirme por $30.000/mes"}
            </button>
          )}

          {state.status === 'active' && (
            <button onClick={onCancelar} style={{
              width: "100%", background: "transparent", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8,
              padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer"
            }}>
              Cancelar suscripción
            </button>
          )}
        </div>

        {/* Card informativa — qué incluye */}
        <div style={{ ...G.card() }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Qué incluye tu plan</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Ventas y tickets ilimitados",
              "Productos ilimitados",
              "Control de stock por talle y color",
              "Estadísticas y reportes",
              "Escáner de códigos de barra",
              "Remitos, proveedores y caja",
              "Acceso desde cualquier dispositivo",
              "Respaldo automático en la nube",
              "Soporte por WhatsApp",
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#374151" }}>
                <CheckCircle2 size={16} color="#16a34a"/>
                {f}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
            Los pagos se procesan de forma segura por Mercado Pago. Podés cancelar cuando quieras y seguirás teniendo acceso hasta el final del período pagado.
          </p>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  // Ruteo por URL: /home (landing), /login (auth), /app (dashboard), /admin (panel dueño)
  const [route, setRoute] = useState(() => {
    if (typeof window === "undefined") return "home";
    const p = window.location.pathname;
    if (p === "/login") return "login";
    if (p === "/admin") return "admin";
    if (p === "/app" || p.startsWith("/app/")) return "app";
    return "home";
  });

  // Escuchar cambios de URL (botón back/forward del navegador)
  useEffect(() => {
    // Normalizar "/" a "/home" al arrancar
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      window.history.replaceState({}, "", "/home");
    }
    const onPop = () => {
      const p = window.location.pathname;
      if (p === "/login") setRoute("login");
      else if (p === "/admin") setRoute("admin");
      else if (p === "/app" || p.startsWith("/app/")) setRoute("app");
      else setRoute("home");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Helper para navegar y actualizar la URL sin recargar
  const navegar = (dest) => {
    const url = dest === "home" ? "/home" : dest === "login" ? "/login" : dest === "admin" ? "/admin" : "/app";
    if (window.location.pathname !== url) {
      window.history.pushState({}, "", url);
    }
    setRoute(dest);
  };

  const [config, setConfig] = useState({ nombre:"Mi Showroom", moneda:"$", dueno:"", rubro:"", telefono:"", instagram:"", logo:"", cuit:"", razonSocial:"", tipoContrib:"monotributista", puntoVenta:"0001", condicionIVA:"Monotributista", facturacionActiva:false });
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [caja, setCaja] = useState({ abierta:false, monto:0, fecha:null });
  const [gastos, setGastos] = useState([]);
  const [remitos, setRemitos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer del sidebar en mobile

  // ── Detectar retorno desde Mercado Pago (?subscription=success) ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      setShowSubscriptionSuccess(true);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      setTimeout(() => setShowSubscriptionSuccess(false), 8000);
    }
  }, []);

  // ── Auth: restaurar sesión guardada ────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const session = await sb.getSession();
        if (session?.user) {
          setToken({ access_token: session.access_token, userId: session.user.id });
          return;
        }
      } catch {}
      setAuthReady(true);
    };
    init();

    // Auto-refresh y logout listener
    const { data: { subscription } } = _sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setToken(null); setLoaded(false); setAuthReady(true); }
      if (event === 'PASSWORD_RECOVERY') {
        // El usuario vino desde el link de "recuperar contraseña" del email
        setPasswordRecoveryMode(true);
        setAuthReady(true);
        if (session?.access_token) {
          setToken({ access_token: session.access_token, userId: session.user.id });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Cargar datos cuando hay token ────────────────────────
  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        const userId = token.userId;
        let negocio = await sb.getNegocio(userId);
        // Si no hay negocio, crear uno automáticamente
        if (!negocio) {
          const { data: neg } = await _sb.from("negocios").insert({ user_id: userId, nombre: "Mi Negocio" }).select().single();
          negocio = neg;
          if (neg) await _sb.from("caja").insert({ negocio_id: neg.id, abierta: false, monto: 0 });
        }
        if (!negocio) { setAuthReady(true); setLoaded(true); return; }
        sb._negocioId = negocio.id;

        const [prods, ventasData, cajaData, gastosData, remitosData, provData] = await Promise.all([
          sb.get("productos", "nombre"),
          sb.get("ventas", "created_at"),
          sb.getOne("caja"),
          sb.get("gastos"),
          sb.get("remitos"),
          sb.get("proveedores", "nombre"),
        ]);

        setConfig(dbToConfig(negocio));
        setProducts((prods || []).map(dbToProduct));
        setSales((ventasData || []).map(dbToVenta));
        // Cierre automático: si la caja quedó abierta de un día anterior, se cierra sola
        if (cajaData?.abierta && cajaData?.fecha && cajaData.fecha !== todayStr()) {
          const cerrada = { abierta: false, monto: 0, fecha: null };
          setCaja(cerrada);
          _sb.from("caja").update(cerrada).eq("negocio_id", negocio.id).then(({ error }) => {
            if (error) console.error("Auto-cierre caja:", error);
            else console.log("Caja auto-cerrada: quedó abierta desde " + cajaData.fecha);
          });
        } else {
          setCaja(cajaData ? { abierta: cajaData.abierta, monto: parseFloat(cajaData.monto)||0, fecha: cajaData.fecha } : { abierta:false, monto:0, fecha:null });
        }
        setGastos((gastosData || []).map(g => ({ id:g.id, tipo:g.tipo, descripcion:g.descripcion, monto:parseFloat(g.monto)||0, categoria:g.categoria, fecha:g.fecha, mes:g.mes })));
        setRemitos((remitosData || []).map(r => ({ id:r.id, numero:r.numero, fecha:r.fecha, proveedor:r.proveedor, items:r.items||[], total:parseFloat(r.total)||0, metodoPago:r.metodo_pago, notas:r.notas })));
        setProveedores((provData || []).map(p => ({ id:p.id, nombre:p.nombre, contacto:p.contacto, telefono:p.telefono, email:p.email, direccion:p.direccion, notas:p.notas })));
      } catch (e) { console.error("Error cargando datos:", e); }
      setAuthReady(true); setLoaded(true);
    };
    loadData();
  }, [token]);

  // ── Revisión periódica del estado de suscripción ──────────
  // Sin esto, si el usuario deja la pestaña abierta durante días, no se entera
  // de un cobro fallido o vencimiento del trial hasta que cierra sesión y vuelve a entrar.
  // Revisamos cada 60s directo contra la base (no depende de caché ni del render).
  useEffect(() => {
    if (!token || !sb._negocioId) return;
    const checkSubscription = async () => {
      try {
        const { data, error } = await _sb
          .from("negocios")
          .select("subscription_status, trial_ends_at, next_billing_date, mp_preapproval_id, payment_failed_at, subscription_started_at")
          .eq("id", sb._negocioId)
          .maybeSingle();
        if (error || !data) return;
        setConfig(prev => ({
          ...prev,
          subscriptionStatus: data.subscription_status || 'trial',
          trialEndsAt: data.trial_ends_at || null,
          nextBillingDate: data.next_billing_date || null,
          mpPreapprovalId: data.mp_preapproval_id || null,
          paymentFailedAt: data.payment_failed_at || null,
          subscriptionStartedAt: data.subscription_started_at || null,
        }));
      } catch (e) { console.error("Error revisando suscripción:", e); }
    };
    const interval = setInterval(checkSubscription, 60000); // cada 60s
    return () => clearInterval(interval);
  }, [token, loaded]);

  const handleLogin = (access_token, userId) => { setToken({ access_token, userId }); setAuthReady(false); };
  const handleLogout = async () => { await sb.signOut(); setToken(null); setLoaded(false); setAuthReady(true); setProducts([]); setSales([]); setGastos([]); setRemitos([]); setProveedores([]); navegar("login"); };

  // ── Guardar config en Supabase ───────────────────────────
  const saveConfig = async (newConfig) => {
    setConfig(newConfig);
    if (sb._negocioId) await sb.updateNegocio(configToDb(newConfig));
  };

  // ── Guardar producto(s) en Supabase ──────────────────────
  const saveProduct = async (p) => {
    if (!sb._negocioId) return;
    await sb.upsert("productos", productToDb(p, sb._negocioId));
  };
  const saveProducts = async (arr) => {
    if (!sb._negocioId || !arr.length) return;
    const { error } = await _sb.from("productos").upsert(arr.map(p => productToDb(p, sb._negocioId)));
    if (error) console.error("saveProducts:", error, arr);
  };
  const deleteProduct = async (id) => {
    if (sb._negocioId) await sb.del("productos", id);
  };

  // ── Guardar venta en Supabase ────────────────────────────
  const saveVenta = async (v) => {
    if (!sb._negocioId) return;
    await sb.upsert("ventas", ventaToDb(v, sb._negocioId));
  };

  // ── Guardar caja en Supabase ─────────────────────────────
  // La fila siempre existe (se crea al registrarse el negocio),
  // así que solo actualizamos por negocio_id
  const saveCaja = async (c) => {
    if (!sb._negocioId) return;
    const { error } = await _sb.from("caja").update({
      abierta: c.abierta,
      monto: c.monto || 0,
      fecha: c.fecha || null,
    }).eq("negocio_id", sb._negocioId);
    if (error) console.error("saveCaja:", error);
  };

  // ── Guardar gasto en Supabase ────────────────────────────
  const saveGasto = async (g) => {
    if (!sb._negocioId) return;
    const row = await sb.insert("gastos", { id:g.id, negocio_id:sb._negocioId, tipo:g.tipo, descripcion:g.descripcion, monto:g.monto||0, categoria:g.categoria||'Otro', fecha:g.fecha||'', mes:g.mes||'' });
    return row;
  };
  const deleteGasto = async (id) => { if (sb._negocioId) await sb.del("gastos", id); };

  // ── Guardar proveedor en Supabase ────────────────────────
  const saveProveedor = async (p) => {
    if (!sb._negocioId) return;
    const row = await sb.upsert("proveedores", { id:p.id, negocio_id:sb._negocioId, nombre:p.nombre, contacto:p.contacto||'', telefono:p.telefono||'', email:p.email||'', direccion:p.direccion||'', notas:p.notas||'' });
    return row;
  };
  const deleteProveedor = async (id) => { if (sb._negocioId) await sb.del("proveedores", id); };

  // ── Guardar remito en Supabase ───────────────────────────
  const saveRemito = async (r) => {
    if (!sb._negocioId) return;
    await sb.insert("remitos", { id:r.id, negocio_id:sb._negocioId, numero:r.numero, fecha:r.fecha||'', proveedor:r.proveedor||'', items:r.items||[], total:r.total||0, metodo_pago:r.metodoPago||'', notas:r.notas||'' });
  };









  // ── Auth y loading screens ───────────────────────────────
  if (!authReady) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f5f7", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ textAlign:"center", color:"#888" }}>
        <img src="/milocal-icon.png" alt="MiLocal" style={{ width:60, height:60, borderRadius:12, marginBottom:12 }}/>
        <div style={{ fontSize:14 }}>Cargando MiLocal...</div>
      </div>
    </div>
  );

  // ── Recuperación de contraseña: el usuario vino del link del email ──
  if (passwordRecoveryMode) {
    return (
      <NuevaPasswordScreen
        onDone={() => { setPasswordRecoveryMode(false); navegar("app"); }}
        onCancelar={async () => { await sb.signOut(); setToken(null); setPasswordRecoveryMode(false); navegar("login"); }}
      />
    );
  }

  if (!token) {
    if (route === "login") return <LoginScreen onLogin={handleLogin} onVolver={() => navegar("home")} />;
    // Cualquier otra ruta sin login → landing
    return <LandingPage onIngresar={() => navegar("login")} />;
  }

  // Panel de administración (solo vos podés entrar — se valida el email en el backend)
  if (route === "admin") {
    return <AdminPage onVolver={() => navegar("app")} />;
  }

  // Con token → asegurar URL /app
  if (route !== "app") {
    // Sincronizar URL con estado logueado
    if (typeof window !== "undefined" && window.location.pathname !== "/app") {
      window.history.replaceState({}, "", "/app");
    }
  }

  if (!loaded) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f5f7", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ textAlign:"center", color:"#888" }}>
        <img src="/milocal-icon.png" alt="MiLocal" style={{ width:60, height:60, borderRadius:12, marginBottom:12 }}/>
        <div style={{ fontSize:14 }}>Sincronizando datos...</div>
      </div>
    </div>
  );


  const ctx = { config, setConfig: saveConfig, products, setProducts, sales, setSales, caja, setCaja, gastos, setGastos, remitos, setRemitos, proveedores, setProveedores, setPage,
    // Supabase DB operations
    saveProduct, saveProducts, deleteProduct, saveVenta, saveCaja, saveGasto, deleteGasto, saveProveedor, deleteProveedor, saveRemito,
    handleLogout,
  };

  const NAV = [
    { id:"venta", label:"Nueva Venta", icon:<ShoppingCart size={16}/> },
    { id:"dashboard", label:"Dashboard", icon:<LayoutDashboard size={16}/> },
    { id:"inventario", label:"Productos e Inventario", icon:<Package size={16}/> },
    { id:"historial", label:"Historial", icon:<Clock size={16}/> },
    { id:"estadisticas", label:"Estadísticas", icon:<TrendingUp size={16}/> },
    { id:"finanzas", label:"Finanzas", icon:<DollarSign size={16}/> },
    { id:"remitos", label:"Remitos", icon:<FileText size={16}/> },
    { id:"suscripcion", label:"Suscripción", icon:<DollarSign size={16}/> },
    { id:"config", label:"Configuración", icon:<Settings size={16}/> },
  ];

  // ── Handlers de suscripción ──
  const handleSuscribir = async () => {
    try { await iniciarSuscripcion(); }
    catch (e) { alert("Error al crear suscripción: " + e.message); }
  };
  const handleCancelar = () => {
    if (!confirm("¿Cancelar tu suscripción? Vamos a coordinar por WhatsApp.")) return;
    abrirCancelacionWhatsApp(config.nombre);
  };

  const PAGES = {
    dashboard:<DashboardPage ctx={ctx}/>,
    venta:<VentaPage ctx={ctx}/>,
    inventario:<InventarioPage ctx={ctx}/>,
    historial:<HistorialPage ctx={ctx}/>,
    estadisticas:<EstadisticasPage ctx={ctx}/>,
    finanzas:<FinanzasPage ctx={ctx}/>,
    remitos:<RemitosPage ctx={ctx}/>,
    suscripcion:<SuscripcionPage config={config} onSuscribir={handleSuscribir} onCancelar={handleCancelar}/>,
    config:<ConfigPage ctx={ctx}/>
  };
  const stockAlert = products.filter(p => p.stock <= (p.stockMinimo||3)).length;

  // ── Estado de suscripción (los hooks ya se llamaron arriba) ──
  const subState = getSubscriptionState(config);

  // ── Onboarding: primer uso sin rubro configurado ──
  if (!config.rubro) {
    return <OnboardingScreen initialNombre={config.nombre} onDone={async (cfg) => { await saveConfig(cfg); setPage("inventario"); }} />;
  }

  // ── Bloqueo por suscripción vencida ──
  if (subState.isBlocked) {
    return <AccesoBloqueadoScreen config={config} onSuscribir={handleSuscribir} onLogout={handleLogout} />;
  }

  return (
    <>
      <style>{THEME_CSS}</style>
      <style>{`
        @media (max-width: 900px) {
          .app-sidebar { transform: translateX(-100%); transition: transform .25s ease; }
          .app-sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.15); }
          .app-main { margin-left: 0 !important; padding-top: 58px; }
          .app-topbar-mobile { display: flex !important; }
          .app-overlay.open { display: block !important; }
          .app-sidebar-close { display: flex !important; }
          .venta-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .app-page-pad { padding: 16px !important; }
          .app-main table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
        }
      `}</style>
      <div style={{ display:"flex", fontFamily:"'DM Sans', system-ui, -apple-system, sans-serif", minHeight:"100vh", background:"var(--bg-page)" }}>

        {/* ── Topbar mobile (solo visible en pantallas chicas) ── */}
        <div className="app-topbar-mobile" style={{
          display:"none", alignItems:"center", gap:12,
          position:"fixed", top:0, left:0, right:0, height:58, zIndex:600,
          background:"var(--bg-sidebar)", borderBottom:"1px solid var(--border-mid)", padding:"0 16px",
        }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:6, color:"var(--text)", flexShrink:0 }}>
            <Menu size={22}/>
          </button>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ color:"var(--text)", fontWeight:700, fontSize:15, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{config.nombre}</div>
          </div>
          {stockAlert > 0 && (
            <span style={{ background:"#dc2626", color:"#fff", fontSize:10, fontWeight:700, minWidth:18, height:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, padding:"0 4px" }}>
              {stockAlert>9?"9+":stockAlert}
            </span>
          )}
        </div>

        {/* ── Overlay oscuro cuando el drawer está abierto (mobile) ── */}
        <div
          className={`app-overlay ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(false)}
          style={{ display:"none", position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:550 }}
        />

        {/* ── Sidebar ── */}
        <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`} style={{ width:230, background:"var(--bg-sidebar)", borderRight:"1px solid var(--border-mid)", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, height:"100vh", zIndex:600 }}>
          <div style={{ padding:"22px 20px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:12 }}>
            {config.logo
              ? <img src={config.logo} alt="logo" style={{ width:42, height:42, borderRadius:10, objectFit:"cover" }} onError={e => e.target.style.display="none"} />
              : <img src="/milocal-icon.png" alt="MiLocal" style={{ width: 42, height: 42, borderRadius: 10 }}/>
            }
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ color:"var(--text)", fontWeight:700, fontSize:16, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.4px" }}>{config.nombre}</div>
              <div style={{ color:"var(--text-light)", fontSize:11.5, marginTop:3 }}>MiLocal gestión de ventas</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="app-sidebar-close" style={{ display:"none", background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", flexShrink:0, padding:4 }}>
              <X size={20}/>
            </button>
          </div>
          <nav style={{ flex:1, padding:"14px 12px", display:"flex", flexDirection:"column", gap:3, overflowY:"auto" }}>
            {NAV.map(n => {
              const isActive = page === n.id;
              return (
                <button key={n.id} onClick={() => { setPage(n.id); setSidebarOpen(false); }} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"12px 14px", borderRadius:8, border:"none", cursor:"pointer",
                  fontSize:15, textAlign:"left", width:"100%",
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text2)",
                  fontWeight: isActive ? 600 : 500,
                  fontFamily:"inherit",
                  position:"relative",
                  transition:"background .15s, color .15s"
                }}>
                  <span style={{ display:"flex", flexShrink:0 }}>{React.cloneElement(n.icon, { size: 18 })}</span>
                  <span style={{ flex:1 }}>{n.label}</span>
                  {n.id==="inventario" && stockAlert>0 && (
                    <span style={{ background:"#dc2626", color:"#fff", fontSize:10, fontWeight:700, minWidth:18, height:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, padding:"0 4px" }}>
                      {stockAlert>9?"9+":stockAlert}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div style={{ padding:"16px 20px", borderTop:"1px solid var(--border)" }}>
            {caja.abierta && <div style={{ background:"#f0fdf4", borderRadius:7, padding:"6px 12px", marginBottom:10, fontSize:13, color:"#16a34a", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><Unlock size={13}/>Caja abierta</div>}
            <button onClick={handleLogout} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:"none", border:"1px solid var(--border-mid)", borderRadius:7, padding:"9px 12px", cursor:"pointer", fontSize:13.5, color:"var(--text-muted)", marginBottom:10, fontFamily:"inherit" }}>
              <LogOut size={13}/> Cerrar sesión
            </button>
            <div style={{ color:"var(--text-light)", fontSize:11 }}>Versión</div>
            <div style={{ color:"var(--text-muted)", fontSize:12, fontWeight:600 }}>1.0 Beta</div>
          </div>
        </aside>
        <main className="app-main" style={{ marginLeft:230, flex:1, overflow:"auto", minHeight:"100vh", width:"100%" }}>
          {showSubscriptionSuccess && (
            <div style={{ background:"#dcfce7", borderBottom:"1px solid #86efac", padding:"14px 24px", display:"flex", alignItems:"center", gap:10, color:"#15803d", fontSize:14, fontWeight:600, flexWrap:"wrap" }}>
              <CheckCircle2 size={18}/>
              ¡Suscripción activada con éxito! Ya podés seguir usando MiLocal sin límites.
              <button onClick={() => setShowSubscriptionSuccess(false)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#15803d", display:"flex" }}><X size={16}/></button>
            </div>
          )}
          {subState.isTrial && subState.daysLeft <= 3 && page !== "suscripcion" && (
            <TrialBanner daysLeft={subState.daysLeft} onSuscribir={() => setPage("suscripcion")} />
          )}
          {subState.status === "past_due" && !subState.isBlocked && page !== "suscripcion" && (
            <PastDueBanner daysLeft={subState.daysLeft} onSuscribir={() => setPage("suscripcion")} />
          )}
          <ErrorBoundary>
            {PAGES[page] ?? PAGES.dashboard}
          </ErrorBoundary>
        </main>
      </div>
    </>
  );
}
