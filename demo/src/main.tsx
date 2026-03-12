import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { HashRouter, Route, Routes } from "react-router-dom"
import "./index.css"
import { App } from "./App"
import { Home } from "./pages/Home"
import { Viewer } from "./pages/Viewer"

const rootElement = document.getElementById("root")
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <HashRouter>
        <App>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/viewer" element={<Viewer />} />
          </Routes>
        </App>
      </HashRouter>
    </StrictMode>,
  )
}
