import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const APPLIES_OPTIONS = [{ value: 'BOTH', label: 'Both (HR & ASH)' }, { value: 'HUMAN_REMAINS', label: 'Human Remains' }, { value: 'HUMAN_REMAINS_ASH', label: 'Human Remains - ASH' }];
const APPLIES_LABELS = { BOTH: 'Both', HUMAN_REMAINS: 'Human Remains', HUMAN_REMAINS_ASH: 'ASH' };

function formatAwb(v) { const d = v.replace(/[^0-9]/g, ''); return d.length <= 3 ? d : d.slice(0, 3) + '-' + d.slice(3, 11); }

export default function AdminPage() {
  const [requirements, setRequirements] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newReq, setNewReq] = useState({ document_name: '', description: '', applies_to: 'BOTH' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ document_name: '', description: '', applies_to: '' });
  const [searchAwb, setSearchAwb] = useState('');
  const [txResults, setTxResults] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').order('sort_order', { ascending: true });
      const { data: defs } = await supabase.from('default_requirements').select('*');
      setRequirements(reqs || []); setDefaults(defs || []);
    } catch (err) { flash('warning', err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadData(); }, []);

  const flash = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 5000); };

  const handleAdd = async () => {
    if (!newReq.document_name.trim()) return; setSaving(true);
    try {
      const ms = requirements.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
      const { data, error } = await supabase.from('requirements_matrix').insert({ document_name: newReq.document_name, description: newReq.description, applies_to: newReq.applies_to, sort_order: ms + 1, is_active: true }).select().single();
      if (error) throw error;
      await supabase.from('default_requirements').insert({ requirement_id: data.id, status: 'Required' });
      setNewReq({ document_name: '', description: '', applies_to: 'BOTH' }); flash('success', 'Added.'); await loadData();
    } catch (e) { flash('warning', e.message); } finally { setSaving(false); }
  };

  const startEdit = r => { setEditingId(r.id); setEditForm({ document_name: r.document_name, description: r.description || '', applies_to: r.applies_to }); };
  const saveEdit = async id => {
    if (!editForm.document_name.trim()) return; setSaving(true);
    try { await supabase.from('requirements_matrix').update({ document_name: editForm.document_name, description: editForm.description, applies_to: editForm.applies_to }).eq('id', id); setEditingId(null); flash('success', 'Updated.'); await loadData(); }
    catch (e) { flash('warning', e.message); } finally { setSaving(false); }
  };

  const handleToggle = async r => { await supabase.from('requirements_matrix').update({ is_active: !r.is_active }).eq('id', r.id); await loadData(); };
  const handleDelete = async id => { if (!confirm('Delete?')) return; await supabase.from('requirements_matrix').delete().eq('id', id); flash('success', 'Deleted.'); await loadData(); };
  const handleUpdateDefault = async (rid, s) => {
    const ex = defaults.find(d => d.requirement_id === rid);
    if (ex) await supabase.from('default_requirements').update({ status: s }).eq('id', ex.id);
    else await supabase.from('default_requirements').insert({ requirement_id: rid, status: s });
    await loadData();
  };
  const getDefault = rid => defaults.find(d => d.requirement_id === rid)?.status || 'Required';

  const handleSearchAwb = async () => {
    if (!searchAwb.trim()) { setTxResults([]); return; }
    const clean = searchAwb.replace(/[^0-9-]/g, '');
    const { data } = await supabase.from('checklist_transactions').select('*').ilike('awb_number', `%${clean}%`).order('submitted_at', { ascending: false }).limit(50);
    setTxResults(data || []);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  return (
    <>
      {message.text && <div className={`alert alert--${message.type}`}>{message.text}<button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button></div>}

      <div className="card">
        <h2 className="card__header">Search Transactions (All Stations)</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="text" className="form-input" placeholder="AWB: XXX-XXXXXXXX"
            value={searchAwb} onChange={e => setSearchAwb(formatAwb(e.target.value))} maxLength={12}
            onKeyDown={e => e.key === 'Enter' && handleSearchAwb()} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" onClick={handleSearchAwb}>Search</button>
          {txResults.length > 0 && <button className="btn btn--outline btn--sm" onClick={() => { setSearchAwb(''); setTxResults([]); }}>Clear</button>}
        </div>
        {txResults.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="admin-table"><thead><tr><th>Date</th><th>AWB</th><th>Origin</th><th>Dest</th><th>Agent</th><th>Status</th></tr></thead>
              <tbody>{txResults.map(t => (
                <tr key={t.id}><td style={{ fontSize: 12 }}>{new Date(t.submitted_at).toLocaleString()}</td><td><strong>{t.awb_number}</strong></td><td>{t.origin}</td><td>{t.destination}</td><td>{t.employee_id || '—'}</td>
                  <td><span className={`status-badge ${t.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>{t.all_verified ? 'Verified' : 'Missing'}</span></td></tr>
              ))}</tbody></table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card__header">Add New Document Requirement</h2>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Document Name *</label><input type="text" className="form-input" placeholder="e.g. Consular Authorization" value={newReq.document_name} onChange={e => setNewReq(p => ({ ...p, document_name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Applies To</label><select className="form-select" value={newReq.applies_to} onChange={e => setNewReq(p => ({ ...p, applies_to: e.target.value }))}>{APPLIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className="form-group form-group--full"><label className="form-label">Description</label><input type="text" className="form-input" placeholder="Brief description" value={newReq.description} onChange={e => setNewReq(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
        <div className="button-row"><button className="btn btn--primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button></div>
      </div>

      <div className="card">
        <h2 className="card__header">Document Requirements & Default Statuses</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table"><thead><tr><th style={{ width: 36 }}>#</th><th>Document</th><th style={{ width: 100 }}>Applies To</th><th style={{ width: 155 }}>Default</th><th style={{ width: 50 }}>Active</th><th style={{ width: 120 }}></th></tr></thead>
            <tbody>{requirements.map((r, i) => {
              const ed = editingId === r.id;
              return (<tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.45 }}><td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{ed ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><input type="text" className="form-input" value={editForm.document_name} onChange={e => setEditForm(p => ({ ...p, document_name: e.target.value }))} autoFocus style={{ fontWeight: 600 }} /><input type="text" className="form-input" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ fontSize: 12 }} /></div> : <><strong>{r.document_name}</strong>{r.description && <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{r.description}</div>}</>}</td>
                <td>{ed ? <select className="form-select" value={editForm.applies_to} onChange={e => setEditForm(p => ({ ...p, applies_to: e.target.value }))} style={{ fontSize: 12 }}>{APPLIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <span style={{ fontSize: 13 }}>{APPLIES_LABELS[r.applies_to] || r.applies_to}</span>}</td>
                <td><select value={getDefault(r.id)} onChange={e => handleUpdateDefault(r.id, e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={r.is_active} onChange={() => handleToggle(r)} style={{ cursor: 'pointer', width: 18, height: 18, accentColor: 'var(--united-blue)' }} /></td>
                <td>{ed ? <div style={{ display: 'flex', gap: 4 }}><button className="btn btn--primary btn--sm" onClick={() => saveEdit(r.id)}>Save</button><button className="btn btn--outline btn--sm" onClick={() => setEditingId(null)}>Cancel</button></div> : <div style={{ display: 'flex', gap: 4 }}><button className="btn btn--outline btn--sm" onClick={() => startEdit(r)}>Edit</button><button className="btn btn--danger btn--sm" onClick={() => handleDelete(r.id)}>Delete</button></div>}</td>
              </tr>);
            })}</tbody></table>
        </div>
      </div>
    </>
  );
}
