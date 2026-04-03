import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';
import { getAirportDisplay } from '../lib/airportCodes';
import { useStation } from '../lib/StationContext';

export default function HistoryPage() {
  const { homeStation } = useStation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [searchAwb, setSearchAwb] = useState('');
  const [searchAgent, setSearchAgent] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleted90, setDeleted90] = useState(0);

  useEffect(() => { cleanup90Days(); loadTransactions(); }, []);

  const cleanup90Days = async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data } = await supabase.from('checklist_transactions').delete().lt('submitted_at', cutoff).select('id');
      if (data && data.length > 0) setDeleted90(data.length);
    } catch (e) { console.error('Cleanup error:', e); }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase.from('checklist_transactions').select('*').order('submitted_at', { ascending: false }).limit(200);
      if (homeStation) query = query.or(`origin.eq.${homeStation.toUpperCase()},destination.eq.${homeStation.toUpperCase()}`);
      const { data } = await query;
      setTransactions(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = transactions.filter(t => {
    if (searchAwb && !t.awb_number.toLowerCase().includes(searchAwb.toLowerCase())) return false;
    if (searchAgent && !(t.employee_id || '').toLowerCase().includes(searchAgent.toLowerCase())) return false;
    if (filterDest && t.destination !== filterDest.toUpperCase()) return false;
    if (filterStatus === 'verified' && !t.all_verified) return false;
    if (filterStatus === 'missing' && t.all_verified) return false;
    return true;
  });

  const handleReprint = (tx) => {
    const pdf = generateChecklistPDF({ awbNumber: tx.awb_number, origin: tx.origin, originDisplay: getAirportDisplay(tx.origin), destination: tx.destination, destinationDisplay: getAirportDisplay(tx.destination), routing: tx.routing, flightNumbers: tx.flight_numbers, shipmentType: tx.shipment_type, remainsType: tx.remains_type, checklistItems: tx.checklist_items, notes: '', employeeId: tx.employee_id || '', submittedAt: tx.submitted_at });
    window.open(URL.createObjectURL(pdf.output('blob')), '_blank');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  const dests = [...new Set(transactions.map(t => t.destination))].sort();

  return (
    <div className="card">
      <h2 className="card__header">Transaction History {homeStation && `— ${homeStation}`}</h2>
      {deleted90 > 0 && <div className="alert alert--info">Auto-cleaned {deleted90} records older than 90 days.</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" className="form-input" placeholder="Search AWB..." value={searchAwb} onChange={e => setSearchAwb(e.target.value)} style={{ flex: '1 1 140px' }} />
        <input type="text" className="form-input" placeholder="Search Agent ID..." value={searchAgent} onChange={e => setSearchAgent(e.target.value)} style={{ flex: '1 1 130px' }} />
        <select className="form-select" value={filterDest} onChange={e => setFilterDest(e.target.value)} style={{ flex: '0 0 120px' }}>
          <option value="">All Dest</option>{dests.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '0 0 120px' }}>
          <option value="">All Status</option><option value="verified">Verified</option><option value="missing">Has Missing</option>
        </select>
        <button className="btn btn--outline btn--sm" onClick={() => { setSearchAwb(''); setSearchAgent(''); setFilterDest(''); setFilterStatus(''); }}>Clear</button>
      </div>

      {filtered.length === 0 ? <div className="alert alert--info">No transactions found.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th>Date/Time</th><th>AWB</th><th>Origin</th><th>Dest</th><th>Type</th><th>Status</th><th>Agent</th><th></th></tr></thead>
            <tbody>
              {filtered.map(tx => (
                <React.Fragment key={tx.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(tx.submitted_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{tx.awb_number}</strong></td><td>{tx.origin}</td><td>{tx.destination}</td>
                    <td style={{ fontSize: 12 }}>{tx.remains_type}</td>
                    <td><span className={`status-badge ${tx.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>{tx.all_verified ? 'Verified' : 'Missing'}</span></td>
                    <td>{tx.employee_id || '—'}</td>
                    <td><button className="btn btn--outline btn--sm" onClick={e => { e.stopPropagation(); handleReprint(tx); }}>Reprint</button></td>
                  </tr>
                  {expanded === tx.id && (
                    <tr><td colSpan={8} style={{ padding: 16, background: 'var(--medium-tonal-grey-20)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div><span className="form-label">Routing: </span>{tx.routing || '—'}</div>
                        <div><span className="form-label">Flights: </span>{tx.flight_numbers || '—'}</div>
                        <div><span className="form-label">Submitted: </span>{new Date(tx.submitted_at).toLocaleString()}</div>
                        <div><span className="form-label">Agent: </span><strong>{tx.employee_id || '—'}</strong></div>
                      </div>
                      <table className="checklist-table" style={{ fontSize: 13 }}>
                        <thead><tr><th>Document</th><th>Status</th><th>Verification</th></tr></thead>
                        <tbody>{(tx.checklist_items || []).map((item, i) => (
                          <tr key={i}><td>{item.document_name}{item.custom_note && <span style={{ color: 'var(--united-blue)', marginLeft: 6, fontSize: 11 }}>⚠ {item.custom_note}</span>}</td>
                            <td>{item.status}</td><td><span style={{ color: item.verification === 'Missing' ? 'var(--alert-red)' : 'var(--alert-green)', fontWeight: 600 }}>{item.verification}</span></td></tr>
                        ))}</tbody>
                      </table>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-disabled)' }}>{filtered.length} of {transactions.length} transactions shown</div>
    </div>
  );
}
