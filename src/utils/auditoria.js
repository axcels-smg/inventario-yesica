import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"

export async function registrarAuditoria({
  accion,
  coleccion,
  documentoId,
  antes,
  despues,
  usuario = "usuario",
  tiendaId = "",
}) {
  try {
    await addDoc(collection(db, "auditoria"), {
      accion,
      coleccion,
      documentoId,
      antes: antes ? JSON.stringify(antes) : null,
      despues: despues ? JSON.stringify(despues) : null,
      usuario,
      tiendaId,
      fecha: serverTimestamp(),
      fechaTexto: new Date().toLocaleString("es-PE"),
    })
  } catch (error) {
    console.error("Error registrando auditoría:", error)
  }
}

export async function obtenerHistorialAuditoria({
  coleccion = "",
  documentoId = "",
  tiendaId = "",
  limite = 100,
}) {
  try {
    const condiciones = []
    if (coleccion) condiciones.push(where("coleccion", "==", coleccion))
    if (documentoId) condiciones.push(where("documentoId", "==", documentoId))
    if (tiendaId) condiciones.push(where("tiendaId", "==", tiendaId))

    const q = condiciones.length > 0
      ? query(collection(db, "auditoria"), ...condiciones)
      : collection(db, "auditoria")

    const snap = await getDocs(q)
    const lista = []
    snap.forEach((docu) => {
      lista.push({ id: docu.id, ...docu.data() })
    })

    return lista.slice(0, limite)
  } catch (error) {
    console.error("Error obteniendo historial de auditoría:", error)
    return []
  }
}
