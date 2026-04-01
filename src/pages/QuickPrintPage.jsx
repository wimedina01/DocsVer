import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';

export default function QuickPrintPage() {
  const [destination, setDestination] = useState('');
  const [remainsType, setRemainsType] = useState('Human Remains');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(null);

  const handleLookup = async () => {
    if (!destination.trim()) {
      setError('Please enter a destination airport code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const dest = destination.toUpperCase().trim();

      const { data: requirements } = await supabase
        .from('requirements_matrix')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const filtered = (requirements || []).filter((r) => {
        if (r.applies_to === 'BOTH' || r.applies_to === 'ALL') return true;
        if (remainsType === 'Human Remains' && r.applies_to === 'HUMAN_REMAINS') return true;
        if (remainsType === 'Human Remains - ASH' && r.applies_to === 'HUMAN_REMAINS_ASH') return true;
        return false;
      });

      const { data: airportReqs } = await supabase
        .from('airport_requirements')
        .select('requirement_id, status')
        .eq('airport_code', dest);

      let result;
      if (airportReqs && airportReqs.length > 0) {
        const airportMap = new Map(airportReqs.map((ar) => [ar.requirement_id, ar.status]));
        result = filtered
          .filter((req) => {
            const status = airportMap.get(req.id);
            return status && status !== 'Not Required';
          })
          .map((req) => ({
            requirement_id: req.id,
            document_name: req.document_name,
            description: req.description,
            status: airportMap.get(req.id),
            verification: '',
          }));
      } else {
        const { data: defaults } = await supabase
          .from('default_requirements')
          .select('requirement_id, status');

        const defaultMap = new Map((defaults || []).map((d) => [d.requirement_id, d.status]));
        result = filtered
          .filter((req) => {
            const status = defaultMap.get(req.id);
            return status && status !== 'Not Required';
          })
          .map((req) => ({
            requirement_id: req.id,
            document_name: req.document_name,
            description: req.description,
            status: defaultMap.get(req.id) || 'Required',
            verification: '',
          }));
      }

      if (result.length === 0) {
        result = filtered.map((req) => ({
          requirement_id: req.id,
          document_name: req.document_name,
          description: req.description,
          status: 'Required',
          verification: '',
        }));
      }

      setItems(result);
    } catch (err) {
      setError('Failed to load: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBlank = () => {
    const pdf = generateChecklistPDF({
      awbNumber: '___-________',
      origin: '',
      originDisplay: '',
      destination: destination.toUpperCase(),
      destinationDisplay: getAirportDisplay(destination),
      routing: '',
      flightNumbers: '',
      shipmentType: '',
      remainsType,
      checklistItems: items,
      notes: '',
      employeeId: '',
      submittedAt: null,
    });
    pdf.save(`HR_Blank_Checklist_${destination.toUpperCase()}.pdf`);
  };

  return (
    <>
      <div className="card">
        <h2 className="card__header">Quick Print — Blank Checklist by Destination</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
          View and print a blank checklist based on destination requirements.
          No AWB or shipment details needed.
        </p>

        {error && <div className="alert alert--warning">{error}</div>}

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Destination (ICAO Code) *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. NRT"
              maxLength={3}
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Remains Type</label>
            <select
              className="form-select"
              value={remainsType}
              onChange={(e) => setRemainsType(e.target.value)}
            >
              <option>Human Remains</option>
              <option>Human Remains - ASH</option>
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
                    {item.description && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${
                      item.status === 'Required' ? 'status-badge--required'
                        : item.status === 'Required - Copies OK' ? 'status-badge--copies'
                        : 'status-badge--not-required'
                    }`}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="button-row">
            <button className="btn btn--outline" onClick={() => setItems(null)}>
              Clear
            </button>
            <button className="btn btn--primary" onClick={handlePrintBlank}>
              Print Blank Checklist PDF
            </button>
          </div>
        </div>
      )}
    </>
  );
}
