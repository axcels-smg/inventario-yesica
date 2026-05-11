// =========================
// storage.js COMPLETO
// =========================

const Storage = {

    obtener: function(){

        return JSON.parse(
            localStorage.getItem("productos")
        ) || [];

    },

    guardar: function(productos){

        localStorage.setItem(
            "productos",
            JSON.stringify(productos)
        );

    },

    obtenerVentas: function(){

        return JSON.parse(
            localStorage.getItem("ventas")
        ) || [];

    },

    guardarVentas: function(ventas){

        localStorage.setItem(
            "ventas",
            JSON.stringify(ventas)
        );

    }

}