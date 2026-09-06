import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    const cedula = cedulaInput.value.trim().toLowerCase(); // Usamos el ID en minúsculas por si acaso
    const errorMsg = document.getElementById("login-error");
    const btn = document.getElementById("btn-login");

    if (!cedula) {
        errorMsg.innerText = "Por favor, ingresa tu Cédula o ID del proyecto.";
        return;
    }

    errorMsg.innerText = "";
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Verificando...';
    btn.disabled = true;

    try {
        const docRef = doc(db, "clientes", cedula);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentClientId = docSnap.id;
            currentClient = docSnap.data();
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
    } else {
        badge.innerText = "ACTIVO";
        badge.className = "badge badge-active";
    }
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
        
        // Guardar el pago en la colección "pagos" para que el admin lo vea
        await addDoc(collection(db, "pagos"), {
            cedula: currentClientId, // Guardamos el ID del cliente
            nombre: currentClient.businessName || currentClient.nombre || "Cliente",
            monto: monto,
            metodo: metodo,
            referencia: ref,
            estado: "POR REVISAR",
            fechaLocal: fechaCorta,
            fechaRegistro: new Date().toISOString()
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
