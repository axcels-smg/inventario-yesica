  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBZX2IoQDD-iWNzZ5XydL68aE1dZHyfsm4",
    authDomain: "inventario-yesica-db01c.firebaseapp.com",
    projectId: "inventario-yesica-db01c",
    storageBucket: "inventario-yesica-db01c.firebasestorage.app",
    messagingSenderId: "461672703245",
    appId: "1:461672703245:web:0c4e577c1fa21f75577c44"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
const App = {
    
    iniciar: function(){

        UI.mostrar(Storage.obtener());

        UI.mostrarVentas(
            Storage.obtenerVentas()
        );

        App.actualizarListaProductos();

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

        App.actualizarListaProductos();

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

        Swal.fire({

            title:"¿Eliminar producto?",

            text:"No podrás recuperarlo",

            icon:"warning",

            showCancelButton:true,

            confirmButtonText:"Sí, eliminar"

        }).then((result)=>{

            if(result.isConfirmed){

                let productos =
                    Storage.obtener();

                productos.splice(index,1);

                Storage.guardar(productos);

                UI.mostrar(productos);

                App.actualizarListaProductos();

                Swal.fire({
                    icon:"success",
                    title:"Eliminado"
                });

            }

        });

    },

    editar: function(index){

        let productos =
            Storage.obtener();

        let p = productos[index];

        Swal.fire({

            title:'Editar producto',

            html:`

            <input id="swalNombre"
            class="swal2-input"
            value="${p.nombre}">

            <input id="swalModelo"
            class="swal2-input"
            value="${p.modelo}">

            <input id="swalPrecio"
            type="number"
            class="swal2-input"
            value="${p.precio}">

            <input id="swalStock"
            type="number"
            class="swal2-input"
            value="${p.stock}">
            `,

            showCancelButton:true,

            confirmButtonText:'Guardar',

            preConfirm:()=>{

                return{

                    nombre:
                    document.getElementById("swalNombre").value,

                    modelo:
                    document.getElementById("swalModelo").value,

                    precio:
                    document.getElementById("swalPrecio").value,

                    stock:
                    document.getElementById("swalStock").value

                }

            }

        }).then((result)=>{

            if(result.isConfirmed){

                productos[index] = {

                    ...p,

                    nombre: result.value.nombre,

                    modelo: result.value.modelo,

                    precio: Number(result.value.precio),

                    stock: Number(result.value.stock)

                };

                Storage.guardar(productos);

                UI.mostrar(productos);

                App.actualizarListaProductos();

                Swal.fire({
                    icon:"success",
                    title:"Actualizado"
                });

            }

        });

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

            App.actualizarListaProductos();

            Swal.fire({
                icon:"success",
                title:"Importado"
            });

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

        lista.style.display =
            texto == "" ? "none":"block";

    },

    vender: function(){

        let cliente =
            document.getElementById("cliente").value;

        let cantidad =
            Number(
                document.getElementById("cantidadVenta").value
            );

        let productoId =
            Number(
                document.getElementById("productoVenta")
                .dataset.id
            );

        if(
            cliente == "" ||
            !productoId ||
            cantidad <= 0
        ){

            Swal.fire({
                icon:"warning",
                title:"Completa los datos"
            });

            return;

        }

        let productos =
            Storage.obtener();

        let producto =
            productos.find(
                p=>p.id == productoId
            );

        if(producto.stock < cantidad){

            Swal.fire({
                icon:"error",
                title:"Stock insuficiente"
            });

            return;

        }

        producto.stock -= cantidad;

        let ventas =
            Storage.obtenerVentas();

        let fecha =
            new Date();

ventas.push({

    cliente,

    producto:
    `${producto.nombre} - ${producto.modelo}`,

    categoria:
    producto.categoria,

    cantidad,

    total:
    producto.precio * cantidad,

    fecha:
    fecha.toLocaleDateString(),

    hora:
    fecha.toLocaleTimeString(),

    productoId:
    producto.id

});

        Storage.guardar(productos);

        Storage.guardarVentas(ventas);

        UI.mostrar(productos);

        UI.mostrarVentas(ventas);

        App.actualizarListaProductos();

        Swal.fire({
            icon:"success",
            title:"Venta realizada"
        });

        document.getElementById("cliente").value="";
        document.getElementById("productoVenta").value="";
        document.getElementById("cantidadVenta").value="";

    },

    editarVenta: function(index){

        let ventas =
            Storage.obtenerVentas();

        let v = ventas[index];

        Swal.fire({

            title:"Editar venta",

            html:`

            <input
            id="editarCliente"
            class="swal2-input"
            value="${v.cliente}"
            >

            <input
            id="editarCantidad"
            type="number"
            class="swal2-input"
            value="${v.cantidad}"
            >

            `,

            showCancelButton:true,

            confirmButtonText:"Guardar",

            preConfirm:()=>{

                v.cliente =
                document.getElementById(
                    "editarCliente"
                ).value;

                v.cantidad =
                Number(
                    document.getElementById(
                        "editarCantidad"
                    ).value
                );

                Storage.guardarVentas(ventas);

                UI.mostrarVentas(ventas);

                Swal.fire({
                    icon:"success",
                    title:"Venta actualizada"
                });

            }

        });

    },

eliminarVenta: function(index){

    Swal.fire({

        title:"¿Eliminar venta?",

        text:"El stock volverá al inventario",

        icon:"warning",

        showCancelButton:true,

        confirmButtonText:"Eliminar"

    }).then((result)=>{

        if(result.isConfirmed){

            let ventas =
                Storage.obtenerVentas();

            let productos =
                Storage.obtener();

            let venta =
                ventas[index];

            // BUSCAR PRODUCTO
            let producto =
                productos.find(p =>

                    `${p.nombre} - ${p.modelo}`
                    == venta.producto

                );

            // DEVOLVER STOCK
            if(producto){

                producto.stock +=
                    Number(venta.cantidad);

            }

            // ELIMINAR VENTA
            ventas.splice(index,1);

            // GUARDAR
            Storage.guardar(productos);

            Storage.guardarVentas(ventas);

            // ACTUALIZAR
            UI.mostrar(productos);

            UI.mostrarVentas(ventas);

            App.actualizarListaProductos();

            Swal.fire({
                icon:"success",
                title:"Venta eliminada y stock restaurado"
            });

        }

    });

},

    buscarVentaFecha: function(){

    let fecha =
        document.getElementById(
            "buscarFecha"
        ).value;

    let texto =
        document.getElementById(
            "buscarVentaNombre"
        ).value
        .toLowerCase();

    let categoria =
        document.getElementById(
            "buscarVentaCategoria"
        ).value;

    let ventas =
        Storage.obtenerVentas();

    let filtradas =
        ventas.filter(v=>{

        let coincideFecha =

            fecha == "" ||

            v.fecha ==
            new Date(fecha)
            .toLocaleDateString();

        let coincideNombre =

            v.cliente
            .toLowerCase()
            .includes(texto);

        let coincideCategoria =

            categoria == "" ||

            v.categoria == categoria;

        return coincideFecha &&
               coincideNombre &&
               coincideCategoria;

    });

    UI.mostrarVentas(filtradas);

},

generarPDF: function(){

    let fecha =
        document.getElementById("pdfFecha").value;

    let clienteBuscar =
        document.getElementById("pdfCliente")
        .value
        .toLowerCase();

    let ventas =
        Storage.obtenerVentas();

    let filtradas =
        ventas.filter(v=>{

        let coincideFecha =

            fecha == "" ||

            v.fecha ==
            new Date(fecha)
            .toLocaleDateString();

        let coincideCliente =

            clienteBuscar == "" ||

            v.cliente
            .toLowerCase()
            .includes(clienteBuscar);

        return coincideFecha &&
               coincideCliente;

    });

    if(filtradas.length == 0){

        Swal.fire({
            icon:"warning",
            title:"No hay ventas"
        });

        return;

    }

    const { jsPDF } = window.jspdf;

    let doc = new jsPDF();

    // AGRUPAR POR CLIENTE
    let agrupadas = {};

    filtradas.forEach(v=>{

        if(!agrupadas[v.cliente]){

            agrupadas[v.cliente] = [];

        }

        agrupadas[v.cliente].push(v);

    });

    let primeraPagina = true;

    for(let cliente in agrupadas){

        if(!primeraPagina){

            doc.addPage();

        }

        primeraPagina = false;

        let ventasCliente =
            agrupadas[cliente];

        let totalCliente = 0;

        let y = 20;

        // ===== HEADER =====

        doc.setFillColor(25,118,210);

        doc.rect(0,0,220,35,"F");

        doc.setTextColor(255,255,255);

        doc.setFontSize(24);

        doc.text(
            "YESICA STORE",
            20,
            20
        );

        doc.setFontSize(11);

        doc.text(
            "Repuestos y accesorios para celulares",
            20,
            28
        );

        doc.setFontSize(10);

        doc.text(
            "Celular: 927 639 736",
            150,
            20
        );

        doc.text(
            "Arequipa - Peru",
            150,
            28
        );

        // ===== TITULO =====

        y = 50;

        doc.setTextColor(0,0,0);

        doc.setFontSize(20);

        doc.text(
            "NOTA DE VENTA",
            65,
            y
        );

        y += 15;

        // ===== DATOS =====

        doc.setFontSize(12);

        doc.text(
            `Cliente: ${cliente}`,
            20,
            y
        );

        y += 8;

        doc.text(
            `Fecha: ${ventasCliente[0].fecha}`,
            20,
            y
        );

        y += 8;

        doc.text(
            `Hora: ${ventasCliente[0].hora}`,
            20,
            y
        );

        y += 15;

        // ===== TABLA HEADER =====

        doc.setFillColor(25,118,210);

        doc.rect(20,y,170,10,"F");

        doc.setTextColor(255,255,255);

        doc.setFontSize(11);

        doc.text("Producto",25,y+7);

        doc.text("Cant.",110,y+7);

        doc.text("P.Unit",135,y+7);

        doc.text("Total",165,y+7);

        y += 15;

        // ===== PRODUCTOS =====

        doc.setTextColor(0,0,0);

        ventasCliente.forEach(v=>{

            let precioUnitario =
                v.total / v.cantidad;

            doc.setFontSize(11);

            doc.text(
                v.producto,
                25,
                y
            );

doc.text(
    `${v.producto} (${v.categoria})`,
    25,
    y
);

            doc.text(
                String(v.cantidad),
                112,
                y
            );

            doc.text(
                "$" + precioUnitario,
                135,
                y
            );

            doc.text(
                "$" + v.total,
                165,
                y
            );

            y += 10;

            // LINEA
            doc.setDrawColor(220);

            doc.line(20,y-4,190,y-4);

            totalCliente += v.total;

        });

        y += 10;

        // ===== TOTAL =====

        doc.setFillColor(240,240,240);

        doc.rect(120,y,70,15,"F");

        doc.setFontSize(15);

        doc.setTextColor(0,0,0);

        doc.text(
            `TOTAL: $${totalCliente}`,
            130,
            y+10
        );

        y += 30;

        // ===== FOOTER =====

        doc.setFontSize(11);

        doc.text(
            "Gracias por confiar en YESICA STORE",
            48,
            y
        );

        y += 8;

        doc.text(
            "Garantia en todos nuestros productos",
            58,
            y
        );

    }

    doc.save("Boleta-Venta.pdf");

},


exportarAgotados: function(){

    let productos =
        Storage.obtener();

    // STOCK BAJO O AGOTADO
    let agotados =
        productos.filter(p => p.stock <= 1);

    if(agotados.length == 0){

        Swal.fire({
            icon:"info",
            title:"No hay productos agotados"
        });

        return;

    }

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
        "productos-agotados.csv";

    a.click();

}
}



App.iniciar();