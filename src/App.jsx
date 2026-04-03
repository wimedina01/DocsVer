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
  const { homeStation, setHomeStation, pendingStation, setPendingStation, resetStation, hasUnsavedChange, darkMode, setDarkMode, configuredStations } = useStation();

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
            <NavLink to="/station-management" className={({ isActive }) => isActive ? 'active' : ''}>Station Management</NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>
          </nav>
        </header>

        <div className="station-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>HOME STATION:</label>
            <select
              value={hasUnsavedChange ? pendingStation : homeStation}
              onChange={e => setPendingStation(e.target.value)}
              style={{ width: 200, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-default)', fontSize: 13, fontWeight: 600, background: 'var(--surface-card)', color: 'var(--text-primary)' }}
            >
              <option value="">— Select Station —</option>
              {configuredStations.map(c => (
                <option key={c} value={c}>{c} — {getAirportShort(c)}</option>
              ))}
            </select>
            {hasUnsavedChange && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setHomeStation(pendingStation)} className="btn btn--primary btn--sm" style={{ padding: '4px 12px', fontSize: 11 }}>Save</button>
                <button onClick={resetStation} className="btn btn--outline btn--sm" style={{ padding: '4px 12px', fontSize: 11 }}>Reset</button>
              </div>
            )}
            {homeStation && !hasUnsavedChange && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getAirportShort(homeStation)}</span>
            )}
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
            <Route path="/station-management" element={<PasswordGate><StationMatrixPage /></PasswordGate>} />
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
