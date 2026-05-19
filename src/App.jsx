import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom"

import Dashboard from "./pages/Dashboard"
import Productos from "./pages/Productos"
import Ventas from "./pages/Ventas"
import Clientes from "./pages/Clientes"
import Reportes from "./pages/Reportes"
import HistorialVentas from "./pages/HistorialVentas"

import MainLayout from "./layout/MainLayout"

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* LAYOUT */}
        <Route
          path="/"
          element={<MainLayout />}
        >

          {/* DASHBOARD */}
          <Route
            index
            element={<Dashboard />}
          />

          {/* PRODUCTOS */}
          <Route
            path="productos"
            element={<Productos />}
          />

          {/* VENTAS */}
          <Route
            path="ventas"
            element={<Ventas />}
          />

          {/* CLIENTES */}
          <Route
            path="clientes"
            element={<Clientes />}
          />

          {/* REPORTES */}
          <Route
            path="reportes"
            element={<Reportes />}
          />

          {/* HISTORIAL */}
          <Route
            path="historial"
            element={<HistorialVentas />}
          />

        </Route>

      </Routes>

    </BrowserRouter>
  )
}

export default App