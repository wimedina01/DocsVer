import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { StationProvider, useStation } from './lib/StationContext';
import { getAirportShort } from './lib/airportCodes';
import ChecklistPage from './pages/ChecklistPage';
import QuickPrintPage from './pages/QuickPrintPage';
import AdminPage from './pages/AdminPage';
import StationMatrixPage from './pages/StationMatrixPage';
import HistoryPage from './pages/HistoryPage';
import SupervisorPage from './pages/SupervisorPage';
import PasswordGate from './components/PasswordGate';

function AppInner() {
  const { homeStation, setHomeStation, darkMode, setDarkMode } = useStation();

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/united-cargo-logo.png" alt="United Cargo" style={{ height: 36 }} />
            <div>
              <div className="app-header__title">HR Document Verification</div>
              <div className="app-header__subtitle">Human Remains Checklist System</div>
            </div>
          </div>
          <nav className="app-header__nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Checklist</NavLink>
            <NavLink to="/quick-print" className={({ isActive }) => isActive ? 'active' : ''}>Quick Print</NavLink>
            <NavLink to="/supervisor" className={({ isActive }) => isActive ? 'active' : ''}>Supervisor</NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'active' : ''}>History</NavLink>
            <NavLink to="/station-matrix" className={({ isActive }) => isActive ? 'active' : ''}>Matrix</NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>
          </nav>
        </header>

        {/* Station selector bar */}
        <div className="station-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>HOME STATION:</label>
            <input type="text" value={homeStation} onChange={e => setHomeStation(e.target.value.toUpperCase())}
              placeholder="e.g. IAH" maxLength={3}
              style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 13, fontWeight: 700, textAlign: 'center', background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
            {homeStation && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getAirportShort(homeStation)}</span>}
          </div>
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
            {darkMode ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<ChecklistPage />} />
            <Route path="/quick-print" element={<QuickPrintPage />} />
            <Route path="/supervisor" element={<SupervisorPage />} />
            <Route path="/history" element={<PasswordGate><HistoryPage /></PasswordGate>} />
            <Route path="/station-matrix" element={<PasswordGate><StationMatrixPage /></PasswordGate>} />
            <Route path="/admin" element={<PasswordGate><AdminPage /></PasswordGate>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return <StationProvider><AppInner /></StationProvider>;
}
