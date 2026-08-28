import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// 1. CARGA DEL PORTAFOLIO DESDE FIREBASE
async function cargarPortafolioFirebase() {
    const bentoContainer = document.getElementById('bento-container');
    if (!bentoContainer) return;
    
    try {
        bentoContainer.innerHTML = '<div style="color: var(--accent-cyan); font-size: 0.8rem;">[ FETCHING_FIREBASE... ]</div>';
        
        const querySnapshot = await getDocs(collection(db, "clientes"));
        bentoContainer.innerHTML = '';
        
        const proyectos = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.estado === "ACTIVO" && data.url) {
                proyectos.push({
                    titulo: data.businessName || doc.id,
                    enlace: data.url,
                    imagen: data.imagenPortafolio || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=500&q=80'
                });
            }
        });

        if (proyectos.length === 0) {
            bentoContainer.innerHTML = '<div style="color: gray;">[ NO_ACTIVE_CLIENTS ]</div>';
            return;
        }

        const proyectosDuplicados = [...proyectos, ...proyectos];
        proyectosDuplicados.forEach(proyecto => {
            const box = document.createElement('div');
            box.className = 'bento-box';
            box.style.backgroundImage = 'url("' + proyecto.imagen + '")';
            box.innerHTML = `
                <div class="overlay">
                    <h3>${proyecto.titulo}</h3>
                    <a href="${proyecto.enlace}" target="_blank">INSPECCIONAR_SISTEMA <i class="fas fa-external-link-alt"></i></a>
                </div>
            `;
            bentoContainer.appendChild(box);
        });
    } catch (error) {
        console.error("Error conectando con Firebase Firestore:", error);
        bentoContainer.innerHTML = '<div style="color: red;">[ SYSTEM_FAILURE: CANNOT_CONNECT ]</div>';
    }
}

// 2. REGISTRO DE PAGOS DIRECTO A FIREBASE
const form = document.getElementById('registroForm');
if (form) {
    // Clonamos el nodo para remover todos los listeners antiguos (como el fetch a google sheets)
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const telefono = document.getElementById('telefono').value;
        const cedula = document.getElementById('cedula').value;
        const metodoPago = document.getElementById('metodoPago').value;
        const refPago = document.getElementById('refPago').value;
        
        // Window properties set by abrirModal in index.html
        const planActualStr = window.planActual || document.getElementById('planSeleccionado').innerText;
        const precioActualStr = window.precioActual || document.getElementById('precioMostrar').innerText;
        const montoNumerico = parseFloat(precioActualStr.replace(/[^0-9.]/g, '')) || 0;
        
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "PROCESANDO PAGO...";
        submitBtn.disabled = true;
        
        try {
            await addDoc(collection(db, "pagos"), {
                fecha: serverTimestamp(),
                email: email,
                telefono: telefono,
                cedula: cedula,
                metodo: metodoPago,
                referencia: refPago,
                plan: planActualStr,
                monto: montoNumerico,
                estado: "POR REVISAR",
                fechaLocal: new Date().toLocaleString("es-VE")
            });
            
            alert("¡Registro Exitoso! Tu pago está siendo verificado por nuestro equipo.");
            if (typeof window.cerrarModal === 'function') window.cerrarModal();
            newForm.reset();
        } catch (error) {
            console.error(error);
            alert("Error al procesar el pago: " + error.message);
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Reemplaza el cargarPortafolio() viejo si se ejecutó
    // setTimeout(cargarPortafolioFirebase, 2000); 
});
