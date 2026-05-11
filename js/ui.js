// =========================
// ui.js COMPLETO
// =========================

const UI = {

mostrar: function(productos){

    let tabla =
        document.getElementById("tabla");

    tabla.innerHTML = "";

    let total = 0;

    let grupos = {};

    // AGRUPAR POR NOMBRE + CATEGORIA
    productos.forEach((p,index)=>{

        total += p.precio * p.stock;

        let clave =
            `${p.nombre}-${p.categoria}`;

        if(!grupos[clave]){

            grupos[clave] = [];

        }

        grupos[clave].push({
            ...p,
            index:index
        });

    });

    // CREAR TABLA
    Object.keys(grupos).forEach(clave=>{

        let lista = grupos[clave];

        let nombre =
            lista[0].nombre;

        let categoria =
            lista[0].categoria;

        // CLASE SEGURA
        let clase =
            clave.replace(/\s+/g,'-');

        tabla.innerHTML += `

        <tr class="fila-grupo"
        onclick="App.toggleGrupo('${clase}')">

            <td colspan="6"
            style="
            background:#1976f2;
            color:white;
            font-weight:bold;
            cursor:pointer;
            ">

            ▶ ${nombre} ${categoria}
            (${lista.length} modelos)

            </td>

        </tr>

        `;

        lista.forEach(p=>{

            tabla.innerHTML += `

            <tr
            class="grupo-${clase}"
            style="display:none;"
            >

            <td>${p.nombre}</td>

            <td>${p.modelo}</td>

            <td>${p.categoria}</td>

            <td>$${p.precio}</td>

            <td class="${
                p.stock <= 1
                ? 'stock-bajo'
                : ''
            }">

            ${
                p.stock <= 1
                ? '⚠️ '
                : ''
            }

            ${p.stock}

            </td>

            <td>

            <button onclick="App.editar(${p.index})">
            ✏️
            </button>

            <button onclick="App.eliminar(${p.index})">
            ❌
            </button>

            </td>

            </tr>

            `;

        });

    });

    document.getElementById("total")
    .innerText = total;

},

    mostrarVentas: function(ventas){

        let tabla =
            document.getElementById("tablaVentas");

        tabla.innerHTML = "";

        ventas.forEach((v,index)=>{

            tabla.innerHTML += `

            <tr>

            <td>${v.cliente}</td>

            <td>${v.producto}</td>

            <td>${v.categoria || '-'}</td>

            <td>${v.cantidad}</td>

            <td>$${v.total}</td>

            <td>${v.fecha}</td>

            <td>${v.hora}</td>

            <td>

            <button onclick="App.editarVenta(${index})">
            ✏️
            </button>

            <button onclick="App.eliminarVenta(${index})">
            ❌
            </button>

            </td>

            </tr>

            `;

        });

    }

}