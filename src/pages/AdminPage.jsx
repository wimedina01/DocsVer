import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAirportShort } from '../lib/airportCodes';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const STATUS_SHORT = { 'Required': 'REQ', 'Required - Copies OK': 'COPIES OK', 'Not Required': 'N/A' };
const STATUS_COLORS = {
  'Required': { bg: '#FFE6DC', color: '#D50032' },
  'Required - Copies OK': { bg: '#FFF0D7', color: '#996B00' },
  'Not Required': { bg: '#DCFAE6', color: '#1B7742' },
};
const APPLIES_LABELS = { BOTH: 'Both', HUMAN_REMAINS: 'Human Remains', HUMAN_REMAINS_ASH: 'ASH' };

export default function AdminPage() {
  const [requirements, setRequirements] = useState([]);
  const [airportReqs, setAirportReqs] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // New requirement form
  const [newReq, setNewReq] = useState({ document_name: '', description: '', applies_to: 'BOTH' });
  // New airport
  const [newAirport, setNewAirport] = useState('');
  // Custom airport-specific document form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDoc, setCustomDoc] = useState({ airport_code: '', document_name: '', custom_note: '', status: 'Required' });
  // Note edits
  const [noteEdits, setNoteEdits] = useState({});

  // ── Load Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').order('sort_order', { ascending: true });
      const { data: airReqs } = await supabase.from('airport_requirements').select('*');
      const { data: defs } = await supabase.from('default_requirements').select('*');
      setRequirements(reqs || []);
      setAirportReqs(airReqs || []);
      setDefaults(defs || []);
      setNoteEdits({});
      const codes = [...new Set((airReqs || []).map(a => a.airport_code))].sort();
      setAirports(codes);
    } catch (err) {
      setMessage({ type: 'warning', text: 'Failed to load: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  // ── Add Requirement ──
  const handleAddRequirement = async () => {
    if (!newReq.document_name.trim()) return;
    setSaving(true);
    try {
      const maxSort = requirements.reduce((max, r) => Math.max(max, r.sort_order || 0), 0);
      const { data, error } = await supabase.from('requirements_matrix').insert({
        document_name: newReq.document_name, description: newReq.description,
        applies_to: newReq.applies_to, sort_order: maxSort + 1, is_active: true,
      }).select().single();
      if (error) throw error;
      await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Required' });
      // Also add to all existing airports
      if (airports.length > 0) {
        const inserts = airports.map(code => ({ requirement_id: data.id, airport_code: code, status: 'Required', custom_note: '' }));
        await supabase.from('airport_requirements').insert(inserts);
      }
      setNewReq({ document_name: '', description: '', applies_to: 'BOTH' });
      flash('success', 'Requirement added.');
      await loadData();
    } catch (err) {
      flash('warning', 'Error: ' + err.message);
    } finally { setSaving(false); }
  };

  // ── Toggle Active ──
  const handleToggleActive = async (req) => {
    try {
      await supabase.from('requirements_matrix').update({ is_active: !req.is_active }).eq('id', req.id);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Delete Requirement ──
  const handleDeleteRequirement = async (id) => {
    if (!confirm('Delete this requirement? This will remove it from all airports.')) return;
    try {
      await supabase.from('requirements_matrix').delete().eq('id', id);
      flash('success', 'Deleted.');
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Update Default ──
  const handleUpdateDefault = async (reqId, newStatus) => {
    try {
      const existing = defaults.find(d => d.requirement_id === reqId);
      if (existing) await supabase.from('default_requirements').update({ status: newStatus }).eq('id', existing.id);
      else await supabase.from('default_requirements').insert({ requirement_id: reqId, status: newStatus });
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Add Airport ──
  const handleAddAirport = async () => {
    const code = newAirport.toUpperCase().trim();
    if (code.length !== 3) { flash('warning', 'Code must be exactly 3 characters.'); return; }
    if (airports.includes(code)) { flash('warning', `${code} already exists.`); return; }
    setSaving(true);
    try {
      const inserts = requirements.filter(r => r.is_active).map(r => ({
        requirement_id: r.id, airport_code: code, status: 'Required', custom_note: '',
      }));
      if (inserts.length > 0) {
        const { error } = await supabase.from('airport_requirements').insert(inserts);
        if (error) throw error;
      }
      setNewAirport('');
      flash('success', `Airport ${code} added.`);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
    finally { setSaving(false); }
  };

  // ── Delete Airport ──
  const handleDeleteAirport = async (code) => {
    if (!confirm(`Delete all requirements for ${code}?`)) return;
    try {
      await supabase.from('airport_requirements').delete().eq('airport_code', code);
      flash('success', `${code} removed.`);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Cycle Status (click to toggle in matrix) ──
  const cycleStatus = async (reqId, airportCode) => {
    const current = getAirportStatus(reqId, airportCode);
    const idx = STATUS_OPTIONS.indexOf(current);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
    try {
      const existing = airportReqs.find(a => a.requirement_id === reqId && a.airport_code === airportCode);
      if (existing) await supabase.from('airport_requirements').update({ status: next }).eq('id', existing.id);
      else await supabase.from('airport_requirements').insert({ requirement_id: reqId, airport_code: airportCode, status: next, custom_note: '' });
      // Optimistic update
      setAirportReqs(prev => prev.map(a =>
        a.requirement_id === reqId && a.airport_code === airportCode ? { ...a, status: next } : a
      ));
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Custom Note ──
  const getNoteKey = (reqId, code) => `${reqId}_${code}`;
  const getAirportNote = (reqId, code) => {
    const key = getNoteKey(reqId, code);
    if (noteEdits[key] !== undefined) return noteEdits[key];
    const a = airportReqs.find(a => a.requirement_id === reqId && a.airport_code === code);
    return a?.custom_note || '';
  };

  const handleNoteSave = async (reqId, code) => {
    const key = getNoteKey(reqId, code);
    const val = noteEdits[key];
    if (val === undefined) return;
    try {
      const existing = airportReqs.find(a => a.requirement_id === reqId && a.airport_code === code);
      if (existing) await supabase.from('airport_requirements').update({ custom_note: val }).eq('id', existing.id);
      else await supabase.from('airport_requirements').insert({ requirement_id: reqId, airport_code: code, status: 'Required', custom_note: val });
      setAirportReqs(prev => prev.map(a =>
        a.requirement_id === reqId && a.airport_code === code ? { ...a, custom_note: val } : a
      ));
      setNoteEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (err) { flash('warning', 'Error saving note: ' + err.message); }
  };

  // ── Add Custom Airport-Specific Document ──
  const handleAddCustomDoc = async () => {
    if (!customDoc.document_name.trim() || !customDoc.airport_code.trim()) {
      flash('warning', 'Please fill in airport code and document name.'); return;
    }
    setSaving(true);
    try {
      // Create the requirement in the matrix
      const maxSort = requirements.reduce((max, r) => Math.max(max, r.sort_order || 0), 0);
      const { data, error } = await supabase.from('requirements_matrix').insert({
        document_name: customDoc.document_name,
        description: customDoc.custom_note || 'Custom requirement',
        applies_to: 'BOTH',
        sort_order: maxSort + 1,
        is_active: true,
      }).select().single();
      if (error) throw error;

      // Set it as Not Required by default
      await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Not Required' });

      // Set all existing airports to Not Required
      const allInserts = airports.map(code => ({
        requirement_id: data.id, airport_code: code, status: 'Not Required', custom_note: '',
      }));

      // Override the specific airport to the selected status with the custom note
      const targetCode = customDoc.airport_code.toUpperCase().trim();
      const targetIdx = allInserts.findIndex(i => i.airport_code === targetCode);
      if (targetIdx >= 0) {
        allInserts[targetIdx].status = customDoc.status;
        allInserts[targetIdx].custom_note = customDoc.custom_note;
      } else {
        // Airport might not exist yet
        allInserts.push({
          requirement_id: data.id, airport_code: targetCode,
          status: customDoc.status, custom_note: customDoc.custom_note,
        });
      }

      if (allInserts.length > 0) {
        await supabase.from('airport_requirements').insert(allInserts);
      }

      setCustomDoc({ airport_code: '', document_name: '', custom_note: '', status: 'Required' });
      setShowCustomForm(false);
      flash('success', `Custom document added for ${targetCode}.`);
      await loadData();
    } catch (err) {
      flash('warning', 'Error: ' + err.message);
    } finally { setSaving(false); }
  };

  // ── Helpers ──
  const getDefaultStatus = (reqId) => defaults.find(d => d.requirement_id === reqId)?.status || 'Required';
  const getAirportStatus = (reqId, code) => airportReqs.find(a => a.requirement_id === reqId && a.airport_code === code)?.status || 'Required';

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const activeReqs = requirements.filter(r => r.is_active);

  return (
    <>
      {message.text && (
        <div className={`alert alert--${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {/* ═══ ADD NEW REQUIREMENT ═══ */}
      <div className="card">
        <h2 className="card__header">Add New Document Requirement</h2>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Document Name *</label>
            <input type="text" className="form-input" placeholder="e.g. Consular Authorization"
              value={newReq.document_name} onChange={e => setNewReq(p => ({ ...p, document_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Applies To</label>
            <select className="form-select" value={newReq.applies_to} onChange={e => setNewReq(p => ({ ...p, applies_to: e.target.value }))}>
              <option value="BOTH">Both (HR & ASH)</option>
              <option value="HUMAN_REMAINS">Human Remains</option>
              <option value="HUMAN_REMAINS_ASH">Human Remains - ASH</option>
            </select>
          </div>
          <div className="form-group form-group--full">
            <label className="form-label">Description</label>
            <input type="text" className="form-input" placeholder="Brief description"
              value={newReq.description} onChange={e => setNewReq(p => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleAddRequirement} disabled={saving}>
            {saving ? 'Saving...' : 'Add Requirement'}
          </button>
        </div>
      </div>

      {/* ═══ REQUIREMENTS & DEFAULT STATUSES ═══ */}
      <div className="card">
        <h2 className="card__header">Document Requirements & Default Statuses</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Document</th>
                <th style={{ width: 100 }}>Applies To</th>
                <th style={{ width: 155 }}>Default Status</th>
                <th style={{ width: 50 }}>Active</th>
                <th style={{ width: 65 }}></th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req, idx) => (
                <tr key={req.id} style={{ opacity: req.is_active ? 1 : 0.45 }}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td>
                    <strong>{req.document_name}</strong>
                    {req.description && <div style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{req.description}</div>}
                  </td>
                  <td style={{ fontSize: '13px' }}>{APPLIES_LABELS[req.applies_to] || req.applies_to}</td>
                  <td>
                    <select value={getDefaultStatus(req.id)} onChange={e => handleUpdateDefault(req.id, e.target.value)}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={req.is_active} onChange={() => handleToggleActive(req)}
                      style={{ cursor: 'pointer', width: 18, height: 18, accentColor: 'var(--united-blue)' }} />
                  </td>
                  <td>
                    <button className="btn btn--danger btn--sm" onClick={() => handleDeleteRequirement(req.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ AIRPORT-SPECIFIC REQUIREMENTS MATRIX ═══ */}
      <div className="card">
        <h2 className="card__header">Airport-Specific Requirements Matrix</h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '22px', marginBottom: 16 }}>
          Click any cell to cycle through statuses: <strong style={{ color: '#D50032' }}>REQ</strong> →{' '}
          <strong style={{ color: '#996B00' }}>COPIES OK</strong> →{' '}
          <strong style={{ color: '#1B7742' }}>N/A</strong>. Click the note icon to add custom instructions.
        </p>

        {/* Add Airport + Custom Document buttons */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '0 0 110px' }}>
            <label className="form-label">Add Station</label>
            <input type="text" className="form-input" placeholder="e.g. BQN" maxLength={3}
              value={newAirport} onChange={e => setNewAirport(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAddAirport()} />
          </div>
          <button className="btn btn--primary btn--sm" onClick={handleAddAirport} disabled={saving}>+ Add Station</button>

          <div style={{ flex: 1 }} />

          <button className="btn btn--outline btn--sm" onClick={() => setShowCustomForm(!showCustomForm)}>
            {showCustomForm ? 'Cancel' : '+ Add Custom Document for Station'}
          </button>
        </div>

        {/* Custom Document Form */}
        {showCustomForm && (
          <div style={{
            padding: 16, marginBottom: 16, background: 'var(--medium-tonal-grey-20)',
            border: '1px solid var(--medium-tonal-grey)', borderRadius: 'var(--radius-field)',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
              Add a Custom Document Requirement for a Specific Station
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Use this for one-off requirements like translated documents, apostille requirements, or
              station-specific forms. This document will only be required at the station you specify.
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Station Code *</label>
                <select className="form-select" value={customDoc.airport_code}
                  onChange={e => setCustomDoc(p => ({ ...p, airport_code: e.target.value }))}>
                  <option value="">Select station...</option>
                  {airports.map(code => <option key={code} value={code}>{getAirportShort(code)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={customDoc.status}
                  onChange={e => setCustomDoc(p => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Document Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Apostille on Death Certificate"
                  value={customDoc.document_name} onChange={e => setCustomDoc(p => ({ ...p, document_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Note / Details</label>
                <input type="text" className="form-input" placeholder="e.g. Must be translated to Japanese"
                  value={customDoc.custom_note} onChange={e => setCustomDoc(p => ({ ...p, custom_note: e.target.value }))} />
              </div>
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="btn btn--primary btn--sm" onClick={handleAddCustomDoc} disabled={saving}>
                {saving ? 'Adding...' : 'Add Custom Document'}
              </button>
            </div>
          </div>
        )}

        {/* Matrix Table */}
        {airports.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 2, background: 'var(--dark-blue, #051464)',
                    color: 'white', padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                    fontSize: '11px', textTransform: 'uppercase', minWidth: 180, borderBottom: '2px solid var(--medium-tonal-grey)',
                  }}>Document</th>
                  {airports.map(code => (
                    <th key={code} style={{
                      background: 'var(--dark-blue, #051464)', color: 'white', padding: '6px 4px',
                      textAlign: 'center', fontWeight: 700, fontSize: '11px', minWidth: 70,
                      borderBottom: '2px solid var(--medium-tonal-grey)', position: 'relative',
                    }}>
                      <div>{code}</div>
                      <div style={{ fontSize: '8px', fontWeight: 400, opacity: 0.7, marginTop: 1 }}>
                        {getAirportShort(code).split('(')[0].trim().slice(0, 15)}
                      </div>
                      <button onClick={() => handleDeleteAirport(code)} title={`Remove ${code}`}
                        style={{
                          position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '10px', padding: 0, lineHeight: 1,
                        }}>×</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeReqs.map((req, idx) => (
                  <tr key={req.id} style={{ background: idx % 2 === 0 ? 'white' : 'var(--medium-tonal-grey-20, #F5F5F4)' }}>
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 1, padding: '6px 10px',
                      borderBottom: '1px solid var(--medium-tonal-grey, #D7D7D4)',
                      background: idx % 2 === 0 ? 'white' : '#F5F5F4',
                      fontWeight: 500, fontSize: '12px',
                    }}>
                      {req.document_name}
                    </td>
                    {airports.map(code => {
                      const status = getAirportStatus(req.id, code);
                      const note = getAirportNote(req.id, code);
                      const noteKey = getNoteKey(req.id, code);
                      const sc = STATUS_COLORS[status] || STATUS_COLORS['Required'];
                      const [editing, setEditing] = useState ? false : false;
                      return (
                        <td key={code} style={{
                          padding: '4px 3px', textAlign: 'center',
                          borderBottom: '1px solid var(--medium-tonal-grey, #D7D7D4)',
                          borderLeft: '1px solid var(--medium-tonal-grey, #D7D7D4)',
                        }}>
                          <div
                            onClick={() => cycleStatus(req.id, code)}
                            title={`Click to change: ${status}`}
                            style={{
                              cursor: 'pointer', padding: '3px 2px', borderRadius: 4,
                              background: sc.bg, color: sc.color, fontWeight: 700,
                              fontSize: '10px', userSelect: 'none', lineHeight: '14px',
                            }}
                          >
                            {STATUS_SHORT[status]}
                          </div>
                          {note && (
                            <div title={note} style={{
                              fontSize: '8px', color: '#1414D2', marginTop: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 65, margin: '2px auto 0',
                            }}>
                              {note}
                            </div>
                          )}
                          <input
                            type="text"
                            placeholder="note..."
                            value={noteEdits[noteKey] !== undefined ? noteEdits[noteKey] : (note || '')}
                            onChange={e => setNoteEdits(p => ({ ...p, [noteKey]: e.target.value }))}
                            onBlur={() => handleNoteSave(req.id, code)}
                            style={{
                              width: '100%', marginTop: 2, padding: '2px 3px', fontSize: '9px',
                              border: '1px solid #D7D7D4', borderRadius: 3, color: '#555',
                              background: note ? '#EBF2FE' : 'white',
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert--info">
            No stations configured yet. Add a station code above to start building the requirements matrix.
          </div>
        )}
      </div>
    </>
  );
}
