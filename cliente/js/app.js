const API_URL = "https://script.google.com/macros/s/AKfycbxQyj-9VTVcBoK_vDRZi1jwzXi-WABzZ1hVuxp0WAE_Gj7TVknm6NOwiEQOHQ2XS-qA/exec";
let currentClient = null;

// Inicialización de eventos al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    // Al presionar Enter en el campo de Cédula, hace login
    const cedulaInput = document.getElementById("cedula-input");
    if (cedulaInput) {
        cedulaInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                login();
            }
        });
    }

    // Al presionar Enter en los campos de pago, envía el reporte
    const payInputs = ["pay-monto", "pay-ref"];
    payInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    reportarPago();
                }
            });
        }
    });
});

// =========================================
// FUNCIONES DE LOGIN
// =========================================
async function login() {
    const cedulaInput = document.getElementById("cedula-input");
    const cedula = cedulaInput.value.trim();
    const errorMsg = document.getElementById("login-error");
    const btn = document.getElementById("btn-login");

    if (!cedula) {
        errorMsg.innerText = "Por favor, ingresa tu Cédula o RIF.";
        return;
    }

    // Estado de carga
    errorMsg.innerText = "";
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Verificando...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}?id=${encodeURIComponent(cedula)}`);
        const data = await response.json();

        if (data.error) {
            errorMsg.innerText = "Cédula no encontrada en nuestra base de datos.";
            btn.innerHTML = originalBtnHTML;
            btn.disabled = false;
        } else {
            // Éxito: Guardar cliente y mostrar dashboard
            currentClient = data.cliente;
            mostrarDashboard();
        }
    } catch (error) {
        errorMsg.innerText = "Error de conexión. Intenta nuevamente.";
        console.error(error);
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
    }
}

function logout() {
    currentClient = null;
    document.getElementById("cedula-input").value = "";
    document.getElementById("login-screen").classList.add("active");
    document.getElementById("login-screen").classList.remove("hidden");
    
    document.getElementById("dashboard-screen").classList.remove("active");
    document.getElementById("dashboard-screen").classList.add("hidden");
    
    // Resetear botón de login
    const btn = document.getElementById("btn-login");
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Ingresar al Portal';
    btn.disabled = false;
}

// =========================================
// MOSTRAR DASHBOARD
// =========================================
function mostrarDashboard() {
    // Ocultar login, mostrar dashboard
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("hidden");
    
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("dashboard-screen").classList.add("active");

    // Llenar datos
    document.getElementById("dash-cliente-nombre").innerText = currentClient.nombre;
    document.getElementById("dash-proyecto").innerText = currentClient.proyecto;
    document.getElementById("dash-deuda").innerText = parseFloat(currentClient.deuda).toFixed(2);

    // Estado Badge
    const badge = document.getElementById("dash-estado-badge");
    if (currentClient.estado === "SUSPENDIDO") {
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
async function reportarPago() {
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

    // Estado de carga
    msgBox.innerText = "";
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner white"></span> Enviando...';
    btn.disabled = true;

    const payload = {
        id: currentClient.id,
        monto: monto,
        metodo: metodo,
        referencia: ref
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "no-cors", // Para evitar bloqueos CORS con doPost de Google Apps Script simple
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        // Como usamos no-cors, la respuesta será opaca, pero si no tira error en el catch, asumimos éxito
        msgBox.className = "msg-box success-msg";
        msgBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Pago enviado a revisión exitosamente!';
        
        // Limpiar formulario
        montoInput.value = "";
        refInput.value = "";

    } catch (error) {
        msgBox.className = "msg-box error-msg";
        msgBox.innerText = "Error al enviar el reporte. Intenta de nuevo.";
        console.error(error);
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalBtnHTML;
            btn.disabled = false;
        }, 1000);
    }
}
