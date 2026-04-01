import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateChecklistPDF } from '../lib/pdfGenerator';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchAwb, setSearchAwb] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('checklist_transactions')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchAwb.trim()) { loadTransactions(); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('checklist_transactions')
        .select('*')
        .ilike('awb_number', `%${searchAwb.trim()}%`)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = (tx) => {
    const pdf = generateChecklistPDF({
      awbNumber: tx.awb_number,
      origin: tx.origin,
      destination: tx.destination,
      routing: tx.routing,
      flightNumbers: tx.flight_numbers,
      shipmentType: tx.shipment_type,
      remainsType: tx.remains_type,
      checklistItems: tx.checklist_items,
      notes: '',
      employeeId: tx.employee_id || '',
      submittedAt: tx.submitted_at,
    });
    pdf.save(`HR_Checklist_${tx.awb_number}_${tx.destination}_reprint.pdf`);
  };

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  return (
    <div className="card">
      <h2 className="card__header">Transaction History</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          type="text" className="form-input" placeholder="Search by AWB number..."
          style={{ flex: 1 }} value={searchAwb}
          onChange={(e) => setSearchAwb(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn--primary btn--sm" onClick={handleSearch}>Search</button>
        <button className="btn btn--outline btn--sm" onClick={() => { setSearchAwb(''); loadTransactions(); }}>Clear</button>
      </div>

      {transactions.length === 0 ? (
        <div className="alert alert--info">No transactions found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date/Time</th><th>AWB</th><th>Origin</th><th>Destination</th>
                <th>Type</th><th>Status</th><th>Agent</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <React.Fragment key={tx.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(tx.submitted_at).toLocaleString('en-US', {
                        month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td><strong>{tx.awb_number}</strong></td>
                    <td>{tx.origin}</td>
                    <td>{tx.destination}</td>
                    <td style={{ fontSize: '0.82rem' }}>{tx.remains_type}</td>
                    <td>
                      <span className={`status-badge ${tx.all_verified ? 'status-badge--not-required' : 'status-badge--required'}`}>
                        {tx.all_verified ? 'All Verified' : 'Has Missing'}
                      </span>
                    </td>
                    <td>{tx.employee_id || '—'}</td>
                    <td>
                      <button className="btn btn--outline btn--sm" onClick={(e) => { e.stopPropagation(); handleReprint(tx); }}>
                        Reprint
                      </button>
                    </td>
                  </tr>
                  {expanded === tx.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: 16, background: 'var(--surface-0)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div><span className="form-label">Routing: </span>{tx.routing || '—'}</div>
                          <div><span className="form-label">Flights: </span>{tx.flight_numbers || '—'}</div>
                          <div><span className="form-label">Shipment: </span>{tx.shipment_type}</div>
                        </div>
                        <table className="checklist-table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr><th>Document</th><th>Status</th><th>Verification</th></tr>
                          </thead>
                          <tbody>
                            {(tx.checklist_items || []).map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.document_name}</td>
                                <td>{item.status}</td>
                                <td>
                                  <span style={{
                                    color: item.verification === 'Missing' ? 'var(--red-alert)' : 'var(--green-ok)',
                                    fontWeight: 600,
                                  }}>{item.verification}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
