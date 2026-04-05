import React, { useState, useRef, useEffect } from 'react';
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

function StationInput() {
  const { homeStation, setHomeStation, configuredStations } = useStation();
  const [input, setInput] = useState(homeStation);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setInput(homeStation); }, [homeStation]);

  const filtered = configuredStations.filter(c =>
    !input || c.includes(input.toUpperCase()) || getAirportShort(c).toUpperCase().includes(input.toUpperCase())
  ).slice(0, 8);

  const hasChange = input.toUpperCase().trim() !== homeStation;

  const handleSave = () => { setHomeStation(input); setShowSuggestions(false); };
  const handleReset = () => { setInput(homeStation); setShowSuggestions(false); };
  const handleSelect = (code) => { setInput(code); setHomeStation(code); setShowSuggestions(false); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, position: 'relative' }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>HOME STATION:</label>
      <div style={{ position: 'relative' }}>
        <input type="text" value={input} maxLength={3}
          onChange={e => { setInput(e.target.value.toUpperCase()); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Type code..."
          style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', fontSize: 14, fontWeight: 700, textAlign: 'center', background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
        {showSuggestions && filtered.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'var(--surface-card)', border: '1px solid var(--medium-tonal-grey)', borderRadius: 8, boxShadow: 'var(--shadow-3)', maxHeight: 200, overflowY: 'auto', minWidth: 240, marginTop: 2 }}>
            {filtered.map(c => (
              <div key={c} onClick={() => handleSelect(c)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--medium-tonal-grey-50)' }}
                onMouseEnter={e => e.target.style.background = 'var(--medium-tonal-grey-50)'}
                onMouseLeave={e => e.target.style.background = 'transparent'}>
                <strong>{c}</strong> — {getAirportShort(c)}
              </div>
            ))}
          </div>
        )}
      </div>
      {homeStation && !hasChange && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getAirportShort(homeStation)}</span>}
      {hasChange && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSave} className="btn btn--primary btn--sm" style={{ padding: '3px 10px', fontSize: 11 }}>Save</button>
          <button onClick={handleReset} className="btn btn--outline btn--sm" style={{ padding: '3px 10px', fontSize: 11 }}>Reset</button>
        </div>
      )}
    </div>
  );
}

function AppInner() {
  const { darkMode, setDarkMode } = useStation();

  return (
    <BrowserRouter>
      <div className="app-shell" onClick={() => {}}>
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
          <StationInput />
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

export default function App() { return <StationProvider><AppInner /></StationProvider>; }
