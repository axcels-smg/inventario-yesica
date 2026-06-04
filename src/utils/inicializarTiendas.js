import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "../firebase"

export async function inicializarTiendas() {
  const tiendasEjemplo = [
    {
      id: "tienda_central",
      nombre: "Tienda Central",
      direccion: "Av. Principal 123, Lima",
      ruc: "20600000001",
      telefono: "+51 999 888 777",
      email: "central@inventariogrl.com",
      activo: true,
    },
    {
      id: "tienda_norte",
      nombre: "Tienda Norte",
      direccion: "Jr. Los Olivos 456, Lima",
      ruc: "20600000002",
      telefono: "+51 999 777 666",
      email: "norte@inventariogrl.com",
      activo: true,
    },
    {
      id: "tienda_sur",
      nombre: "Tienda Sur",
      direccion: "Av. Sur 789, Lima",
      ruc: "20600000003",
      telefono: "+51 999 666 555",
      email: "sur@inventariogrl.com",
      activo: true,
    },
  ]

  try {
    for (const tienda of tiendasEjemplo) {
      const docRef = doc(db, "Tienda", tienda.id)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        await setDoc(docRef, tienda)
        console.log(`Tienda creada: ${tienda.nombre}`)
      } else {
        console.log(`Tienda ya existe: ${tienda.nombre}`)
      }
    }

    console.log("Inicialización de tiendas completada")
    return true
  } catch (error) {
    console.error("Error inicializando tiendas:", error)
    return false
  }
}
