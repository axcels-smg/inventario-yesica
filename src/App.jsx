import { BrowserRouter, Routes, Route } from "react-router-dom"

import Dashboard from "./pages/Dashboard"
import DashboardGlobal from "./pages/DashboardGlobal"
import Productos from "./pages/Productos"
import Ventas from "./pages/Ventas"
import Clientes from "./pages/Clientes"
import Reportes from "./pages/Reportes"
import HistorialVentas from "./pages/HistorialVentas"
import Movimientos from "./pages/Movimientos"
import InventarioExcel from "./pages/InventarioExcel"
import Tiendas from "./pages/Tiendas"
import Transferencias from "./pages/Transferencias"

import MainLayout from "./layout/MainLayout"
import { TiendaProvider } from "./context/TiendaContext"
import { RolProvider } from "./context/RolContext"

function App() {
  return (
    <RolProvider>
      <TiendaProvider>
      <BrowserRouter>
        <Routes>

          {/* LAYOUT PRINCIPAL */}
          <Route path="/" element={<MainLayout />}>
            
            {/* DASHBOARD */}
            <Route index element={<Dashboard />} />
            <Route path="global" element={<DashboardGlobal />} />

            {/* PRODUCTOS */}
            <Route path="productos" element={<Productos />} />

            {/* VENTAS */}
            <Route path="ventas" element={<Ventas />} />

            {/* CLIENTES */}
            <Route path="clientes" element={<Clientes />} />

            {/* REPORTES */}
            <Route path="reportes" element={<Reportes />} />

            {/* HISTORIAL */}
            <Route path="historial" element={<HistorialVentas />} />

            <Route path="movimientos" element={<Movimientos />} />
            <Route path="excel" element={<InventarioExcel />} />
            <Route path="tiendas" element={<Tiendas />} />
            <Route path="transferencias" element={<Transferencias />} />

          </Route>

        </Routes>
      </BrowserRouter>
      </TiendaProvider>
    </RolProvider>
  )
}

export default App