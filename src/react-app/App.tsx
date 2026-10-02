import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, Outlet } from "react-router-dom";
import { Home } from "./pages/Home";
import { NewSession } from "./pages/NewSession";
import { SessionPage } from "./pages/SessionPage";

// Standalone prototype; lazy so MapLibre isn't in the main bundle
const PostcardPage = lazy(() => import("./pages/PostcardPage").then((m) => ({ default: m.PostcardPage })));

function Shell() {
  return (
    <div className="app-shell">
      <div className="brand-header">
        <Link to="/" style={{ textDecoration: "none" }}>
          <span className="logo">forkdis</span>
        </Link>
      </div>
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewSession />} />
          <Route path="/s/:code" element={<SessionPage />} />
        </Route>
        <Route
          path="/postcard"
          element={
            <Suspense fallback={null}>
              <PostcardPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
