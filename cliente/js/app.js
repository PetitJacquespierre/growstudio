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
const URL_API_DIVISAS_BCV = "https://script.google.com/macros/s/AKfycbwsoD8ahtAQUqfY0TQWf3-dDs29HL8kEJa2t-mjDR3PAo3exTTmtSwXqYuNB2ob5dFpgw/exec";
let bcvRate = parseFloat(localStorage.getItem("bcvRateCache")) || 820.10;

async function fetchBCVRate() {
    try {
        const response = await fetch(URL_API_DIVISAS_BCV);
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

function actualizarCalculosBCV() {
    if (!currentClient) return;
    const deudaUsd = parseFloat(currentClient.deuda || 0);
    const deudaBs = (deudaUsd * bcvRate).toFixed(2);
    
    const deudaBsEl = document.getElementById("dash-deuda-bs");
    if (deudaBsEl) deudaBsEl.innerText = Number(deudaBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const bcvRateEl = document.getElementById("dash-bcv-rate");
    if (bcvRateEl) bcvRateEl.innerText = bcvRate.toFixed(2);

    window.onMetodoPagoChange();
}

window.onMetodoPagoChange = function() {
    const metodoSelect = document.getElementById("pay-metodo");
    if (!metodoSelect || !currentClient) return;
    const metodo = metodoSelect.value;
    const labelMonto = document.getElementById("label-pay-monto");
    const inputMonto = document.getElementById("pay-monto");
    const hintMonto = document.getElementById("pay-monto-hint");
    const deudaUsd = parseFloat(currentClient.deuda || 0);

    if (metodo === "Pago Móvil") {
        if (labelMonto) labelMonto.innerText = "Monto a Pagar (Bs)";
        const montoBs = (deudaUsd * bcvRate).toFixed(2);
        if (inputMonto) inputMonto.value = montoBs;
        if (hintMonto) {
            hintMonto.innerText = `≈ $${deudaUsd.toFixed(2)} USD a tasa BCV (${bcvRate.toFixed(2)} Bs/$)`;
        }
    } else {
        if (labelMonto) labelMonto.innerText = "Monto a Pagar ($ USD)";
        if (inputMonto) inputMonto.value = deudaUsd.toFixed(2);
        if (hintMonto) {
            hintMonto.innerText = "Pago en divisas / dólares";
        }
    }
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

        // 1. Buscar en campo 'cedula' configurado por el admin
        for (const val of variations) {
            const q = query(collection(db, "clientes"), where("cedula", "==", val));
            const snap = await getDocs(q);
            if (!snap.empty) {
                foundDoc = snap.docs[0];
                break;
            }
        }

        // 2. Buscar en campo 'usuario' configurado por el admin si no coincidió con cédula
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

    document.getElementById("dash-cliente-nombre").innerText = currentClient.businessName || currentClient.nombre || "Cliente";
    
    // Proyecto puede ser la URL o el ID del documento
    const plan = currentClient.plan || "PRUEBA";
    document.getElementById("dash-proyecto").innerText = `Plan: ${plan}`;
    
    const deuda = parseFloat(currentClient.deuda || 0).toFixed(2);
    document.getElementById("dash-deuda").innerText = deuda;

    const badge = document.getElementById("dash-estado-badge");
    const estado = currentClient.estado || "ACTIVO";
    if (estado === "SUSPENDIDO") {
        badge.innerText = "SUSPENDIDO";
        badge.className = "badge badge-suspended";
    } else if (estado === "MOROSO") {
        badge.innerText = "MOROSO";
        badge.className = "badge badge-suspended"; // Usamos el mismo rojo
    } else {
        badge.innerText = "ACTIVO";
        badge.className = "badge badge-active";
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
