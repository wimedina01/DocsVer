import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const APPLIES_OPTIONS = [
  { value: 'BOTH', label: 'Both (HR & ASH)' },
  { value: 'HUMAN_REMAINS', label: 'Human Remains' },
  { value: 'HUMAN_REMAINS_ASH', label: 'Human Remains - ASH' },
];
const APPLIES_LABELS = { BOTH: 'Both', HUMAN_REMAINS: 'Human Remains', HUMAN_REMAINS_ASH: 'ASH' };

export default function AdminPage() {
  const [requirements, setRequirements] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newReq, setNewReq] = useState({ document_name: '', description: '', applies_to: 'BOTH' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ document_name: '', description: '', applies_to: '' });
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').order('sort_order', { ascending: true });
      const { data: defs } = await supabase.from('default_requirements').select('*');
      setRequirements(reqs || []); setDefaults(defs || []);
    } catch (err) { flash('warning', 'Failed to load: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  const flash = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 5000); };

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
      setNewReq({ document_name: '', description: '', applies_to: 'BOTH' });
      flash('success', 'Requirement added.'); await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const startEdit = (req) => { setEditingId(req.id); setEditForm({ document_name: req.document_name, description: req.description || '', applies_to: req.applies_to }); };
  const cancelEdit = () => { setEditingId(null); };
  const saveEdit = async (id) => {
    if (!editForm.document_name.trim()) { flash('warning', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await supabase.from('requirements_matrix').update({ document_name: editForm.document_name, description: editForm.description, applies_to: editForm.applies_to, updated_at: new Date().toISOString() }).eq('id', id);
      setEditingId(null); flash('success', 'Updated.'); await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (req) => {
    try { await supabase.from('requirements_matrix').update({ is_active: !req.is_active }).eq('id', req.id); await loadData(); }
    catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleDeleteRequirement = async (id) => {
    if (!confirm('Delete this requirement from all stations?')) return;
    try { await supabase.from('requirements_matrix').delete().eq('id', id); flash('success', 'Deleted.'); await loadData(); }
    catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleUpdateDefault = async (reqId, newStatus) => {
    try {
      const existing = defaults.find(d => d.requirement_id === reqId);
      if (existing) await supabase.from('default_requirements').update({ status: newStatus }).eq('id', existing.id);
      else await supabase.from('default_requirements').insert({ requirement_id: reqId, status: newStatus });
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const getDefaultStatus = (reqId) => defaults.find(d => d.requirement_id === reqId)?.status || 'Required';

  // ── Excel Export ──
  const handleExport = () => {
    const rows = requirements.map((r, i) => ({
      '#': i + 1,
      'Document Name': r.document_name,
      'Description': r.description || '',
      'Applies To': APPLIES_LABELS[r.applies_to] || r.applies_to,
      'Default Status': getDefaultStatus(r.id),
      'Active': r.is_active ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 40 }, { wch: 50 }, { wch: 16 }, { wch: 22 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requirements');
    XLSX.writeFile(wb, 'Document_Requirements.xlsx');
  };

  // ── Excel Import ──
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const appliesMap = { 'Both': 'BOTH', 'Human Remains': 'HUMAN_REMAINS', 'ASH': 'HUMAN_REMAINS_ASH', 'Both (HR & ASH)': 'BOTH' };

      let added = 0, updated = 0;
      for (const row of rows) {
        const name = (row['Document Name'] || '').trim();
        if (!name) continue;
        const desc = (row['Description'] || '').trim();
        const appliesTo = appliesMap[row['Applies To']] || 'BOTH';
        const defaultStatus = STATUS_OPTIONS.includes(row['Default Status']) ? row['Default Status'] : 'Required';
        const isActive = (row['Active'] || 'Yes').toLowerCase() !== 'no';

        // Check if exists
        const existing = requirements.find(r => r.document_name.toLowerCase() === name.toLowerCase());
        if (existing) {
          await supabase.from('requirements_matrix').update({ description: desc, applies_to: appliesTo, is_active: isActive }).eq('id', existing.id);
          const defRow = defaults.find(d => d.requirement_id === existing.id);
          if (defRow) await supabase.from('default_requirements').update({ status: defaultStatus }).eq('id', defRow.id);
          updated++;
        } else {
          const maxSort = requirements.reduce((max, r) => Math.max(max, r.sort_order || 0), 0) + added + 1;
          const { data: newRow } = await supabase.from('requirements_matrix').insert({
            document_name: name, description: desc, applies_to: appliesTo, sort_order: maxSort, is_active: isActive,
          }).select().single();
          if (newRow) await supabase.from('default_requirements').insert({ requirement_id: newRow.id, status: defaultStatus });
          added++;
        }
      }
      flash('success', `Import complete: ${added} added, ${updated} updated.`);
      await loadData();
    } catch (err) { flash('warning', 'Import error: ' + err.message); }
    finally { setSaving(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <>
      {message.text && (
        <div className={`alert alert--${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      <div className="card">
        <h2 className="card__header">Add New Document Requirement</h2>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Document Name *</label>
            <input type="text" className="form-input" placeholder="e.g. Consular Authorization" value={newReq.document_name} onChange={e => setNewReq(p => ({ ...p, document_name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Applies To</label>
            <select className="form-select" value={newReq.applies_to} onChange={e => setNewReq(p => ({ ...p, applies_to: e.target.value }))}>
              {APPLIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className="form-group form-group--full"><label className="form-label">Description</label>
            <input type="text" className="form-input" placeholder="Brief description" value={newReq.description} onChange={e => setNewReq(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleAddRequirement} disabled={saving}>{saving ? 'Saving...' : 'Add Requirement'}</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <h2 className="card__header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Document Requirements & Default Statuses</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--outline btn--sm" onClick={handleExport}>Export Excel</button>
            <button className="btn btn--outline btn--sm" onClick={() => fileInputRef.current?.click()}>Import Excel</button>
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, borderBottom: '2px solid var(--united-blue, #1414D2)', paddingBottom: 8 }}>
          Click <strong>Edit</strong> to fix typos. For station-specific overrides, go to <strong>Station Matrix</strong>.
          Use <strong>Export/Import</strong> to bulk update via Excel.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th style={{ width: 36 }}>#</th><th>Document</th><th style={{ width: 100 }}>Applies To</th><th style={{ width: 155 }}>Default Status</th><th style={{ width: 50 }}>Active</th><th style={{ width: 120 }}></th></tr></thead>
            <tbody>
              {requirements.map((req, idx) => {
                const isEditing = editingId === req.id;
                return (
                  <tr key={req.id} style={{ opacity: req.is_active ? 1 : 0.45 }}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input type="text" className="form-input" value={editForm.document_name} onChange={e => setEditForm(p => ({ ...p, document_name: e.target.value }))} autoFocus style={{ fontWeight: 600 }} />
                        <input type="text" className="form-input" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ fontSize: 12 }} />
                      </div>
                    ) : (<><strong>{req.document_name}</strong>{req.description && <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{req.description}</div>}</>)}</td>
                    <td>{isEditing ? (
                      <select className="form-select" value={editForm.applies_to} onChange={e => setEditForm(p => ({ ...p, applies_to: e.target.value }))} style={{ fontSize: 12 }}>
                        {APPLIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    ) : <span style={{ fontSize: 13 }}>{APPLIES_LABELS[req.applies_to] || req.applies_to}</span>}</td>
                    <td><select value={getDefaultStatus(req.id)} onChange={e => handleUpdateDefault(req.id, e.target.value)}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={req.is_active} onChange={() => handleToggleActive(req)} style={{ cursor: 'pointer', width: 18, height: 18, accentColor: 'var(--united-blue)' }} /></td>
                    <td>{isEditing ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn--primary btn--sm" onClick={() => saveEdit(req.id)} disabled={saving}>Save</button>
                        <button className="btn btn--outline btn--sm" onClick={cancelEdit}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn--outline btn--sm" onClick={() => startEdit(req)}>Edit</button>
                        <button className="btn btn--danger btn--sm" onClick={() => handleDeleteRequirement(req.id)}>Delete</button>
                      </div>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
