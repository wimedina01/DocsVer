import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAirportShort, getAirportDisplay } from '../lib/airportCodes';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const STATUS_SHORT = { 'Required': 'REQ', 'Required - Copies OK': 'COPIES', 'Not Required': 'N/A' };
const STATUS_COLORS = {
  'Required': { bg: '#FFE6DC', color: '#D50032', border: '#D50032' },
  'Required - Copies OK': { bg: '#FFF0D7', color: '#996B00', border: '#FFC658' },
  'Not Required': { bg: '#DCFAE6', color: '#1B7742', border: '#1B7742' },
};

export default function StationMatrixPage() {
  const [requirements, setRequirements] = useState([]);
  const [airportReqs, setAirportReqs] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Search & filter
  const [searchDoc, setSearchDoc] = useState('');
  const [searchStation, setSearchStation] = useState('');

  // Add station
  const [newAirport, setNewAirport] = useState('');

  // Edit popup
  const [editCell, setEditCell] = useState(null); // { reqId, code, x, y }

  // Custom doc form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDoc, setCustomDoc] = useState({ airport_code: '', document_name: '', custom_note: '', status: 'Required' });

  // User ID for tracking — ALWAYS prompt on page load
  const [userId, setUserId] = useState('');
  const [showUserPrompt, setShowUserPrompt] = useState(true); // always show on mount
  const [userIdInput, setUserIdInput] = useState(() => localStorage.getItem('hr_matrix_user') || ''); // pre-fill from last session

  const scrollRef = useRef(null);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  // ── Load Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      const { data: airReqs } = await supabase.from('airport_requirements').select('*');
      setRequirements(reqs || []);
      setAirportReqs(airReqs || []);
      const codes = [...new Set((airReqs || []).map(a => a.airport_code))].sort();
      setAirports(codes);
    } catch (err) {
      flash('warning', 'Failed to load: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  // ── Ensure user ID — blocks action if not set ──
  const ensureUser = () => {
    if (userId) return true;
    setShowUserPrompt(true);
    return false;
  };

  const saveUserId = (id) => {
    if (!id.trim()) return;
    const clean = id.trim().toUpperCase();
    setUserId(clean);
    localStorage.setItem('hr_matrix_user', clean);
    setShowUserPrompt(false);
    setUserIdInput('');
  };

  // ── Helpers ──
  const getReq = (reqId, code) => airportReqs.find(a => a.requirement_id === reqId && a.airport_code === code);
  const getStatus = (reqId, code) => getReq(reqId, code)?.status || 'Required';
  const getNote = (reqId, code) => getReq(reqId, code)?.custom_note || '';
  const getUpdatedAt = (reqId, code) => getReq(reqId, code)?.updated_at || '';
  const getUpdatedBy = (reqId, code) => getReq(reqId, code)?.updated_by || '';

  // ── Update Status ──
  const handleUpdateStatus = async (reqId, code, newStatus) => {
    if (!ensureUser()) return;
    const now = new Date().toISOString();
    try {
      const existing = getReq(reqId, code);
      if (existing) {
        await supabase.from('airport_requirements').update({
          status: newStatus, updated_at: now, updated_by: userId,
        }).eq('id', existing.id);
      } else {
        await supabase.from('airport_requirements').insert({
          requirement_id: reqId, airport_code: code, status: newStatus,
          custom_note: '', updated_at: now, updated_by: userId,
        });
      }
      // Optimistic update
      setAirportReqs(prev => {
        const idx = prev.findIndex(a => a.requirement_id === reqId && a.airport_code === code);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: newStatus, updated_at: now, updated_by: userId };
          return updated;
        }
        return [...prev, { requirement_id: reqId, airport_code: code, status: newStatus, custom_note: '', updated_at: now, updated_by: userId }];
      });
      setEditCell(null);
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Update Note ──
  const handleUpdateNote = async (reqId, code, note) => {
    if (!ensureUser()) return;
    const now = new Date().toISOString();
    try {
      const existing = getReq(reqId, code);
      if (existing) {
        await supabase.from('airport_requirements').update({
          custom_note: note, updated_at: now, updated_by: userId,
        }).eq('id', existing.id);
      }
      setAirportReqs(prev => prev.map(a =>
        a.requirement_id === reqId && a.airport_code === code
          ? { ...a, custom_note: note, updated_at: now, updated_by: userId } : a
      ));
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Add Airport ──
  const handleAddAirport = async () => {
    const code = newAirport.toUpperCase().trim();
    if (code.length !== 3) { flash('warning', 'Code must be 3 characters.'); return; }
    if (airports.includes(code)) { flash('warning', `${code} already exists.`); return; }
    try {
      const inserts = requirements.map(r => ({
        requirement_id: r.id, airport_code: code, status: 'Required',
        custom_note: '', updated_by: userId || '', updated_at: new Date().toISOString(),
      }));
      if (inserts.length > 0) await supabase.from('airport_requirements').insert(inserts);
      setNewAirport('');
      flash('success', `${code} — ${getAirportDisplay(code)} added.`);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Delete Airport ──
  const handleDeleteAirport = async (code) => {
    if (!confirm(`Remove all requirements for ${code}? This cannot be undone.`)) return;
    try {
      await supabase.from('airport_requirements').delete().eq('airport_code', code);
      flash('success', `${code} removed.`);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Add Custom Document ──
  const handleAddCustomDoc = async () => {
    if (!customDoc.document_name.trim() || !customDoc.airport_code) {
      flash('warning', 'Fill in station and document name.'); return;
    }
    if (!ensureUser()) return;
    try {
      const maxSort = requirements.reduce((max, r) => Math.max(max, r.sort_order || 0), 0);
      const { data, error } = await supabase.from('requirements_matrix').insert({
        document_name: customDoc.document_name,
        description: customDoc.custom_note || 'Custom requirement',
        applies_to: 'BOTH', sort_order: maxSort + 1, is_active: true,
      }).select().single();
      if (error) throw error;

      await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Not Required' });

      const now = new Date().toISOString();
      const allInserts = airports.map(code => ({
        requirement_id: data.id, airport_code: code,
        status: code === customDoc.airport_code ? customDoc.status : 'Not Required',
        custom_note: code === customDoc.airport_code ? customDoc.custom_note : '',
        updated_by: userId, updated_at: now,
      }));
      if (!airports.includes(customDoc.airport_code)) {
        allInserts.push({
          requirement_id: data.id, airport_code: customDoc.airport_code,
          status: customDoc.status, custom_note: customDoc.custom_note,
          updated_by: userId, updated_at: now,
        });
      }
      await supabase.from('airport_requirements').insert(allInserts);
      setCustomDoc({ airport_code: '', document_name: '', custom_note: '', status: 'Required' });
      setShowCustomForm(false);
      flash('success', `Custom document added for ${customDoc.airport_code}.`);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Filtering ──
  const filteredAirports = airports.filter(code => {
    if (!searchStation) return true;
    const q = searchStation.toUpperCase();
    return code.includes(q) || getAirportShort(code).toUpperCase().includes(q);
  });

  const filteredReqs = requirements.filter(r => {
    if (!searchDoc) return true;
    return r.document_name.toLowerCase().includes(searchDoc.toLowerCase());
  });

  // ── Format time ago ──
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const CELL_W = 110; // fixed cell width for scrolling

  return (
    <>
      {message.text && (
        <div className={`alert alert--${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* User ID prompt modal — CANNOT be dismissed without entering ID */}
      {showUserPrompt && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>
              {userId ? 'Change Your ID' : 'Identification Required'}
            </h3>
            <div className="modal__body">
              <p>
                {userId
                  ? 'Enter your new V or U number.'
                  : 'You must enter your V or U number before making any changes. All edits will be tracked to your ID.'
                }
              </p>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Employee ID (V/U Number) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. V12345 or U12345"
                  value={userIdInput}
                  onChange={e => setUserIdInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') saveUserId(userIdInput); }}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600, letterSpacing: 1 }}
                />
              </div>
            </div>
            <div className="button-row" style={{ marginTop: 16 }}>
              {userId && (
                <button className="btn btn--outline" onClick={() => { setShowUserPrompt(false); setUserIdInput(''); }}>
                  Cancel
                </button>
              )}
              <button
                className="btn btn--primary"
                onClick={() => saveUserId(userIdInput)}
                disabled={!userIdInput.trim()}
              >
                {userId ? 'Update ID' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 className="card__header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            Station Requirements Matrix
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {userId ? (
              <span>Logged in as <strong style={{ color: 'var(--united-blue)' }}>{userId}</strong>
                <button onClick={() => setShowUserPrompt(true)} style={{ background: 'none', border: 'none', color: 'var(--united-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', marginLeft: 4 }}>change</button>
              </span>
            ) : (
              <button className="btn btn--outline btn--sm" onClick={() => setShowUserPrompt(true)}>Set User ID</button>
            )}
          </div>
        </div>

        {/* Search + Add */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label className="form-label">Search Documents</label>
            <input type="text" className="form-input" placeholder="Filter by document name..."
              value={searchDoc} onChange={e => setSearchDoc(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '1 1 180px', minWidth: 140 }}>
            <label className="form-label">Search Stations</label>
            <input type="text" className="form-input" placeholder="Filter by code or city..."
              value={searchStation} onChange={e => setSearchStation(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: '0 0 110px' }}>
            <label className="form-label">Add Station</label>
            <input type="text" className="form-input" placeholder="e.g. BQN" maxLength={3}
              value={newAirport} onChange={e => setNewAirport(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAddAirport()} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
            <button className="btn btn--primary btn--sm" onClick={handleAddAirport}>+ Station</button>
            <button className="btn btn--outline btn--sm" onClick={() => setShowCustomForm(!showCustomForm)}>
              {showCustomForm ? 'Cancel' : '+ Custom Doc'}
            </button>
          </div>
        </div>

        {/* Custom Doc Form */}
        {showCustomForm && (
          <div style={{ padding: 16, marginBottom: 14, background: '#F5F5F4', border: '1px solid #D7D7D4', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Add Custom Document for a Station</div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
              For one-off requirements like translated documents, apostille, etc. Only required at the selected station.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Station *</label>
                <select className="form-select" value={customDoc.airport_code} onChange={e => setCustomDoc(p => ({ ...p, airport_code: e.target.value }))}>
                  <option value="">Select...</option>
                  {airports.map(c => <option key={c} value={c}>{c} — {getAirportShort(c)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={customDoc.status} onChange={e => setCustomDoc(p => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Document Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Apostille on Death Certificate"
                  value={customDoc.document_name} onChange={e => setCustomDoc(p => ({ ...p, document_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input type="text" className="form-input" placeholder="e.g. Must be translated to Japanese"
                  value={customDoc.custom_note} onChange={e => setCustomDoc(p => ({ ...p, custom_note: e.target.value }))} />
              </div>
            </div>
            <div className="button-row" style={{ marginTop: 10 }}>
              <button className="btn btn--primary btn--sm" onClick={handleAddCustomDoc}>Add Custom Document</button>
            </div>
          </div>
        )}

        {/* ── MATRIX TABLE ── */}
        {filteredAirports.length > 0 ? (
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', border: '1px solid #D7D7D4', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 220 + filteredAirports.length * CELL_W }}>
              <thead>
                <tr>
                  {/* Sticky document column header */}
                  <th style={{
                    position: 'sticky', left: 0, top: 0, zIndex: 10,
                    background: '#051464', color: 'white', padding: '10px 12px',
                    textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                    width: 220, minWidth: 220, borderBottom: '2px solid #D7D7D4',
                  }}>Document</th>

                  {filteredAirports.map(code => (
                    <th key={code} style={{
                      position: 'sticky', top: 0, zIndex: 5,
                      background: '#051464', color: 'white', padding: '6px 6px',
                      textAlign: 'center', fontWeight: 700, fontSize: 11,
                      width: CELL_W, minWidth: CELL_W,
                      borderBottom: '2px solid #D7D7D4', borderLeft: '1px solid rgba(255,255,255,0.15)',
                    }}>
                      <div style={{ fontSize: 13, letterSpacing: 1 }}>{code}</div>
                      <div style={{ fontSize: 8, fontWeight: 400, opacity: 0.7, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getAirportShort(code).split('(')[0].trim()}
                      </div>
                      <button onClick={() => handleDeleteAirport(code)} title={`Remove ${code}`}
                        style={{ position: 'absolute', top: 3, right: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>×</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReqs.map((req, idx) => {
                  const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F4';
                  return (
                    <tr key={req.id}>
                      {/* Sticky document name */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 3,
                        background: rowBg, padding: '8px 12px',
                        borderBottom: '1px solid #D7D7D4', fontWeight: 500, fontSize: 13,
                        boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
                      }}>
                        {req.document_name}
                        {req.description && <div style={{ fontSize: 10, color: '#878787', marginTop: 1 }}>{req.description}</div>}
                      </td>

                      {filteredAirports.map(code => {
                        const status = getStatus(req.id, code);
                        const note = getNote(req.id, code);
                        const updAt = getUpdatedAt(req.id, code);
                        const updBy = getUpdatedBy(req.id, code);
                        const sc = STATUS_COLORS[status];
                        const isEditing = editCell?.reqId === req.id && editCell?.code === code;

                        return (
                          <td key={code} style={{
                            padding: '4px 5px', textAlign: 'center', verticalAlign: 'top',
                            borderBottom: '1px solid #D7D7D4', borderLeft: '1px solid #EBEBE9',
                            background: rowBg, position: 'relative',
                          }}>
                            {/* Status badge — click opens dropdown */}
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setEditCell(isEditing ? null : { reqId: req.id, code })}
                                style={{
                                  width: '100%', padding: '4px 2px', borderRadius: 4, border: `1px solid ${sc.border}`,
                                  background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 10,
                                  cursor: 'pointer', lineHeight: '14px',
                                }}>
                                {STATUS_SHORT[status]}
                              </button>

                              {/* Dropdown popup */}
                              {isEditing && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                  zIndex: 20, background: 'white', border: '1px solid #D7D7D4',
                                  borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                                  padding: 6, minWidth: 140, marginTop: 2,
                                }}>
                                  {STATUS_OPTIONS.map(opt => {
                                    const osc = STATUS_COLORS[opt];
                                    return (
                                      <button key={opt} onClick={() => handleUpdateStatus(req.id, code, opt)}
                                        style={{
                                          display: 'block', width: '100%', padding: '6px 8px', marginBottom: 2,
                                          border: status === opt ? `2px solid ${osc.border}` : '1px solid #EBEBE9',
                                          borderRadius: 6, background: status === opt ? osc.bg : 'white',
                                          color: osc.color, fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'left',
                                        }}>
                                        {opt}
                                      </button>
                                    );
                                  })}
                                  {/* Note input inside dropdown */}
                                  <input type="text" placeholder="Custom note..."
                                    defaultValue={note}
                                    onBlur={e => { if (e.target.value !== note) handleUpdateNote(req.id, code, e.target.value); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { handleUpdateNote(req.id, code, e.target.value); setEditCell(null); } }}
                                    style={{
                                      width: '100%', marginTop: 4, padding: '5px 6px', fontSize: 11,
                                      border: '1px solid #D7D7D4', borderRadius: 6,
                                    }} />
                                </div>
                              )}
                            </div>

                            {/* Note display */}
                            {note && !isEditing && (
                              <div title={note} style={{
                                fontSize: 8, color: '#1414D2', marginTop: 2,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{note}</div>
                            )}

                            {/* Updated info */}
                            {updBy && (
                              <div style={{ fontSize: 7, color: '#A5A5A5', marginTop: 2, lineHeight: '10px' }}>
                                {updBy} · {timeAgo(updAt)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert--info">
            {searchStation ? 'No stations match your search.' : 'No stations configured yet. Add a station code above.'}
          </div>
        )}

        {/* Stats bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#878787' }}>
          <span>{filteredReqs.length} documents × {filteredAirports.length} stations</span>
          <span>{airports.length} total stations configured</span>
        </div>
      </div>

      {/* Click-away overlay to close dropdown */}
      {editCell && (
        <div onClick={() => setEditCell(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />
      )}
    </>
  );
}
