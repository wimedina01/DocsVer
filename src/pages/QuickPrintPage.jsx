import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateBlankChecklistPDF } from '../lib/blankPdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';

export default function QuickPrintPage() {
  const [destination, setDestination] = useState('');
  const [remainsType, setRemainsType] = useState('Human Remains');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(null);

  const handleLookup = async () => {
    if (!destination.trim()) { setError('Enter a destination code.'); return; }
    setError(''); setLoading(true);
    try {
      const dest = destination.toUpperCase().trim();
      const { data: requirements } = await supabase.from('requirements_matrix').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      const filtered = (requirements || []).filter(r => {
        if (r.applies_to === 'BOTH' || r.applies_to === 'ALL') return true;
        if (remainsType === 'Human Remains' && r.applies_to === 'HUMAN_REMAINS') return true;
        if (remainsType === 'Human Remains - ASH' && r.applies_to === 'HUMAN_REMAINS_ASH') return true;
        return false;
      });
      const { data: airportReqs } = await supabase.from('airport_requirements').select('requirement_id, status, custom_note').eq('airport_code', dest);
      let result;
      if (airportReqs && airportReqs.length > 0) {
        const m = new Map(airportReqs.map(a => [a.requirement_id, { status: a.status, custom_note: a.custom_note }]));
        result = filtered.filter(r => { const e = m.get(r.id); return e && e.status !== 'Not Required'; })
          .map(r => { const e = m.get(r.id); return { requirement_id: r.id, document_name: r.document_name, description: r.description, status: e.status, custom_note: e.custom_note || '', verification: '' }; });
      } else {
        const { data: defaults } = await supabase.from('default_requirements').select('requirement_id, status');
        const dm = new Map((defaults || []).map(d => [d.requirement_id, d.status]));
        result = filtered.filter(r => { const s = dm.get(r.id); return s && s !== 'Not Required'; })
          .map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: dm.get(r.id) || 'Required', custom_note: '', verification: '' }));
      }
      if (result.length === 0) result = filtered.map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: 'Required', custom_note: '', verification: '' }));
      setItems(result);
    } catch (err) { setError('Failed: ' + err.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const pdf = generateBlankChecklistPDF({ destination: destination.toUpperCase(), destinationDisplay: getAirportDisplay(destination), remainsType, checklistItems: items });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  return (
    <>
      <div className="card">
        <h2 className="card__header">Quick Print — Document Requirements</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>View and print a blank checklist by destination.</p>
        {error && <div className="alert alert--warning">{error}</div>}
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Destination *</label>
            <input type="text" className="form-input" placeholder="e.g. NRT" maxLength={3} value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} /></div>
          <div className="form-group"><label className="form-label">Remains Type</label>
            <select className="form-select" value={remainsType} onChange={e => setRemainsType(e.target.value)}>
              <option>Human Remains</option><option>Human Remains - ASH</option></select></div>
        </div>
        <div className="button-row"><button className="btn btn--primary" onClick={handleLookup} disabled={loading}>{loading ? 'Loading...' : 'View Checklist'}</button></div>
      </div>
      {items && (
        <div className="card">
          <h2 className="card__header">Checklist for {getAirportDisplay(destination)} — {remainsType}</h2>
          <table className="checklist-table">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Document</th><th style={{ width: 160 }}>Requirement</th></tr></thead>
            <tbody>{items.map((item, idx) => (
              <tr key={item.requirement_id || idx}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                  {item.description && <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>{item.description}</div>}
                  {item.custom_note && <div className="custom-note-banner"><span>&#9888;</span>{item.custom_note}</div>}
                </td>
                <td><span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : item.status === 'Required - Copies OK' ? 'status-badge--copies' : 'status-badge--not-required'}`}>{item.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="button-row">
            <button className="btn btn--outline" onClick={() => setItems(null)}>Clear</button>
            <button className="btn btn--primary" onClick={handlePrint}>Print Checklist PDF</button>
          </div>
        </div>
      )}
    </>
  );
}
