import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de Firebase (Idéntica al Admin)
const firebaseConfig = {
    projectId: "grow-studio-menus",
    appId: "1:152582182898:web:cf17e88b6b1f861cdc7d6b",
    storageBucket: "grow-studio-menus.firebasestorage.app",
    apiKey: "AIzaSyAv7GDSLS3Kwb-aMAhyQE3YgnPkCNg8cvg",
    authDomain: "grow-studio-menus.firebaseapp.com",
    messagingSenderId: "152582182898",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentClient = null;
let currentClientId = null; // Guardamos también el ID del documento en firebase

// =========================================
// TASA BCV EN VIVO
// =========================================
const URL_API_DIVISAS_BCV = "https://script.google.com/macros/s/AKfycbyazhyYfK-vURGv34XF-oTW1_34rTVRs2WM7-aNlswf-mIGhIwgaLgwfGx1xZxfm50/exec";
let bcvRate = parseFloat(localStorage.getItem("bcvRateCache")) || 853.50;

async function fetchBCVRate() {
    try {
        const response = await fetch(URL_API_DIVISAS_BCV + "?t=" + Date.now());
        const data = await response.json();
        if (data && data.usd) {
            const nueva = parseFloat(data.usd);
            if (nueva > 10) {
                bcvRate = nueva;
                localStorage.setItem("bcvRateCache", bcvRate);
                actualizarCalculosBCV();
            }
        }
    } catch (e) {
        console.warn("Usando tasa BCV cacheada:", bcvRate);
    }
}

let selectedMontoUsd = null; // null significa deuda completa por defecto

function actualizarCalculosBCV() {
    if (!currentClient) return;
    const deudaTotalUsd = parseFloat(currentClient.deuda || 0);
    const deudaBs = (deudaTotalUsd * bcvRate).toFixed(2);
    
    const deudaBsEl = document.getElementById("dash-deuda-bs");
    if (deudaBsEl) deudaBsEl.innerText = Number(deudaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const bcvRateEl = document.getElementById("dash-bcv-rate");
    if (bcvRateEl) bcvRateEl.innerText = bcvRate.toFixed(2);

    const topBcvEl = document.getElementById("dash-top-bcv-rate");
    if (topBcvEl) topBcvEl.innerText = bcvRate.toFixed(2);

    window.onMetodoPagoChange();
}

// Configurar monto a pagar desde los chips de cuotas rápidas
window.seleccionarCuota = function(montoUsd, chipBtn) {
    selectedMontoUsd = montoUsd;
    document.querySelectorAll('.quick-amount-chip').forEach(btn => {
        btn.style.borderColor = 'rgba(255,255,255,0.15)';
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = '#fff';
    });
    if (chipBtn) {
        chipBtn.style.borderColor = '#00d2ff';
        chipBtn.style.background = 'rgba(0, 210, 255, 0.2)';
        chipBtn.style.color = '#00d2ff';
    }
    window.onMetodoPagoChange();
};

window.onMetodoPagoChange = function() {
    const metodoSelect = document.getElementById("pay-metodo");
    if (!metodoSelect || !currentClient) return;
    const metodo = metodoSelect.value;
    const labelMonto = document.getElementById("label-pay-monto");
    const inputMonto = document.getElementById("pay-monto");
    const hintMonto = document.getElementById("pay-monto-hint");
    
    const deudaTotalUsd = parseFloat(currentClient.deuda || 0);
    // Si el usuario seleccionó una cuota específica ($50, $100, etc.), usar esa; si no, la deuda total
    const montoUsdActivo = (selectedMontoUsd !== null && selectedMontoUsd > 0) ? selectedMontoUsd : deudaTotalUsd;

    // Tarjetas de datos de pago
    const cardMovil = document.getElementById("datos-pago-movil");
    const cardDivisa = document.getElementById("datos-pago-divisa");
    const tituloDiv = document.getElementById("datos-divisa-titulo");
    const iconoDiv = document.getElementById("datos-divisa-icono");
    const emailSection = document.getElementById("datos-divisa-email-section");
    const wpSection = document.getElementById("datos-divisa-wp-section");
    const dpMontoDivisa = document.getElementById("dp-monto-divisa");

    const metodosMail = ["Zelle", "Zinli", "Binance"];

    if (metodo === "Pago Móvil") {
        if (labelMonto) labelMonto.innerText = "Monto a Pagar (Bs)";
        const montoBs = (montoUsdActivo * bcvRate).toFixed(2);
        if (inputMonto) inputMonto.value = montoBs;
        if (hintMonto) hintMonto.innerText = `≈ $${montoUsdActivo.toFixed(2)} USD a tasa BCV (${bcvRate.toFixed(2)} Bs/$)`;
        if (cardMovil) cardMovil.style.display = "block";
        if (cardDivisa) cardDivisa.style.display = "none";
    } else {
        if (labelMonto) labelMonto.innerText = "Monto a Pagar ($ USD)";
        if (inputMonto) inputMonto.value = montoUsdActivo.toFixed(2);
        if (hintMonto) hintMonto.innerText = `Pago en divisas / dólares ($${montoUsdActivo.toFixed(2)} USD)`;
        if (cardMovil) cardMovil.style.display = "none";
        if (cardDivisa) cardDivisa.style.display = "block";

        // Título e ícono dinámico
        const configs = {
            "Zinli":   { titulo: "Pago por Zinli",          icono: "fa-solid fa-mobile-screen-button" },
            "Binance": { titulo: "Pago por Binance (USDT)", icono: "fa-solid fa-coins" },
            "Divisa":  { titulo: "Pago en Divisas / Efectivo", icono: "fa-solid fa-money-bill" },
            "Otro":    { titulo: "Otro Método de Pago",    icono: "fa-solid fa-ellipsis" },
        };
        const cfg = configs[metodo] || configs["Divisa"];
        if (tituloDiv) tituloDiv.innerText = cfg.titulo;
        if (iconoDiv) iconoDiv.className = cfg.icono;

        // Mostrar email o WhatsApp según método
        if (metodosMail.includes(metodo)) {
            if (emailSection) emailSection.style.display = "block";
            if (wpSection) wpSection.style.display = "none";
            if (dpMontoDivisa) dpMontoDivisa.innerText = `$${montoUsdActivo.toFixed(2)} USD`;
        } else {
            if (emailSection) emailSection.style.display = "none";
            if (wpSection) wpSection.style.display = "block";
        }
    }
};

// Copiar dato al portapapeles
window.copiarDato = function(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
    }).catch(() => {
        // Fallback si clipboard no está disponible
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
    });
};

// Inicialización de eventos al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    const cedulaInput = document.getElementById("cedula-input");
    if (cedulaInput) {
        cedulaInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                window.login();
            }
        });
    }

    const payMetodo = document.getElementById("pay-metodo");
    if (payMetodo) {
        payMetodo.addEventListener("change", window.onMetodoPagoChange);
    }

    const payInputs = ["pay-monto", "pay-ref"];
    payInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    window.reportarPago();
                }
            });
        }
    });
});

// =========================================
// FUNCIONES DE LOGIN
// =========================================
window.login = async function() {
    const cedulaInput = document.getElementById("cedula-input");
    const rawVal = cedulaInput.value.trim();
    const errorMsg = document.getElementById("login-error");
    const btn = document.getElementById("btn-login");

    if (!rawVal) {
        errorMsg.innerText = "Por favor, ingresa tu Cédula o ID del proyecto.";
        return;
    }

    errorMsg.innerText = "";
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Verificando...';
    btn.disabled = true;

    try {
        let foundDoc = null;

        // Búsqueda estricta basada únicamente en lo configurado en Cobranza SaaS (cedula o usuario)
        const cleanDigits = rawVal.replace(/\D/g, ''); // solo dígitos si es cédula: ej. 14074299
        const variations = new Set([
            rawVal,
            rawVal.toLowerCase(),
            rawVal.toUpperCase()
        ]);

        // Si es numérico (cédula), permitimos flexibilidad en mayúsculas/minúsculas y guiones
        if (cleanDigits && cleanDigits.length >= 6) {
            variations.add(cleanDigits);
            variations.add(`V-${cleanDigits}`);
            variations.add(`V${cleanDigits}`);
            variations.add(`v-${cleanDigits}`);
            variations.add(`v${cleanDigits}`);
            variations.add(`J-${cleanDigits}`);
            variations.add(`J${cleanDigits}`);
            variations.add(`E-${cleanDigits}`);
        }

        // 1. Detección especial de Producción: Sandía Production
        const normalizedVal = rawVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
        const isSandiaQuery = normalizedVal.includes("sandia") || 
                              variations.has("sandia") || 
                              variations.has("sandía") || 
                              variations.has("sandiaproduction") || 
                              variations.has("sandía production") || 
                              variations.has("sandia production") || 
                              variations.has("sandia_production") || 
                              cleanDigits === "16314604";

        if (isSandiaQuery) {
            try {
                const sandiaDocRef = doc(db, "sandia_config", "general");
                const sandiaSnap = await getDoc(sandiaDocRef);
                const sData = sandiaSnap.exists() ? sandiaSnap.data() : {};

                currentClientId = "sandia_production";
                const deudaRegistrada = sData.deuda !== undefined ? parseFloat(sData.deuda) : 100;
                currentClient = {
                    businessName: "Sandía Production",
                    nombre: "Sandía Production",
                    titular: "Dehivi González",
                    cedula: "V-16.314.604",
                    proyecto: "Plataforma Web, Calendario Runner & Retos Deportivos",
                    plan: sData.plan || "MENSUAL",
                    deuda: deudaRegistrada,
                    deudaWeb: sData.deudaWeb !== undefined ? parseFloat(sData.deudaWeb) : deudaRegistrada,
                    fechaVencimiento: sData.vencimiento || "2026-11-10",
                    estado: sData.estadoWeb === "ONLINE" || !sData.estadoWeb ? "ACTIVO" : sData.estadoWeb,
                    tipoServicio: "PRODUCCION_WEB"
                };
                mostrarDashboard();
                return;
            } catch (errSandia) {
                console.warn("Error consultando sandia_config:", errSandia);
            }
        }

        // 2. Buscar en campo 'cedula' configurado por el admin en la colección 'clientes' (SaaS)
        for (const val of variations) {
            const q = query(collection(db, "clientes"), where("cedula", "==", val));
            const snap = await getDocs(q);
            if (!snap.empty) {
                foundDoc = snap.docs[0];
                break;
            }
        }

        // 3. Buscar en campo 'usuario' configurado por el admin si no coincidió con cédula
        if (!foundDoc) {
            for (const val of variations) {
                const q = query(collection(db, "clientes"), where("usuario", "==", val));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    foundDoc = snap.docs[0];
                    break;
                }
            }
        }

        // 4. Buscar por ID del documento directo en 'clientes' (ej: pasteles_la_flaca, foodpoint)
        if (!foundDoc) {
            for (const val of variations) {
                try {
                    const directSnap = await getDoc(doc(db, "clientes", val));
                    if (directSnap.exists()) {
                        foundDoc = directSnap;
                        break;
                    }
                } catch(e) {}
            }
        }

        if (foundDoc && foundDoc.exists()) {
            currentClientId = foundDoc.id;
            currentClient = foundDoc.data();
            mostrarDashboard();
        } else {
            errorMsg.innerText = "Cédula o ID no encontrado en nuestra base de datos.";
            btn.innerHTML = originalBtnHTML;
            btn.disabled = false;
        }
    } catch (error) {
        errorMsg.innerText = "Error de conexión. Intenta nuevamente.";
        console.error("Error Firebase:", error);
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
    }
};

window.logout = function() {
    currentClient = null;
    currentClientId = null;
    document.getElementById("cedula-input").value = "";
    document.getElementById("login-screen").classList.add("active");
    document.getElementById("login-screen").classList.remove("hidden");
    
    document.getElementById("dashboard-screen").classList.remove("active");
    document.getElementById("dashboard-screen").classList.add("hidden");
    
    const btn = document.getElementById("btn-login");
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Ingresar al Portal';
    btn.disabled = false;
};

// =========================================
// MOSTRAR DASHBOARD
// =========================================
function mostrarDashboard() {
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("hidden");
    
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("dashboard-screen").classList.add("active");

    const clientName = currentClient.businessName || currentClient.nombre || "Cliente";
    document.getElementById("dash-cliente-nombre").innerText = clientName;
    
    // Proyecto y detalles del servicio
    const plan = currentClient.plan || "MENSUAL";
    if (currentClient.proyecto) {
        document.getElementById("dash-proyecto").innerText = `Proyecto: ${currentClient.proyecto} (${plan})`;
    } else {
        document.getElementById("dash-proyecto").innerText = `Plan: ${plan}`;
    }
    
    const deuda = parseFloat(currentClient.deuda || 0).toFixed(2);
    document.getElementById("dash-deuda").innerText = deuda;

    const badge = document.getElementById("dash-estado-badge");
    const estado = currentClient.estado || "ACTIVO";
    if (estado === "SUSPENDIDO") {
        badge.innerText = "SUSPENDIDO";
        badge.className = "badge badge-suspended";
    } else if (estado === "MOROSO") {
        badge.innerText = "MOROSO";
        badge.className = "badge badge-suspended";
    } else {
        badge.innerText = "ACTIVO";
        badge.className = "badge badge-active";
    }

    // Información de Vencimiento
    const vencimientoEl = document.getElementById("dash-vencimiento-info");
    const fechaV = currentClient.fechaVencimiento || "";
    if (vencimientoEl) {
        if (fechaV) {
            const [y, m, d] = fechaV.split('-');
            const fechaFormateada = (d && m && y) ? `${d}/${m}/${y}` : fechaV;
            vencimientoEl.innerHTML = `<i class="fa-regular fa-calendar-check"></i> Próximo corte: <strong>${fechaFormateada}</strong>`;
        } else {
            vencimientoEl.innerHTML = `<i class="fa-regular fa-calendar-check"></i> Próximo corte: <strong>Al día</strong>`;
        }
    }

    // Lógica especial de Desglose y Cuotas para Sandía Production
    const desgloseCard = document.getElementById("dash-desglose-card");
    const desgloseTag = document.getElementById("dash-desglose-tag");
    const desgloseDesc = document.getElementById("dash-desglose-desc");
    const desgloseItems = document.getElementById("dash-desglose-items");
    const quickContainer = document.getElementById("quick-amount-container");
    const quickButtons = document.getElementById("quick-amount-buttons");

    selectedMontoUsd = null; // Reiniciar selección manual

    if (currentClientId === "sandia_production") {
        // Fecha de corte oficial: día 10 (ej: 2026-11-10) con 5 días de holgura/gracia (hasta el día 15)
        const hoy = new Date();
        const baseVenc = fechaV ? new Date(fechaV + 'T00:00:00') : new Date('2026-11-10T00:00:00');
        const fechaGracia = new Date(baseVenc);
        fechaGracia.setDate(fechaGracia.getDate() + 5); // 5 días de holgura (hasta el 15)

        const pasoCorte = hoy >= baseVenc;
        const pasoGracia = hoy > fechaGracia;
        const mensualidad = 20;

        let saldoWeb = parseFloat(currentClient.deudaWeb !== undefined ? currentClient.deudaWeb : currentClient.deuda);
        if (isNaN(saldoWeb)) saldoWeb = 100;

        desgloseCard.style.display = "block";
        desgloseTag.innerText = "Acuerdo Flexible";
        desgloseDesc.innerText = "Resumen del plan acordado para elaboración web y mantenimiento (Corte los días 10 con 5 días de holgura):";

        let htmlItems = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.08);">
                <span style="color: #e4e4e7;">🌐 Saldo restante elaboración web ($200 - $100 abonados):</span>
                <strong style="color: #00d2ff;">$${saldoWeb.toFixed(2)} USD</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.08);">
                <span style="color: #e4e4e7;">⚡ Mantenimiento mensual (Octubre):</span>
                <span style="color: #10b981; font-weight: 700;">Al día ($0.00)</span>
            </div>
        `;

        if (pasoCorte) {
            htmlItems += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; color: ${pasoGracia ? '#ef4444' : '#f59e0b'};">
                    <span>⚠️ Mensualidad ciclo (Corte día 10${pasoGracia ? ' - Fuera de gracia' : ' - En holgura hasta el 15'}):</span>
                    <strong>+$${mensualidad.toFixed(2)} USD</strong>
                </div>
            `;
        }

        desgloseItems.innerHTML = htmlItems;

        // Generar botones de cuotas rápidas
        if (quickContainer && quickButtons) {
            quickContainer.style.display = "block";
            let chips = [];

            if (saldoWeb > 50) {
                chips.push({ label: "Abonar Quincena Web ($50)", usd: 50 });
                chips.push({ label: `Liquidar Saldo Web ($${saldoWeb})`, usd: saldoWeb });
            } else if (saldoWeb > 0) {
                chips.push({ label: `Abonar Saldo Web ($${saldoWeb})`, usd: saldoWeb });
            }

            if (pasoCorte) {
                chips.push({ label: `Cuota Quincenal + Mant. ($${50 + mensualidad})`, usd: 50 + mensualidad });
                chips.push({ label: `Total Acumulado ($${saldoWeb + mensualidad})`, usd: saldoWeb + mensualidad });
            }

            quickButtons.innerHTML = chips.map((c, idx) => `
                <button type="button" class="quick-amount-chip" onclick="window.seleccionarCuota(${c.usd}, this)" style="background: ${idx === 0 ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${idx === 0 ? '#00d2ff' : 'rgba(255,255,255,0.15)'}; color: ${idx === 0 ? '#00d2ff' : '#fff'}; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    ${c.label}
                </button>
            `).join('');

            // Seleccionar por defecto la primera cuota sugerida ($50 o total)
            if (chips.length > 0) {
                selectedMontoUsd = chips[0].usd;
            }
        }

    } else {
        // Clientes regulares
        if (parseFloat(currentClient.deuda || 0) > 0) {
            desgloseCard.style.display = "block";
            desgloseTag.innerText = "Mensualidad";
            desgloseDesc.innerText = "Servicio de Menú Digital y Hospedaje en la Nube:";
            desgloseItems.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                    <span style="color: #e4e4e7;">Plan ${plan}:</span>
                    <strong style="color: #00d2ff;">$${deuda} USD</strong>
                </div>
            `;
        } else {
            desgloseCard.style.display = "none";
        }
        if (quickContainer) quickContainer.style.display = "none";
    }

    // Actualizar montos en Bolívares y tasa BCV
    fetchBCVRate();
    actualizarCalculosBCV();
}

// =========================================
// REPORTAR PAGO
// =========================================
window.reportarPago = async function() {
    const montoInput = document.getElementById("pay-monto");
    const metodoInput = document.getElementById("pay-metodo");
    const refInput = document.getElementById("pay-ref");
    const msgBox = document.getElementById("report-msg");
    const btn = document.getElementById("btn-reportar");

    const monto = parseFloat(montoInput.value);
    const metodo = metodoInput.value;
    const ref = refInput.value.trim();

    if (!monto || monto <= 0 || !ref) {
        msgBox.className = "msg-box error-msg";
        msgBox.innerText = "Completa todos los campos (Monto y Referencia).";
        return;
    }

    msgBox.innerText = "";
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner white"></span> Enviando...';
    btn.disabled = true;

    try {
        const fechaCorta = new Date().toLocaleDateString('es-ES'); // ej: "15/10/2023"
        const esBs = (metodo === "Pago Móvil");
        // Si pagó en Bolívares (Pago Móvil), convertimos a USD equivalente para descontar de la deuda
        const montoUsd = esBs ? parseFloat((monto / bcvRate).toFixed(2)) : monto;
        
        // Guardar el pago en la colección "pagos" para que el admin lo vea
        await addDoc(collection(db, "pagos"), {
            cedula: currentClient.cedula || currentClientId,
            clienteId: currentClientId,
            nombre: currentClient.businessName || currentClient.nombre || "Cliente",
            monto: montoUsd,
            montoReportado: monto,
            moneda: esBs ? "Bs" : "USD",
            tasaBcv: bcvRate,
            metodo: metodo,
            referencia: ref,
            estado: "POR REVISAR",
            fechaLocal: fechaCorta,
            fechaRegistro: new Date().toISOString(),
            fecha: new Date().toISOString()
        });

        msgBox.className = "msg-box success-msg";
        msgBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Pago enviado a revisión exitosamente!';
        
        montoInput.value = "";
        refInput.value = "";

    } catch (error) {
        msgBox.className = "msg-box error-msg";
        msgBox.innerText = "Error al conectar con la base de datos. Intenta de nuevo.";
        console.error("Firebase AddDoc Error:", error);
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalBtnHTML;
            btn.disabled = false;
        }, 1000);
    }
};
