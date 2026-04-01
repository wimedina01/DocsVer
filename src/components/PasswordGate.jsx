import React, { useState } from 'react';

const ADMIN_PASSWORD = 'admin';

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (unlocked) return children;

  return (
    <div className="card" style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔒</div>
      <h2 className="card__header" style={{ borderBottom: 'none', marginBottom: 8 }}>
        Password Required
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
        Enter the admin password to access this page.
      </p>

      {error && <div className="alert alert--warning">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          className="form-input"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{ marginBottom: 16, textAlign: 'center' }}
        />
        <div>
          <button type="submit" className="btn btn--primary" style={{ width: '100%' }}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}
