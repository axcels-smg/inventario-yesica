// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBZX2IoQDD-iWNzZ5XydL68aE1dZHyfsm4",
    authDomain: "inventario-yesica-db01c.firebaseapp.com",
    projectId: "inventario-yesica-db01c",
    storageBucket: "inventario-yesica-db01c.firebasestorage.app",
    messagingSenderId: "461672703245",
    appId: "1:461672703245:web:0c4e577c1fa21f75577c44"
};

// Inicializar Firebase
initializeApp(firebaseConfig);

window.App = {

    iniciar: function(){

        UI.mostrar(Storage.obtener());

        UI.mostrarVentas(
            Storage.obtenerVentas()
        );

        window.App.actualizarListaProductos();

    },

    agregar: function(){

        let nombre =
            document.getElementById("nombre").value;

        let modelo =
            document.getElementById("modelo").value;

        let categoria =
            document.getElementById("categoria").value;

        let precio =
            document.getElementById("precio").value;

        let stock =
            document.getElementById("stock").value;

        if(
            nombre == "" ||
            modelo == "" ||
            precio == "" ||
            stock == ""
        ){

            Swal.fire({
                icon:"warning",
                title:"Completa los campos"
            });

            return;

        }

        let productos =
            Storage.obtener();

        productos.push({

            id: Date.now(),

            nombre,
            modelo,
            categoria,

            precio:Number(precio),

            stock:Number(stock)

        });

        Storage.guardar(productos);

        UI.mostrar(productos);

        window.App.actualizarListaProductos();

        Swal.fire({
            toast:true,
            position:'top-end',
            icon:'success',
            title:'Producto agregado',
            showConfirmButton:false,
            timer:2000
        });

        document.getElementById("nombre").value="";
        document.getElementById("modelo").value="";
        document.getElementById("precio").value="";
        document.getElementById("stock").value="";

    },

    eliminar: function(index){

        let productos =
            Storage.obtener();

        productos.splice(index,1);

        Storage.guardar(productos);

        UI.mostrar(productos);

        window.App.actualizarListaProductos();

    },

    editar: function(index){

        let productos =
            Storage.obtener();

        let p = productos[index];

        let nuevoNombre =
            prompt("Nuevo nombre", p.nombre);

        if(nuevoNombre == null) return;

        p.nombre = nuevoNombre;

        Storage.guardar(productos);

        UI.mostrar(productos);

    },

    filtrar: function(){

        let categoria =
            document.getElementById("filtroCategoria").value;

        let texto =
            document.getElementById("buscar")
            .value
            .toLowerCase();

        let productos =
            Storage.obtener();

        let filtrados =
            productos.filter(p=>{

                let categoriaOk =
                    categoria == "todas" ||
                    p.categoria == categoria;

                let textoOk =

                    p.nombre.toLowerCase().includes(texto) ||

                    p.modelo.toLowerCase().includes(texto);

                return categoriaOk && textoOk;

            });

        UI.mostrar(filtrados);

    },

    exportar: function(){

        let productos =
            Storage.obtener();

        let csv =
`Nombre,Modelo,Categoria,Precio,Stock\n`;

        productos.forEach(p=>{

            csv +=
`${p.nombre},${p.modelo},${p.categoria},${p.precio},${p.stock}\n`;

        });

        let blob =
            new Blob([csv]);

        let a =
            document.createElement("a");

        a.href =
            URL.createObjectURL(blob);

        a.download =
            "inventario.csv";

        a.click();

    },

    exportarAgotados: function(){

        let productos =
            Storage.obtener();

        let agotados =
            productos.filter(
                p => p.stock <= 1
            );

        let csv =
`Nombre,Modelo,Categoria,Precio,Stock\n`;

        agotados.forEach(p=>{

            csv +=
`${p.nombre},${p.modelo},${p.categoria},${p.precio},${p.stock}\n`;

        });

        let blob =
            new Blob([csv]);

        let a =
            document.createElement("a");

        a.href =
            URL.createObjectURL(blob);

        a.download =
            "agotados.csv";

        a.click();

    },

    importar: function(event){

        let archivo =
            event.target.files[0];

        let lector =
            new FileReader();

        lector.onload = function(e){

            let lineas =
                e.target.result.split("\n");

            let productos =
                Storage.obtener();

            lineas.slice(1).forEach(linea=>{

                let datos =
                    linea.split(",");

                if(datos.length >= 5){

                    productos.push({

                        id: Date.now() + Math.random(),

                        nombre: datos[0],

                        modelo: datos[1],

                        categoria: datos[2],

                        precio: Number(datos[3]),

                        stock: Number(datos[4])

                    });

                }

            });

            Storage.guardar(productos);

            UI.mostrar(productos);

        }

        lector.readAsText(archivo);

    },

    modoOscuro: function(){

        document.body.classList.toggle("dark");

    },

    toggleGrupo: function(nombre){

        let filas =
            document.querySelectorAll(
                `.grupo-${nombre}`
            );

        filas.forEach(fila=>{

            if(
                fila.style.display == "none"
            ){

                fila.style.display =
                    "table-row";

            }else{

                fila.style.display =
                    "none";

            }

        });

    },

    actualizarListaProductos: function(){

        let lista =
            document.getElementById("listaProductos");

        let productos =
            Storage.obtener();

        if(!lista) return;

        lista.innerHTML = "";

        productos.forEach(p=>{

            let item =
                document.createElement("div");

            item.className =
                "item-producto";

            item.innerHTML =

            `<b>${p.nombre}</b> - ${p.modelo}
            <span>Stock: ${p.stock}</span>`;

            item.onclick = function(){

                document.getElementById(
                    "productoVenta"
                ).value =
                `${p.nombre} - ${p.modelo}`;

                document.getElementById(
                    "productoVenta"
                ).dataset.id =
                p.id;

                lista.style.display =
                    "none";

            }

            lista.appendChild(item);

        });

    },

    buscarProductoVenta: function(){

        let texto =
            document.getElementById(
                "productoVenta"
            )
            .value
            .toLowerCase();

        let lista =
            document.getElementById(
                "listaProductos"
            );

        let productos =
            Storage.obtener();

        let filtrados =
            productos.filter(p=>{

                return(

                    p.nombre
                    .toLowerCase()
                    .includes(texto)

                    ||

                    p.modelo
                    .toLowerCase()
                    .includes(texto)

                )

            });

        lista.innerHTML = "";

        filtrados.forEach(p=>{

            let item =
                document.createElement("div");

            item.className =
                "item-producto";

            item.innerHTML =
            `<b>${p.nombre}</b> - ${p.modelo}`;

            item.onclick = function(){

                document.getElementById(
                    "productoVenta"
                ).value =
                `${p.nombre} - ${p.modelo}`;

                document.getElementById(
                    "productoVenta"
                ).dataset.id =
                p.id;

                lista.style.display =
                    "none";

            }

            lista.appendChild(item);

        });

    },

    vender: function(){

        Swal.fire({
            icon:"success",
            title:"Venta realizada"
        });

    },

    editarVenta: function(index){

        Swal.fire({
            icon:"info",
            title:"Editar venta"
        });

    },

    eliminarVenta: function(index){

        Swal.fire({
            icon:"success",
            title:"Venta eliminada"
        });

    },

    buscarVentaFecha: function(){

        UI.mostrarVentas(
            Storage.obtenerVentas()
        );

    },

    generarPDF: function(){

        Swal.fire({
            icon:"success",
            title:"PDF generado"
        });

    }

};

window.App.iniciar();