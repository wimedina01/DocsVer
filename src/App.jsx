import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ChecklistPage from './pages/ChecklistPage';
import QuickPrintPage from './pages/QuickPrintPage';
import AdminPage from './pages/AdminPage';
import StationMatrixPage from './pages/StationMatrixPage';
import HistoryPage from './pages/HistoryPage';
import PasswordGate from './components/PasswordGate';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/united-cargo-logo.png" alt="United Cargo" style={{ height: 38 }} />
            <div>
              <div className="app-header__title">HR Document Verification</div>
              <div className="app-header__subtitle">Human Remains Checklist System</div>
            </div>
          </div>
          <nav className="app-header__nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              Checklist
            </NavLink>
            <NavLink to="/quick-print" className={({ isActive }) => isActive ? 'active' : ''}>
              Quick Print
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>
              History
            </NavLink>
            <NavLink to="/station-matrix" className={({ isActive }) => isActive ? 'active' : ''}>
              Station Matrix
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
              Admin
            </NavLink>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<ChecklistPage />} />
            <Route path="/quick-print" element={<QuickPrintPage />} />
            <Route path="/history" element={<PasswordGate><HistoryPage /></PasswordGate>} />
            <Route path="/station-matrix" element={<PasswordGate><StationMatrixPage /></PasswordGate>} />
            <Route path="/admin" element={<PasswordGate><AdminPage /></PasswordGate>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
