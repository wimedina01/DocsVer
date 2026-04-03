import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAirportShort, getAirportDisplay } from '../lib/airportCodes';
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
  const [importProgress, setImportProgress] = useState(null); // null = not importing, 0-100 = progress
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

  const handleAddAirport = async () => {
    const c = newAirport.toUpperCase().trim();
    if (c.length !== 3) { flash('warning', '3 chars required.'); return; }
    if (airports.includes(c)) { flash('warning', `${c} exists.`); return; }
    const inserts = requirements.map(r => ({ requirement_id: r.id, airport_code: c, status: 'Required', custom_note: '', updated_by: userId || '', updated_at: new Date().toISOString() }));
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
    flash('success', 'Custom doc added.'); await loadData();
  };

  // ── Matrix-format Excel Export ──
  const handleExport = () => {
    // Build matrix: rows = documents, columns = airports
    const header = ['Document', ...airports];
    const rows = requirements.map(r => {
      const row = [r.document_name];
      airports.forEach(c => {
        const status = getStatus(r.id, c);
        const note = getNote(r.id, c);
        row.push(note ? `${status} | ${note}` : status);
      });
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    // Set column widths
    ws['!cols'] = [{ wch: 35 }, ...airports.map(() => ({ wch: 22 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matrix');
    XLSX.writeFile(wb, 'Station_Matrix.xlsx');
  };

  // ── Import with progress ──
  const handleImport = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ensureUser()) return;
    setImportProgress(0);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (aoa.length < 2) { flash('warning', 'Empty file.'); setImportProgress(null); return; }
      const headerRow = aoa[0];
      const stationCols = headerRow.slice(1).map(h => (h || '').toString().trim().toUpperCase().slice(0, 3));
      const now = new Date().toISOString();
      const totalRows = aoa.length - 1;
      let updated = 0;
      for (let i = 1; i < aoa.length; i++) {
        const row = aoa[i];
        const docName = (row[0] || '').toString().trim();
        if (!docName) continue;
        const req = requirements.find(r => r.document_name.toLowerCase() === docName.toLowerCase());
        if (!req) continue;
        for (let j = 0; j < stationCols.length; j++) {
          const code = stationCols[j];
          if (!code || code.length !== 3) continue;
          const cellVal = (row[j + 1] || '').toString().trim();
          if (!cellVal) continue;
          // Parse "Required | Note text" format
          const parts = cellVal.split('|').map(s => s.trim());
          const status = STATUS_OPTIONS.includes(parts[0]) ? parts[0] : null;
          if (!status) continue;
          const note = parts[1] || '';
          const ex = airportReqs.find(a => a.requirement_id === req.id && a.airport_code === code);
          if (ex) await supabase.from('airport_requirements').update({ status, custom_note: note, updated_by: userId, updated_at: now }).eq('id', ex.id);
          else await supabase.from('airport_requirements').insert({ requirement_id: req.id, airport_code: code, status, custom_note: note, updated_by: userId, updated_at: now });
          updated++;
        }
        setImportProgress(Math.round((i / totalRows) * 100));
      }
      flash('success', `Imported: ${updated} cells updated.`);
      await loadData();
    } catch (err) { flash('warning', 'Import error: ' + err.message); }
    finally { setImportProgress(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const timeAgo = d => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
  const filteredAirports = airports.filter(c => !searchStation || c.includes(searchStation.toUpperCase()) || getAirportShort(c).toUpperCase().includes(searchStation.toUpperCase()));
  const filteredReqs = requirements.filter(r => !searchDoc || r.document_name.toLowerCase().includes(searchDoc.toLowerCase()));

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  const CELL_W = 110;

  return (
    <>
      {message.text && <div className={`alert alert--${message.type}`}>{message.text}</div>}

      {showUserPrompt && (
        <div className="modal-overlay"><div className="modal" onClick={e => e.stopPropagation()}>
          <h3 className="modal__title" style={{ color: 'var(--united-blue)' }}>{userId ? 'Change ID' : 'Identification Required'}</h3>
          <div className="modal__body">
            <p>{userId ? 'Enter new ID.' : 'Enter your V or U number. All edits tracked.'}</p>
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
          <h2 className="card__header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Station Matrix</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {userId && <span>ID: <strong style={{ color: 'var(--united-blue)' }}>{userId}</strong> <button onClick={() => setShowUserPrompt(true)} style={{ background: 'none', border: 'none', color: 'var(--united-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>change</button></span>}
            <button className="btn btn--outline btn--sm" onClick={() => setExpanded(!expanded)}>{expanded ? '✕ Close' : '⛶ Expand'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: '1 1 150px' }}><label className="form-label">Search Docs</label><input type="text" className="form-input" placeholder="Filter..." value={searchDoc} onChange={e => setSearchDoc(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '1 1 150px' }}><label className="form-label">Search Stations</label><input type="text" className="form-input" placeholder="Filter..." value={searchStation} onChange={e => setSearchStation(e.target.value)} /></div>
          <div className="form-group" style={{ flex: '0 0 90px' }}><label className="form-label">Add</label><input type="text" className="form-input" placeholder="BQN" maxLength={3} value={newAirport} onChange={e => setNewAirport(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleAddAirport()} /></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1, flexWrap: 'wrap' }}>
            <button className="btn btn--primary btn--sm" onClick={handleAddAirport}>+ Station</button>
            <button className="btn btn--outline btn--sm" onClick={() => setShowCustomForm(!showCustomForm)}>{showCustomForm ? 'Cancel' : '+ Custom'}</button>
            <button className="btn btn--outline btn--sm" onClick={handleExport}>Export</button>
            <button className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()}>Import</button>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Import progress bar */}
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

        {filteredAirports.length > 0 ? (
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: expanded ? 'calc(100vh - 220px)' : '65vh', border: '1px solid var(--medium-tonal-grey)', borderRadius: 10, flex: expanded ? 1 : undefined }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 220 + filteredAirports.length * CELL_W }}>
              <thead><tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 10, background: '#051464', color: 'white', padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, width: 220, minWidth: 220, borderBottom: '2px solid var(--medium-tonal-grey)' }}>Document</th>
                {filteredAirports.map(c => (
                  <th key={c} style={{ position: 'sticky', top: 0, zIndex: 5, background: '#051464', color: 'white', padding: '6px 6px', textAlign: 'center', fontWeight: 700, fontSize: 11, width: CELL_W, minWidth: CELL_W, borderBottom: '2px solid var(--medium-tonal-grey)', borderLeft: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 13 }}>{c}</div>
                    <div style={{ fontSize: 8, opacity: 0.7, marginTop: 1 }}>{getAirportShort(c).split('(')[0].trim().slice(0, 18)}</div>
                    <button onClick={() => handleDeleteAirport(c)} style={{ position: 'absolute', top: 3, right: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11 }}>×</button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredReqs.map((req, idx) => {
                  const bg = idx % 2 === 0 ? 'var(--surface-card)' : 'var(--medium-tonal-grey-20)';
                  return (
                    <tr key={req.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: bg, padding: '8px 12px', borderBottom: '1px solid var(--medium-tonal-grey)', fontWeight: 500, fontSize: 13, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                        {req.document_name}{req.description && <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 1 }}>{req.description}</div>}
                      </td>
                      {filteredAirports.map(c => {
                        const st = getStatus(req.id, c), nt = getNote(req.id, c), ub = getUpdatedBy(req.id, c), ua = getUpdatedAt(req.id, c);
                        const sc = STATUS_COLORS[st]; const isEd = editCell?.reqId === req.id && editCell?.code === c;
                        return (
                          <td key={c} style={{ padding: '4px 5px', textAlign: 'center', verticalAlign: 'top', borderBottom: '1px solid var(--medium-tonal-grey)', borderLeft: '1px solid var(--medium-tonal-grey-50)', background: bg, position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                              <button onClick={() => setEditCell(isEd ? null : { reqId: req.id, code: c })} style={{ width: '100%', padding: '4px 2px', borderRadius: 4, border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>{STATUS_SHORT[st]}</button>
                              {isEd && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--surface-card)', border: '1px solid var(--medium-tonal-grey)', borderRadius: 8, boxShadow: 'var(--shadow-3)', padding: 6, minWidth: 140, marginTop: 2 }}>
                                  {STATUS_OPTIONS.map(o => { const os = STATUS_COLORS[o]; return <button key={o} onClick={() => handleUpdateStatus(req.id, c, o)} style={{ display: 'block', width: '100%', padding: '6px 8px', marginBottom: 2, border: st === o ? `2px solid ${os.border}` : '1px solid var(--medium-tonal-grey-50)', borderRadius: 6, background: st === o ? os.bg : 'var(--surface-card)', color: os.color, fontWeight: 600, fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>{o}</button>; })}
                                  <input type="text" placeholder="Note..." defaultValue={nt} onBlur={e => { if (e.target.value !== nt) handleUpdateNote(req.id, c, e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') { handleUpdateNote(req.id, c, e.target.value); setEditCell(null); } }} style={{ width: '100%', marginTop: 4, padding: '5px 6px', fontSize: 11, border: '1px solid var(--medium-tonal-grey)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-primary)' }} />
                                </div>
                              )}
                            </div>
                            {nt && !isEd && <div title={nt} style={{ fontSize: 8, color: 'var(--united-blue)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nt}</div>}
                            {ub && <div style={{ fontSize: 7, color: 'var(--text-disabled)', marginTop: 2 }}>{ub} · {timeAgo(ua)}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="alert alert--info">{searchStation ? 'No match.' : 'No stations yet.'}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-disabled)' }}>
          <span>{filteredReqs.length} docs × {filteredAirports.length} stations</span>
          <span>{airports.length} total</span>
        </div>
      </div>
      {editCell && <div onClick={() => setEditCell(null)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}
    </>
  );
}
