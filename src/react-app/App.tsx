import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Home } from "./pages/Home";
import { NewSession } from "./pages/NewSession";
import { SessionPage } from "./pages/SessionPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="brand-header">
          <Link to="/" style={{ textDecoration: "none" }}>
            <span className="logo">forkdis</span>
          </Link>
        </div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewSession />} />
          <Route path="/s/:code" element={<SessionPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
