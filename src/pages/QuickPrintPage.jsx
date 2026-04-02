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
  const [emailTo, setEmailTo] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleLookup = async () => {
    if (!destination.trim()) { setError('Please enter a destination airport code.'); return; }
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
      if (result.length === 0) {
        result = filtered.map(r => ({ requirement_id: r.id, document_name: r.document_name, description: r.description, status: 'Required', custom_note: '', verification: '' }));
      }
      setItems(result);
    } catch (err) { setError('Failed to load: ' + err.message); }
    finally { setLoading(false); }
  };

  const buildPdf = () => {
    return generateBlankChecklistPDF({
      destination: destination.toUpperCase(),
      destinationDisplay: getAirportDisplay(destination),
      remainsType, checklistItems: items,
    });
  };

  const handlePrint = () => {
    const pdf = buildPdf();
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleEmail = () => {
    if (!emailTo.trim()) return;
    const pdf = buildPdf();
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    // Use mailto with a note — browsers can't attach files via mailto,
    // so we open the PDF in a new tab AND open the email client
    const subject = encodeURIComponent(`Document Requirements Checklist - ${getAirportDisplay(destination)}`);
    const body = encodeURIComponent(
      `Please find the Document Requirements Checklist for ${getAirportDisplay(destination)} (${remainsType}).\n\n` +
      `The checklist PDF has been opened in a separate tab. Please download and attach it to this email.\n\n` +
      `Generated: ${new Date().toLocaleString()}`
    );
    window.open(url, '_blank');
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 5000);
  };

  return (
    <>
      <div className="card">
        <h2 className="card__header">Quick Print — Document Requirements by Destination</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
          View and print a blank checklist based on destination requirements. No AWB or shipment details needed.
        </p>
        {error && <div className="alert alert--warning">{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Destination (ICAO Code) *</label>
            <input type="text" className="form-input" placeholder="e.g. NRT" maxLength={3}
              value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} />
          </div>
          <div className="form-group">
            <label className="form-label">Remains Type</label>
            <select className="form-select" value={remainsType} onChange={e => setRemainsType(e.target.value)}>
              <option>Human Remains</option><option>Human Remains - ASH</option>
            </select>
          </div>
        </div>
        <div className="button-row">
          <button className="btn btn--primary" onClick={handleLookup} disabled={loading}>
            {loading ? 'Loading...' : 'View Checklist'}
          </button>
        </div>
      </div>

      {items && (
        <div className="card">
          <h2 className="card__header">
            Checklist for {getAirportDisplay(destination)} — {remainsType}
          </h2>

          <table className="checklist-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Document</th>
                <th style={{ width: 160 }}>Requirement</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.requirement_id || idx}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.document_name}</div>
                    {item.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>}
                    {item.custom_note && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#EBF2FE', border: '1px solid #276EF1', borderLeft: '4px solid #1414D2', borderRadius: 4, fontSize: '0.82rem', color: '#051464', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '1rem' }}>&#9888;</span>{item.custom_note}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${item.status === 'Required' ? 'status-badge--required' : item.status === 'Required - Copies OK' ? 'status-badge--copies' : 'status-badge--not-required'}`}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Email section */}
          <div style={{ marginTop: 20, padding: 16, background: 'var(--medium-tonal-grey-20, #F5F5F4)', borderRadius: 10, border: '1px solid var(--medium-tonal-grey, #D7D7D4)' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Email Checklist</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Recipient Email</label>
                <input type="email" className="form-input" placeholder="name@united.com"
                  value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              </div>
              <button className="btn btn--primary btn--sm" onClick={handleEmail} disabled={!emailTo.trim()} style={{ marginBottom: 1 }}>
                Email & Open PDF
              </button>
            </div>
            {emailSent && <div className="alert alert--success" style={{ marginTop: 10, marginBottom: 0 }}>Email client opened. Please attach the PDF from the new tab.</div>}
          </div>

          <div className="button-row">
            <button className="btn btn--outline" onClick={() => { setItems(null); setEmailTo(''); }}>Clear</button>
            <button className="btn btn--primary" onClick={handlePrint}>Print Checklist PDF</button>
          </div>
        </div>
      )}
    </>
  );
}
