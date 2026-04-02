import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAirportShort, getAirportDisplay } from '../lib/airportCodes';
import * as XLSX from 'xlsx';

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
  const [searchDoc, setSearchDoc] = useState('');
  const [searchStation, setSearchStation] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [newAirport, setNewAirport] = useState('');
  const [editCell, setEditCell] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDoc, setCustomDoc] = useState({ airport_code: '', document_name: '', custom_note: '', status: 'Required' });
  const [userId, setUserId] = useState('');
  const [showUserPrompt, setShowUserPrompt] = useState(true);
  const [userIdInput, setUserIdInput] = useState(() => localStorage.getItem('hr_matrix_user') || '');
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const flash = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      const { data: airReqs } = await supabase.from('airport_requirements').select('*');
      setRequirements(reqs || []); setAirportReqs(airReqs || []);
      setAirports([...new Set((airReqs || []).map(a => a.airport_code))].sort());
    } catch (err) { flash('warning', 'Failed to load: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  const ensureUser = () => { if (userId) return true; setShowUserPrompt(true); return false; };
  const saveUserId = (id) => { if (!id.trim()) return; const c = id.trim().toUpperCase(); setUserId(c); localStorage.setItem('hr_matrix_user', c); setShowUserPrompt(false); };

  const getReq = (reqId, code) => airportReqs.find(a => a.requirement_id === reqId && a.airport_code === code);
  const getStatus = (reqId, code) => getReq(reqId, code)?.status || 'Required';
  const getNote = (reqId, code) => getReq(reqId, code)?.custom_note || '';
  const getUpdatedBy = (reqId, code) => getReq(reqId, code)?.updated_by || '';
  const getUpdatedAt = (reqId, code) => getReq(reqId, code)?.updated_at || '';

  const handleUpdateStatus = async (reqId, code, newStatus) => {
    if (!ensureUser()) return;
    const now = new Date().toISOString();
    try {
      const existing = getReq(reqId, code);
      if (existing) await supabase.from('airport_requirements').update({ status: newStatus, updated_at: now, updated_by: userId }).eq('id', existing.id);
      else await supabase.from('airport_requirements').insert({ requirement_id: reqId, airport_code: code, status: newStatus, custom_note: '', updated_at: now, updated_by: userId });
      setAirportReqs(prev => {
        const idx = prev.findIndex(a => a.requirement_id === reqId && a.airport_code === code);
        if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], status: newStatus, updated_at: now, updated_by: userId }; return u; }
        return [...prev, { requirement_id: reqId, airport_code: code, status: newStatus, custom_note: '', updated_at: now, updated_by: userId }];
      });
      setEditCell(null);
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleUpdateNote = async (reqId, code, note) => {
    if (!ensureUser()) return;
    const now = new Date().toISOString();
    try {
      const existing = getReq(reqId, code);
      if (existing) await supabase.from('airport_requirements').update({ custom_note: note, updated_at: now, updated_by: userId }).eq('id', existing.id);
      setAirportReqs(prev => prev.map(a => a.requirement_id === reqId && a.airport_code === code ? { ...a, custom_note: note, updated_at: now, updated_by: userId } : a));
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleAddAirport = async () => {
    const code = newAirport.toUpperCase().trim();
    if (code.length !== 3) { flash('warning', '3 characters required.'); return; }
    if (airports.includes(code)) { flash('warning', `${code} exists.`); return; }
    try {
      const inserts = requirements.map(r => ({ requirement_id: r.id, airport_code: code, status: 'Required', custom_note: '', updated_by: userId || '', updated_at: new Date().toISOString() }));
      if (inserts.length > 0) await supabase.from('airport_requirements').insert(inserts);
      setNewAirport(''); flash('success', `${code} added.`); await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleDeleteAirport = async (code) => {
    if (!confirm(`Remove ${code}?`)) return;
    try { await supabase.from('airport_requirements').delete().eq('airport_code', code); flash('success', `${code} removed.`); await loadData(); }
    catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleAddCustomDoc = async () => {
    if (!customDoc.document_name.trim() || !customDoc.airport_code) { flash('warning', 'Fill in station and document.'); return; }
    if (!ensureUser()) return;
    try {
      const maxSort = requirements.reduce((max, r) => Math.max(max, r.sort_order || 0), 0);
      const { data } = await supabase.from('requirements_matrix').insert({ document_name: customDoc.document_name, description: customDoc.custom_note || 'Custom', applies_to: 'BOTH', sort_order: maxSort + 1, is_active: true }).select().single();
      await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Not Required' });
      const now = new Date().toISOString();
      const inserts = airports.map(c => ({ requirement_id: data.id, airport_code: c, status: c === customDoc.airport_code ? customDoc.status : 'Not Required', custom_note: c === customDoc.airport_code ? customDoc.custom_note : '', updated_by: userId, updated_at: now }));
      if (!airports.includes(customDoc.airport_code)) inserts.push({ requirement_id: data.id, airport_code: customDoc.airport_code, status: customDoc.status, custom_note: customDoc.custom_note, updated_by: userId, updated_at: now });
      await supabase.from('airport_requirements').insert(inserts);
      setCustomDoc({ airport_code: '', document_name: '', custom_note: '', status: 'Required' }); setShowCustomForm(false);
      flash('success', `Custom doc added for ${customDoc.airport_code}.`); await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  // ── Excel Export ──
  const handleExport = () => {
    const rows = [];
    requirements.forEach(req => {
      airports.forEach(code => {
        rows.push({
          'Document': req.document_name,
          'Station': code,
          'Station Name': getAirportShort(code),
          'Status': getStatus(req.id, code),
          'Custom Note': getNote(req.id, code),
          'Updated By': getUpdatedBy(req.id, code),
          'Updated At': getUpdatedAt(req.id, code) ? new Date(getUpdatedAt(req.id, code)).toLocaleString() : '',
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 6 }, { wch: 30 }, { wch: 22 }, { wch: 35 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Station Matrix');
    XLSX.writeFile(wb, 'Station_Matrix.xlsx');
  };

  // ── Excel Import ──
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ensureUser()) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const now = new Date().toISOString();
      let updated = 0;
      for (const row of rows) {
        const docName = (row['Document'] || '').trim();
        const station = (row['Station'] || '').trim().toUpperCase();
        const status = row['Status'];
        const note = row['Custom Note'] || '';
        if (!docName || !station || !STATUS_OPTIONS.includes(status)) continue;
        const req = requirements.find(r => r.document_name.toLowerCase() === docName.toLowerCase());
        if (!req) continue;
        const existing = airportReqs.find(a => a.requirement_id === req.id && a.airport_code === station);
        if (existing) {
          await supabase.from('airport_requirements').update({ status, custom_note: note, updated_by: userId, updated_at: now }).eq('id', existing.id);
        } else {
          await supabase.from('airport_requirements').insert({ requirement_id: req.id, airport_code: station, status, custom_note: note, updated_by: userId, updated_at: now });
        }
        updated++;
      }
      flash('success', `Import complete: ${updated} records updated.`); await loadData();
    } catch (err) { flash('warning', 'Import error: ' + err.message); }
    finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
  };

  const filteredAirports = airports.filter(c => !searchStation || c.includes(searchStation.toUpperCase()) || getAirportShort(c).toUpperCase().includes(searchStation.toUpperCase()));
  const filteredReqs = requirements.filter(r => !searchDoc || r.document_name.toLowerCase().includes(searchDoc.toLowerCase()));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  const CELL_W = 110;

  return (
    <>
      {message.text && <div className={`alert alert--${message.type}`}>{message.text}<button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button></div>}

      {showUserPrompt && (
        <div className="modal-overlay"><div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>{userId ? 'Change Your ID' : 'Identification Required'}</h3>
          <div className="modal__body">
            <p>{userId ? 'Enter your new V or U number.' : 'Enter your V or U number. All edits will be tracked.'}</p>
            <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Employee ID *</label>
              <input type="text" className="form-input" placeholder="e.g. V12345" value={userIdInput}
                onChange={e => setUserIdInput(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') saveUserId(userIdInput); }} autoFocus
                style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }} /></div>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            {userId && <button className="btn btn--outline" onClick={() => { setShowUserPrompt(false); setUserIdInput(''); }}>Cancel</button>}
            <button className="btn btn--primary" onClick={() => saveUserId(userIdInput)} disabled={!userIdInput.trim()}>{userId ? 'Update' : 'Continue'}</button>
          </div>
        </div></div>
      )}

      <div className="card" style={expanded ? { position: 'fixed', inset: 0, zIndex: 50, borderRadius: 0, margin: 0, maxWidth: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' } : {}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 className="card__header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Station Requirements Matrix</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {userId && <span>ID: <strong style={{ color: 'var(--united-blue)' }}>{userId}</strong>
              <button onClick={() => setShowUserPrompt(true)} style={{ background: 'none', border: 'none', color: 'var(--united-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, marginLeft: 4 }}>change</button></span>}
            <button className="btn btn--outline btn--sm" onClick={() => setExpanded(!expanded)}>{expanded ? '✕ Close' : '⛶ Expand'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '1 1 160px', minWidth: 130 }}><label className="form-label">Search Documents</label>
            <input type="text" className="form-input" placeholder="Filter..." value={searchDoc} onChange={e => setSearchDoc(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '1 1 160px', minWidth: 130 }}><label className="form-label">Search Stations</label>
            <input type="text" className="form-input" placeholder="Filter..." value={searchStation} onChange={e => setSearchStation(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '0 0 100px' }}><label className="form-label">Add Station</label>
            <input type="text" className="form-input" placeholder="BQN" maxLength={3} value={newAirport} onChange={e => setNewAirport(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleAddAirport()} /></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1, flexWrap: 'wrap' }}>
            <button className="btn btn--primary btn--sm" onClick={handleAddAirport}>+ Station</button>
            <button className="btn btn--outline btn--sm" onClick={() => setShowCustomForm(!showCustomForm)}>{showCustomForm ? 'Cancel' : '+ Custom Doc'}</button>
            <button className="btn btn--outline btn--sm" onClick={handleExport}>Export Excel</button>
            <button className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()}>Import Excel</button>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>

        {showCustomForm && (
          <div style={{ padding: 16, marginBottom: 14, background: '#F5F5F4', border: '1px solid #D7D7D4', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Add Custom Document for a Station</div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Station *</label>
                <select className="form-select" value={customDoc.airport_code} onChange={e => setCustomDoc(p => ({ ...p, airport_code: e.target.value }))}>
                  <option value="">Select...</option>{airports.map(c => <option key={c} value={c}>{c} — {getAirportShort(c)}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={customDoc.status} onChange={e => setCustomDoc(p => ({ ...p, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Document Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Apostille on Death Cert" value={customDoc.document_name} onChange={e => setCustomDoc(p => ({ ...p, document_name: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Note</label>
                <input type="text" className="form-input" placeholder="e.g. Translated to Japanese" value={customDoc.custom_note} onChange={e => setCustomDoc(p => ({ ...p, custom_note: e.target.value }))} /></div>
            </div>
            <div className="button-row" style={{ marginTop: 10 }}><button className="btn btn--primary btn--sm" onClick={handleAddCustomDoc}>Add</button></div>
          </div>
        )}

        {filteredAirports.length > 0 ? (
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: expanded ? 'calc(100vh - 220px)' : '65vh', border: '1px solid #D7D7D4', borderRadius: 10, flex: expanded ? 1 : undefined }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 220 + filteredAirports.length * CELL_W }}>
              <thead><tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 10, background: '#051464', color: 'white', padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', width: 220, minWidth: 220, borderBottom: '2px solid #D7D7D4' }}>Document</th>
                {filteredAirports.map(code => (
                  <th key={code} style={{ position: 'sticky', top: 0, zIndex: 5, background: '#051464', color: 'white', padding: '6px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11, width: CELL_W, minWidth: CELL_W, borderBottom: '2px solid #D7D7D4', borderLeft: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13, letterSpacing: 1 }}>{code}</div>
                    <div style={{ fontSize: 8, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>{getAirportShort(code).split('(')[0].trim().slice(0, 18)}</div>
                    <button onClick={() => handleDeleteAirport(code)} title={`Remove ${code}`} style={{ position: 'absolute', top: 3, right: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11 }}>×</button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredReqs.map((req, idx) => {
                  const rowBg = idx % 2 === 0 ? '#FFF' : '#F5F5F4';
                  return (
                    <tr key={req.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: rowBg, padding: '8px 12px', borderBottom: '1px solid #D7D7D4', fontWeight: 500, fontSize: 13, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                        {req.document_name}
                        {req.description && <div style={{ fontSize: 10, color: '#878787', marginTop: 1 }}>{req.description}</div>}
                      </td>
                      {filteredAirports.map(code => {
                        const status = getStatus(req.id, code);
                        const note = getNote(req.id, code);
                        const updBy = getUpdatedBy(req.id, code);
                        const updAt = getUpdatedAt(req.id, code);
                        const sc = STATUS_COLORS[status];
                        const isEditing = editCell?.reqId === req.id && editCell?.code === code;
                        return (
                          <td key={code} style={{ padding: '4px 5px', textAlign: 'center', verticalAlign: 'top', borderBottom: '1px solid #D7D7D4', borderLeft: '1px solid #EBEBE9', background: rowBg, position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setEditCell(isEditing ? null : { reqId: req.id, code })}
                                style={{ width: '100%', padding: '4px 2px', borderRadius: 4, border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
                                {STATUS_SHORT[status]}
                              </button>
                              {isEditing && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'white', border: '1px solid #D7D7D4', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.15)', padding: 6, minWidth: 140, marginTop: 2 }}>
                                  {STATUS_OPTIONS.map(opt => {
                                    const osc = STATUS_COLORS[opt];
                                    return <button key={opt} onClick={() => handleUpdateStatus(req.id, code, opt)} style={{ display: 'block', width: '100%', padding: '6px 8px', marginBottom: 2, border: status === opt ? `2px solid ${osc.border}` : '1px solid #EBEBE9', borderRadius: 6, background: status === opt ? osc.bg : 'white', color: osc.color, fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>{opt}</button>;
                                  })}
                                  <input type="text" placeholder="Custom note..." defaultValue={note}
                                    onBlur={e => { if (e.target.value !== note) handleUpdateNote(req.id, code, e.target.value); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { handleUpdateNote(req.id, code, e.target.value); setEditCell(null); } }}
                                    style={{ width: '100%', marginTop: 4, padding: '5px 6px', fontSize: 11, border: '1px solid #D7D7D4', borderRadius: 6 }} />
                                </div>
                              )}
                            </div>
                            {note && !isEditing && <div title={note} style={{ fontSize: 8, color: '#1414D2', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</div>}
                            {updBy && <div style={{ fontSize: 7, color: '#A5A5A5', marginTop: 2 }}>{updBy} · {timeAgo(updAt)}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="alert alert--info">{searchStation ? 'No stations match.' : 'No stations yet. Add one above.'}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#878787' }}>
          <span>{filteredReqs.length} docs × {filteredAirports.length} stations</span>
          <span>{airports.length} total stations</span>
        </div>
      </div>

      {editCell && <div onClick={() => setEditCell(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}
    </>
  );
}
