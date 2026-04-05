import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAirportShort } from '../lib/airportCodes';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const STATUS_SHORT = { 'Required': 'REQ', 'Required - Copies OK': 'COPIES', 'Not Required': 'N/A' };
const STATUS_COLORS = { 'Required': { bg: '#FFE6DC', color: '#D50032', border: '#D50032' }, 'Required - Copies OK': { bg: '#FFF0D7', color: '#996B00', border: '#FFC658' }, 'Not Required': { bg: '#DCFAE6', color: '#1B7742', border: '#1B7742' } };

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
  const [importProgress, setImportProgress] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const flash = (t, m) => { setMessage({ type: t, text: m }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      const { data: airReqs } = await supabase.from('airport_requirements').select('*');
      setRequirements(reqs || []); setAirportReqs(airReqs || []);
      setAirports([...new Set((airReqs || []).map(a => a.airport_code))].sort());
    } catch (e) { flash('warning', e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadData(); }, []);

  const ensureUser = () => { if (userId) return true; setShowUserPrompt(true); return false; };
  const saveUserId = id => { if (!id.trim()) return; const c = id.trim().toUpperCase(); setUserId(c); localStorage.setItem('hr_matrix_user', c); setShowUserPrompt(false); };

  const getReq = (rid, c) => airportReqs.find(a => a.requirement_id === rid && a.airport_code === c);
  const getStatus = (rid, c) => getReq(rid, c)?.status || 'Required';
  const getNote = (rid, c) => getReq(rid, c)?.custom_note || '';
  const getUpdatedBy = (rid, c) => getReq(rid, c)?.updated_by || '';
  const getUpdatedAt = (rid, c) => getReq(rid, c)?.updated_at || '';
  const getCodPendingOk = (rid, c) => getReq(rid, c)?.cause_of_death_pending_ok || false;

  const handleUpdateStatus = async (rid, c, s) => {
    if (!ensureUser()) return; const now = new Date().toISOString();
    const ex = getReq(rid, c);
    if (ex) await supabase.from('airport_requirements').update({ status: s, updated_at: now, updated_by: userId }).eq('id', ex.id);
    else await supabase.from('airport_requirements').insert({ requirement_id: rid, airport_code: c, status: s, custom_note: '', updated_at: now, updated_by: userId });
    setAirportReqs(p => { const i = p.findIndex(a => a.requirement_id === rid && a.airport_code === c); if (i >= 0) { const u = [...p]; u[i] = { ...u[i], status: s, updated_at: now, updated_by: userId }; return u; } return [...p, { requirement_id: rid, airport_code: c, status: s, custom_note: '', updated_at: now, updated_by: userId }]; });
    setEditCell(null);
  };

  const handleUpdateNote = async (rid, c, n) => {
    if (!ensureUser()) return; const now = new Date().toISOString();
    const ex = getReq(rid, c);
    if (ex) await supabase.from('airport_requirements').update({ custom_note: n, updated_at: now, updated_by: userId }).eq('id', ex.id);
    setAirportReqs(p => p.map(a => a.requirement_id === rid && a.airport_code === c ? { ...a, custom_note: n, updated_at: now, updated_by: userId } : a));
  };

  const handleToggleCodPending = async (code) => {
    if (!ensureUser()) return;
    // Toggle cause_of_death_pending_ok for ALL requirements at this airport
    const current = airportReqs.filter(a => a.airport_code === code);
    const currentVal = current.some(a => a.cause_of_death_pending_ok);
    const newVal = !currentVal;
    for (const ar of current) {
      await supabase.from('airport_requirements').update({ cause_of_death_pending_ok: newVal }).eq('id', ar.id);
    }
    setAirportReqs(p => p.map(a => a.airport_code === code ? { ...a, cause_of_death_pending_ok: newVal } : a));
    flash('success', `${code}: Cause of Death Pending ${newVal ? 'NOT acceptable — will require verification' : 'acceptable — no extra check needed'}`);
  };

  const handleAddAirport = async () => {
    const c = newAirport.toUpperCase().trim();
    if (c.length !== 3) { flash('warning', '3 chars required.'); return; }
    if (airports.includes(c)) { flash('warning', `${c} exists.`); return; }
    const inserts = requirements.map(r => ({ requirement_id: r.id, airport_code: c, status: 'Required', custom_note: '', updated_by: userId || '', updated_at: new Date().toISOString(), cause_of_death_pending_ok: false }));
    if (inserts.length) await supabase.from('airport_requirements').insert(inserts);
    setNewAirport(''); flash('success', `${c} added.`); await loadData();
  };

  const handleDeleteAirport = async c => { if (!confirm(`Remove ${c}?`)) return; await supabase.from('airport_requirements').delete().eq('airport_code', c); flash('success', `${c} removed.`); await loadData(); };

  const handleAddCustomDoc = async () => {
    if (!customDoc.document_name.trim() || !customDoc.airport_code) { flash('warning', 'Fill station and name.'); return; }
    if (!ensureUser()) return;
    const ms = requirements.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    const { data } = await supabase.from('requirements_matrix').insert({ document_name: customDoc.document_name, description: customDoc.custom_note || 'Custom', applies_to: 'BOTH', sort_order: ms + 1, is_active: true }).select().single();
    await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Not Required' });
    const now = new Date().toISOString();
    const ins = airports.map(c => ({ requirement_id: data.id, airport_code: c, status: c === customDoc.airport_code ? customDoc.status : 'Not Required', custom_note: c === customDoc.airport_code ? customDoc.custom_note : '', updated_by: userId, updated_at: now }));
    if (!airports.includes(customDoc.airport_code)) ins.push({ requirement_id: data.id, airport_code: customDoc.airport_code, status: customDoc.status, custom_note: customDoc.custom_note, updated_by: userId, updated_at: now });
    await supabase.from('airport_requirements').insert(ins);
    setCustomDoc({ airport_code: '', document_name: '', custom_note: '', status: 'Required' }); setShowCustomForm(false);
    flash('success', 'Added.'); await loadData();
  };

  // ── Download Excel Template ──
  const handleDownloadTemplate = () => {
    const header = ['Station (3-letter code)', 'COD Pending Unacceptable (Y/N)', ...requirements.map(r => r.document_name)];
    const instructions = ['INSTRUCTIONS:', '', ...requirements.map(() => '')];
    const example = ['BOG', 'Y', ...requirements.map(() => 'Required')];
    const ws = XLSX.utils.aoa_to_sheet([
      ['Station Management Import Template — United Cargo HR Document Checklist'],
      ['Fill in station codes and set each document status. Valid statuses: Required, Required - Copies OK, Not Required'],
      ['To add a custom note, use format: Required | Note text here'],
      ['COD Pending Unacceptable: Y = Cause of Death "Pending" is NOT acceptable (adds verification check), N = acceptable'],
      [],
      header, example,
    ]);
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }, ...requirements.map(() => ({ wch: 24 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Station_Matrix_Template.xlsx');
  };

  // ── Export ──
  const handleExport = () => {
    const header = ['Station', 'City', 'COD Pending Unacceptable', ...requirements.map(r => r.document_name)];
    const rows = airports.map(c => {
      const codOk = airportReqs.filter(a => a.airport_code === c).some(a => a.cause_of_death_pending_ok) ? 'Y' : 'N';
      const row = [c, getAirportShort(c).split('(')[0].trim(), codOk];
      requirements.forEach(r => { const st = getStatus(r.id, c), nt = getNote(r.id, c); row.push(nt ? `${st} | ${nt}` : st); });
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 14 }, ...requirements.map(() => ({ wch: 24 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matrix');
    XLSX.writeFile(wb, 'Station_Matrix.xlsx');
  };

  // ── Import ──
  const handleImport = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ensureUser()) return;
    setImportProgress(0);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Find header row (first row with "Station" in first cell)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(aoa.length, 10); i++) {
        const first = (aoa[i]?.[0] || '').toString().toLowerCase();
        if (first.includes('station')) { headerIdx = i; break; }
      }
      const headerRow = aoa[headerIdx];
      // Find COD column and doc columns
      const codColIdx = headerRow.findIndex(h => (h || '').toString().toLowerCase().includes('cod'));
      const docStartIdx = codColIdx >= 0 ? codColIdx + 1 : 2;
      const docNames = headerRow.slice(docStartIdx).map(h => (h || '').toString().trim());
      const now = new Date().toISOString();
      const totalRows = aoa.length - headerIdx - 1;
      let updated = 0;
      for (let i = headerIdx + 1; i < aoa.length; i++) {
        const row = aoa[i];
        const code = (row[0] || '').toString().trim().toUpperCase();
        if (!code || code.length !== 3) continue;
        // COD pending
        if (codColIdx >= 0) {
          const codVal = (row[codColIdx] || '').toString().trim().toUpperCase();
          const codOk = codVal === 'Y' || codVal === 'YES' || codVal === 'TRUE';
          const existing = airportReqs.filter(a => a.airport_code === code);
          for (const ar of existing) {
            await supabase.from('airport_requirements').update({ cause_of_death_pending_ok: codOk }).eq('id', ar.id);
          }
        }
        for (let j = 0; j < docNames.length; j++) {
          const docName = docNames[j]; if (!docName) continue;
          const req = requirements.find(r => r.document_name.toLowerCase() === docName.toLowerCase());
          if (!req) continue;
          const cellVal = (row[j + docStartIdx] || '').toString().trim(); if (!cellVal) continue;
          const parts = cellVal.split('|').map(s => s.trim());
          const status = STATUS_OPTIONS.includes(parts[0]) ? parts[0] : null;
          if (!status) continue;
          const note = parts[1] || '';
          const ex = airportReqs.find(a => a.requirement_id === req.id && a.airport_code === code);
          if (ex) await supabase.from('airport_requirements').update({ status, custom_note: note, updated_by: userId, updated_at: now }).eq('id', ex.id);
          else await supabase.from('airport_requirements').insert({ requirement_id: req.id, airport_code: code, status, custom_note: note, updated_by: userId, updated_at: now });
          updated++;
        }
        setImportProgress(Math.round(((i - headerIdx) / totalRows) * 100));
      }
      flash('success', `${updated} cells updated.`); await loadData();
    } catch (err) { flash('warning', 'Import error: ' + err.message); }
    finally { setImportProgress(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const timeAgo = d => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
  const filteredAirports = airports.filter(c => !searchStation || c.includes(searchStation.toUpperCase()) || getAirportShort(c).toUpperCase().includes(searchStation.toUpperCase()));
  const filteredReqs = requirements.filter(r => !searchDoc || r.document_name.toLowerCase().includes(searchDoc.toLowerCase()));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  const CELL_W = 100;

  return (
    <>
      {message.text && <div className={`alert alert--${message.type}`}>{message.text}</div>}

      {showUserPrompt && (
        <div className="modal-overlay"><div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>{userId ? 'Change ID' : 'Identification Required'}</h3>
          <div className="modal__body">
            <p>{userId ? 'Enter new ID.' : 'Enter your V or U number.'}</p>
            <div className="form-group" style={{ marginTop: 16 }}><label className="form-label">Employee ID *</label>
              <input type="text" className="form-input" placeholder="e.g. V12345" value={userIdInput}
                onChange={e => setUserIdInput(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') saveUserId(userIdInput); }} autoFocus style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }} /></div>
          </div>
          <div className="button-row" style={{ marginTop: 16 }}>
            {userId && <button className="btn btn--outline" onClick={() => setShowUserPrompt(false)}>Cancel</button>}
            <button className="btn btn--primary" onClick={() => saveUserId(userIdInput)} disabled={!userIdInput.trim()}>{userId ? 'Update' : 'Continue'}</button>
          </div>
        </div></div>
      )}

      <div className="card" style={expanded ? { position: 'fixed', inset: 0, zIndex: 50, borderRadius: 0, margin: 0, maxWidth: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' } : {}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2 className="card__header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Station Management</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            {userId && <span style={{ color: 'var(--text-secondary)' }}>ID: <strong style={{ color: 'var(--united-blue)' }}>{userId}</strong> <button onClick={() => setShowUserPrompt(true)} style={{ background: 'none', border: 'none', color: 'var(--united-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>change</button></span>}
            <button className="btn btn--outline btn--sm" onClick={() => setExpanded(!expanded)}>{expanded ? '✕ Close' : '⛶ Expand'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '1 1 150px' }}><label className="form-label">Search Stations</label><input type="text" className="form-input" placeholder="Filter..." value={searchStation} onChange={e => setSearchStation(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '1 1 150px' }}><label className="form-label">Search Docs</label><input type="text" className="form-input" placeholder="Filter..." value={searchDoc} onChange={e => setSearchDoc(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '0 0 90px' }}><label className="form-label">Add</label><input type="text" className="form-input" placeholder="BQN" maxLength={3} value={newAirport} onChange={e => setNewAirport(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleAddAirport()} /></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1, flexWrap: 'wrap' }}>
            <button className="btn btn--primary btn--sm" onClick={handleAddAirport}>+ Station</button>
            <button className="btn btn--outline btn--sm" onClick={() => setShowCustomForm(!showCustomForm)}>{showCustomForm ? 'Cancel' : '+ Custom'}</button>
            <button className="btn btn--outline btn--sm" onClick={handleExport}>Export</button>
            <button className="btn btn--outline btn--sm" onClick={handleDownloadTemplate} title="Download Excel template">
              <span style={{ fontSize: 14 }}>📊</span> Template
            </button>
            <button className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()}>Import</button>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>

        {importProgress !== null && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Importing... {importProgress}%</div>
            <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${importProgress}%` }} /></div>
          </div>
        )}

        {showCustomForm && (
          <div style={{ padding: 16, marginBottom: 14, background: 'var(--medium-tonal-grey-20)', border: '1px solid var(--medium-tonal-grey)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Custom Document for Station</div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Station *</label><select className="form-select" value={customDoc.airport_code} onChange={e => setCustomDoc(p => ({ ...p, airport_code: e.target.value }))}><option value="">Select...</option>{airports.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={customDoc.status} onChange={e => setCustomDoc(p => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Document *</label><input type="text" className="form-input" value={customDoc.document_name} onChange={e => setCustomDoc(p => ({ ...p, document_name: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Note</label><input type="text" className="form-input" value={customDoc.custom_note} onChange={e => setCustomDoc(p => ({ ...p, custom_note: e.target.value }))} /></div>
            </div>
            <div className="button-row" style={{ marginTop: 10 }}><button className="btn btn--primary btn--sm" onClick={handleAddCustomDoc}>Add</button></div>
          </div>
        )}

        {/* MATRIX: Stations as ROWS, Documents as COLUMNS */}
        {filteredAirports.length > 0 && filteredReqs.length > 0 ? (
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: expanded ? 'calc(100vh - 220px)' : '65vh', border: '1px solid var(--medium-tonal-grey)', borderRadius: 10, flex: expanded ? 1 : undefined }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 200 + filteredReqs.length * CELL_W }}>
              <thead><tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 10, background: '#051464', color: 'white', padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, width: 200, minWidth: 200, borderBottom: '2px solid var(--medium-tonal-grey)' }}>Station</th>
                {filteredReqs.map(req => (
                  <th key={req.id} style={{ position: 'sticky', top: 0, zIndex: 5, background: '#051464', color: 'white', padding: '5px 3px', textAlign: 'center', fontWeight: 600, fontSize: 8, width: CELL_W, minWidth: CELL_W, borderBottom: '2px solid var(--medium-tonal-grey)', borderLeft: '1px solid rgba(255,255,255,0.15)', lineHeight: '11px' }}>
                    {req.document_name}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredAirports.map((code, idx) => {
                  const bg = idx % 2 === 0 ? 'var(--surface-card)' : 'var(--medium-tonal-grey-20)';
                  const codOk = airportReqs.filter(a => a.airport_code === code).some(a => a.cause_of_death_pending_ok);
                  return (
                    <tr key={code}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: bg, padding: '5px 8px', borderBottom: '1px solid var(--medium-tonal-grey)', fontWeight: 600, fontSize: 12, boxShadow: '2px 0 4px rgba(0,0,0,0.06)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div>
                            <div>{code}</div>
                            <div style={{ fontSize: 8, color: 'var(--text-disabled)', fontWeight: 400 }}>{getAirportShort(code).split('(')[0].trim().slice(0, 22)}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label title="Check if Cause of Death Pending is NOT acceptable" style={{ fontSize: 8, color: codOk ? 'var(--alert-red)' : 'var(--text-disabled)', cursor: 'pointer', fontWeight: codOk ? 700 : 400 }}>COD</label>
                            <input type="checkbox" checked={codOk} onChange={() => handleToggleCodPending(code)}
                              title="Check = COD Pending NOT acceptable" style={{ cursor: 'pointer', accentColor: 'var(--alert-red)' }} />
                            <button onClick={() => handleDeleteAirport(code)} title={`Remove ${code}`} style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', fontSize: 11, marginLeft: 4 }}>×</button>
                          </div>
                        </div>
                      </td>
                      {filteredReqs.map(req => {
                        const st = getStatus(req.id, code), nt = getNote(req.id, code);
                        const ub = getUpdatedBy(req.id, code), ua = getUpdatedAt(req.id, code);
                        const sc = STATUS_COLORS[st]; const isEd = editCell?.reqId === req.id && editCell?.code === code;
                        return (
                          <td key={req.id} style={{ padding: '3px 3px', textAlign: 'center', verticalAlign: 'top', borderBottom: '1px solid var(--medium-tonal-grey)', borderLeft: '1px solid var(--medium-tonal-grey-50)', background: bg, position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setEditCell(isEd ? null : { reqId: req.id, code })} style={{ width: '100%', padding: '3px 1px', borderRadius: 4, border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 9, cursor: 'pointer', lineHeight: '12px' }}>{STATUS_SHORT[st]}</button>
                              {isEd && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--surface-card)', border: '1px solid var(--medium-tonal-grey)', borderRadius: 8, boxShadow: 'var(--shadow-3)', padding: 6, minWidth: 150, marginTop: 2 }}>
                                  {STATUS_OPTIONS.map(o => { const os = STATUS_COLORS[o]; return <button key={o} onClick={() => handleUpdateStatus(req.id, code, o)} style={{ display: 'block', width: '100%', padding: '5px 8px', marginBottom: 2, border: st === o ? `2px solid ${os.border}` : '1px solid var(--medium-tonal-grey-50)', borderRadius: 6, background: st === o ? os.bg : 'var(--surface-card)', color: os.color, fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>{o}</button>; })}
                                  <input type="text" placeholder="Note..." defaultValue={nt} onBlur={e => { if (e.target.value !== nt) handleUpdateNote(req.id, code, e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { handleUpdateNote(req.id, code, e.target.value); setEditCell(null); } }} style={{ width: '100%', marginTop: 4, padding: '5px 6px', fontSize: 11, border: '1px solid var(--medium-tonal-grey)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
                                </div>
                              )}
                            </div>
                            {nt && !isEd && <div title={nt} style={{ fontSize: 7, color: 'var(--united-blue)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nt}</div>}
                            {ub && <div style={{ fontSize: 6, color: 'var(--text-disabled)', marginTop: 1 }}>{ub}·{timeAgo(ua)}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="alert alert--info">{searchStation || searchDoc ? 'No match.' : 'No stations yet.'}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-disabled)' }}>
          <span>{filteredAirports.length} stations × {filteredReqs.length} docs</span>
          <span>{airports.length} total</span>
        </div>
      </div>
      {editCell && <div onClick={() => setEditCell(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}
    </>
  );
}
