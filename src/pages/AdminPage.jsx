import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = ['Required', 'Required - Copies OK', 'Not Required'];
const APPLIES_LABELS = { BOTH: 'Both', HUMAN_REMAINS: 'Human Remains', HUMAN_REMAINS_ASH: 'ASH' };

export default function AdminPage() {
  const [requirements, setRequirements] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newReq, setNewReq] = useState({ document_name: '', description: '', applies_to: 'BOTH' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').order('sort_order', { ascending: true });
      const { data: defs } = await supabase.from('default_requirements').select('*');
      setRequirements(reqs || []);
      setDefaults(defs || []);
    } catch (err) {
      setMessage({ type: 'warning', text: 'Failed to load: ' + err.message });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

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
      flash('success', 'Requirement added.');
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (req) => {
    try {
      await supabase.from('requirements_matrix').update({ is_active: !req.is_active }).eq('id', req.id);
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
  };

  const handleDeleteRequirement = async (id) => {
    if (!confirm('Delete this requirement? This will remove it from all stations.')) return;
    try {
      await supabase.from('requirements_matrix').delete().eq('id', id);
      flash('success', 'Deleted.');
      await loadData();
    } catch (err) { flash('warning', 'Error: ' + err.message); }
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

      <div className="card">
        <h2 className="card__header">Document Requirements & Default Statuses</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          These are the default document requirements. To configure station-specific overrides,
          go to the <strong>Station Matrix</strong> page.
        </p>
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
                    {req.description && <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{req.description}</div>}
                  </td>
                  <td style={{ fontSize: 13 }}>{APPLIES_LABELS[req.applies_to] || req.applies_to}</td>
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
    </>
  );
}
