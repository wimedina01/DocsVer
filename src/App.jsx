import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ChecklistPage from './pages/ChecklistPage';
import QuickPrintPage from './pages/QuickPrintPage';
import AdminPage from './pages/AdminPage';
import HistoryPage from './pages/HistoryPage';
import PasswordGate from './components/PasswordGate';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div>
            <div className="app-header__title">United Cargo — HR Document Verification</div>
            <div className="app-header__subtitle">Human Remains Checklist System</div>
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
            <Route path="/admin" element={<PasswordGate><AdminPage /></PasswordGate>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
