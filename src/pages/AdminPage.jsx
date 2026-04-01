import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminPage() {
  const [requirements, setRequirements] = useState([]);
  const [airportReqs, setAirportReqs] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newReq, setNewReq] = useState({ document_name: '', description: '', applies_to: 'BOTH' });
  const [newAirport, setNewAirport] = useState('');
  const [selectedAirport, setSelectedAirport] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqs } = await supabase.from('requirements_matrix').select('*').order('sort_order', { ascending: true });
      const { data: airReqs } = await supabase.from('airport_requirements').select('*');
      const { data: defs } = await supabase.from('default_requirements').select('*');
      setRequirements(reqs || []);
      setAirportReqs(airReqs || []);
      setDefaults(defs || []);
      const codes = [...new Set((airReqs || []).map((a) => a.airport_code))].sort();
      setAirports(codes);
      if (codes.length > 0 && !selectedAirport) setSelectedAirport(codes[0]);
    } catch (err) {
      setMessage({ type: 'warning', text: 'Failed to load: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedAirport]);

  useEffect(() => { loadData(); }, []);

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
      setMessage({ type: 'success', text: 'Requirement added.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'warning', text: 'Error: ' + err.message });
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (req) => {
    try {
      await supabase.from('requirements_matrix').update({ is_active: !req.is_active }).eq('id', req.id);
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
  };

  const handleDeleteRequirement = async (id) => {
    if (!confirm('Delete this requirement?')) return;
    try {
      await supabase.from('requirements_matrix').delete().eq('id', id);
      setMessage({ type: 'success', text: 'Deleted.' });
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
  };

  const handleUpdateDefault = async (requirementId, newStatus) => {
    try {
      const existing = defaults.find((d) => d.requirement_id === requirementId);
      if (existing) {
        await supabase.from('default_requirements').update({ status: newStatus }).eq('id', existing.id);
      } else {
        await supabase.from('default_requirements').insert({ requirement_id: requirementId, status: newStatus });
      }
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
  };

  const handleAddAirport = async () => {
    const code = newAirport.toUpperCase().trim();
    if (code.length !== 3) { setMessage({ type: 'warning', text: 'Code must be 3 characters.' }); return; }
    if (airports.includes(code)) { setMessage({ type: 'warning', text: 'Already exists.' }); return; }
    setSaving(true);
    try {
      const inserts = requirements.filter((r) => r.is_active).map((r) => ({
        requirement_id: r.id, airport_code: code, status: 'Required',
      }));
      const { error } = await supabase.from('airport_requirements').insert(inserts);
      if (error) throw error;
      setNewAirport('');
      setSelectedAirport(code);
      setMessage({ type: 'success', text: `Airport ${code} added.` });
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
    finally { setSaving(false); }
  };

  const handleUpdateAirportReq = async (requirementId, airportCode, newStatus) => {
    try {
      const existing = airportReqs.find((a) => a.requirement_id === requirementId && a.airport_code === airportCode);
      if (existing) {
        await supabase.from('airport_requirements').update({ status: newStatus }).eq('id', existing.id);
      } else {
        await supabase.from('airport_requirements').insert({ requirement_id: requirementId, airport_code: airportCode, status: newStatus });
      }
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
  };

  const handleDeleteAirport = async (code) => {
    if (!confirm(`Delete all requirements for ${code}?`)) return;
    try {
      await supabase.from('airport_requirements').delete().eq('airport_code', code);
      setSelectedAirport('');
      setMessage({ type: 'success', text: `${code} removed.` });
      await loadData();
    } catch (err) { setMessage({ type: 'warning', text: 'Error: ' + err.message }); }
  };

  const getDefaultStatus = (reqId) => { const d = defaults.find((d) => d.requirement_id === reqId); return d?.status || 'Required'; };
  const getAirportStatus = (reqId, code) => { const a = airportReqs.find((a) => a.requirement_id === reqId && a.airport_code === code); return a?.status || 'Required'; };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <>
      {message.text && (
        <div className={`alert alert--${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      <div className="card">
        <h2 className="card__header">Add New Document Requirement</h2>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Document Name *</label>
            <input type="text" className="form-input" placeholder="e.g. Consular Authorization" value={newReq.document_name} onChange={(e) => setNewReq((p) => ({ ...p, document_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Applies To</label>
            <select className="form-select" value={newReq.applies_to} onChange={(e) => setNewReq((p) => ({ ...p, applies_to: e.target.value }))}>
              <option value="BOTH">Both (HR & ASH)</option>
              <option value="HUMAN_REMAINS">Human Remains Only</option>
              <option value="HUMAN_REMAINS_ASH">ASH Only</option>
              <option value="ALL">All Types</option>
            </select>
          </div>
          <div className="form-group form-group--full">
            <label className="form-label">Description</label>
            <input type="text" className="form-input" placeholder="Brief description" value={newReq.description} onChange={(e) => setNewReq((p) => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleAddRequirement} disabled={saving}>{saving ? 'Saving...' : 'Add Requirement'}</button>
        </div>
      </div>

      <div className="card">
        <h2 className="card__header">Document Requirements & Default Statuses</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Document</th><th>Applies To</th><th style={{ width: 160 }}>Default Status</th><th style={{ width: 60 }}>Active</th><th style={{ width: 70 }}>Actions</th></tr></thead>
            <tbody>
              {requirements.map((req, idx) => (
                <tr key={req.id} style={{ opacity: req.is_active ? 1 : 0.5 }}>
                  <td>{idx + 1}</td>
                  <td><strong>{req.document_name}</strong>{req.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{req.description}</div>}</td>
                  <td style={{ fontSize: '0.82rem' }}>{req.applies_to}</td>
                  <td><select value={getDefaultStatus(req.id)} onChange={(e) => handleUpdateDefault(req.id, e.target.value)}><option value="Required">Required</option><option value="Required - Copies OK">Required - Copies OK</option><option value="Not Required">Not Required</option></select></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={req.is_active} onChange={() => handleToggleActive(req)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></td>
                  <td><button className="btn btn--danger btn--sm" onClick={() => handleDeleteRequirement(req.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card__header">Airport-Specific Requirements</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '0 0 120px' }}>
            <label className="form-label">Add Airport</label>
            <input type="text" className="form-input" placeholder="e.g. NRT" maxLength={3} value={newAirport} onChange={(e) => setNewAirport(e.target.value.toUpperCase())} />
          </div>
          <button className="btn btn--gold btn--sm" onClick={handleAddAirport} disabled={saving} style={{ marginBottom: 1 }}>+ Add</button>
          {airports.length > 0 && (
            <>
              <div className="form-group" style={{ flex: '0 0 160px', marginLeft: 24 }}>
                <label className="form-label">View Airport</label>
                <select className="form-select" value={selectedAirport} onChange={(e) => setSelectedAirport(e.target.value)}>
                  {airports.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
              <button className="btn btn--danger btn--sm" onClick={() => handleDeleteAirport(selectedAirport)} style={{ marginBottom: 1 }}>Delete {selectedAirport}</button>
            </>
          )}
        </div>
        {selectedAirport && (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Document</th><th style={{ width: 200 }}>Status for {selectedAirport}</th></tr></thead>
              <tbody>
                {requirements.filter((r) => r.is_active).map((req) => (
                  <tr key={req.id}>
                    <td>{req.document_name}</td>
                    <td><select value={getAirportStatus(req.id, selectedAirport)} onChange={(e) => handleUpdateAirportReq(req.id, selectedAirport, e.target.value)}><option value="Required">Required</option><option value="Required - Copies OK">Required - Copies OK</option><option value="Not Required">Not Required</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {airports.length === 0 && (
          <div className="alert alert--info">No airport-specific requirements configured. Add an airport code above. Destinations without configurations will use the default checklist.</div>
        )}
      </div>
    </>
  );
}
