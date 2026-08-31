import { NavLink, Route, Routes } from "react-router-dom";

import { t } from "./i18n/strings";
import FleetOverviewPage from "./pages/FleetOverviewPage";
import SiteDetailPage from "./pages/SiteDetailPage";
import AlertsFeedPage from "./pages/AlertsFeedPage";
import FeedHealthPage from "./pages/FeedHealthPage";

export default function App() {
  return (
    <div className="layout">
      <header className="top-nav">
        <div>
          <h1>{t.app.title}</h1>
          <p className="tagline">{t.app.tagline}</p>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.overview}
          </NavLink>
          <NavLink to="/alarmer" className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.alerts}
          </NavLink>
          <NavLink to="/feeds" className={({ isActive }) => (isActive ? "active" : "")}>
            {t.nav.feedHealth}
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<FleetOverviewPage />} />
        <Route path="/anlaeg/:siteId" element={<SiteDetailPage />} />
        <Route path="/alarmer" element={<AlertsFeedPage />} />
        <Route path="/feeds" element={<FeedHealthPage />} />
      </Routes>
    </div>
  );
}
