import React, { useState } from 'react';
import {
  Building, User, Mail, Phone, Ticket, Clock, CheckCircle,
  Search, ShieldAlert, ChevronRight, HelpCircle, Calendar
} from 'lucide-react';

export default function ClientManager({ clients, tickets, staff, onRefresh }) {
  const [selectedClient, setSelectedClient] = useState(clients[0] || null);
  const [searchTerm, setSearchTerm] = useState('');

  // Handle client selection
  const handleSelectClient = (client) => {
    setSelectedClient(client);
  };

  // Filter clients by search term
  const filteredClients = clients.filter(c =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Tickets for the selected client
  const clientTickets = selectedClient
    ? tickets.filter(t => t.company_id === selectedClient.client_id)
    : [];

  // Summary Metrics calculations for all clients
  const totalClients = clients.length;
  const totalClientTickets = tickets.length;
  const pendingClientTickets = tickets.filter(t => t.status === 'Pending').length;
  const resolvedClientTickets = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Summary Metrics Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-info">
            <h3>Registered Clients</h3>
            <span className="metric-value">{totalClients}</span>
          </div>
          <div className="metric-icon-box">
            <Building size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>Total Client Tickets</h3>
            <span className="metric-value">{totalClientTickets}</span>
          </div>
          <div className="metric-icon-box">
            <Ticket size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>Pending Support</h3>
            <span className="metric-value" style={{ color: '#ff7675' }}>{pendingClientTickets}</span>
          </div>
          <div className="metric-icon-box" style={{ color: '#ff7675', backgroundColor: 'rgba(255, 118, 117, 0.1)' }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>Resolved Support</h3>
            <span className="metric-value" style={{ color: '#00b894' }}>{resolvedClientTickets}</span>
          </div>
          <div className="metric-icon-box" style={{ color: '#00b894', backgroundColor: 'rgba(0, 184, 148, 0.1)' }}>
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '2rem', height: 'calc(100vh - 160px)' }}>

        {/* Left Panel: Client List */}
        <div className="card-widget" style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'Outfit' }}>Client Registry</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--fg-muted))' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search company or contact..."
                style={{ paddingLeft: '2rem', fontSize: '0.8rem', height: '34px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredClients.length === 0 ? (
              <p style={{ color: 'hsl(var(--fg-secondary))', textAlign: 'center', fontSize: '0.85rem', padding: '1rem' }}>No clients found.</p>
            ) : (
              filteredClients.map(client => {
                const initials = (client.company_name?.[0] || 'C').toUpperCase();
                const isSelected = selectedClient && selectedClient.client_id === client.client_id;

                // Count tickets for this specific client
                const thisClientTickets = tickets.filter(t => t.company_id === client.client_id);
                const thisClientResolved = thisClientTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

                return (
                  <div
                    key={client.client_id}
                    onClick={() => handleSelectClient(client)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                      border: isSelected ? '1px solid rgba(var(--primary-rgb), 0.3)' : '1px solid transparent',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div className="avatar" style={{
                      border: 'none',
                      backgroundColor: isSelected ? 'hsl(var(--primary))' : 'rgba(var(--primary-rgb), 0.15)',
                      color: isSelected ? '#fff' : 'hsl(var(--primary))'
                    }}>
                      {initials}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'hsl(var(--fg-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.company_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.contact_person}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'hsl(var(--fg-primary))' }}>
                        {thisClientResolved}/{thisClientTickets.length}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'hsl(var(--fg-muted))' }}>Tickets</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Client Details & Tickets Log */}
        {selectedClient ? (
          <div className="card-widget" style={{ height: '100%', overflowY: 'auto', gap: '1.5rem' }}>

            {/* Header profile details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div className="avatar" style={{
                  width: '60px', height: '60px', fontSize: '1.5rem',
                  backgroundColor: 'rgba(var(--primary-rgb), 0.15)', border: 'none'
                }}>
                  {(selectedClient.company_name?.[0] || 'C').toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Outfit' }}>{selectedClient.company_name}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={14} /> {selectedClient.contact_person}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={14} /> {selectedClient.email && !selectedClient.email.endsWith('@ticketmonitoring.local') ? selectedClient.email : 'No email provided'}</span>
                    {selectedClient.contact_number && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={14} /> {selectedClient.contact_number}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance/Status breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>

              {/* Profile Contact summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)' }}>
                <h4 style={{ fontFamily: 'Outfit', marginBottom: '0.25rem' }}>Client Profile Details</h4>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))' }}>Company:</span>
                    <span style={{ fontWeight: 600 }}>{selectedClient.company_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))' }}>Representative:</span>
                    <span style={{ fontWeight: 600 }}>{selectedClient.contact_person}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))' }}>Email:</span>
                    <span style={{ fontWeight: 600 }}>{selectedClient.email && !selectedClient.email.endsWith('@ticketmonitoring.local') ? selectedClient.email : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))' }}>Phone:</span>
                    <span style={{ fontWeight: 600 }}>{selectedClient.contact_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Client statistics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)', justifyContent: 'center' }}>
                <h4 style={{ fontFamily: 'Outfit' }}>Ticket Statistics</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit' }}>
                      {clientTickets.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Total</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit', color: '#ff7675' }}>
                      {clientTickets.filter(t => t.status === 'Pending').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Pending</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit', color: '#00b894' }}>
                      {clientTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Resolved</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Client Tickets Log table */}
            <div>
              <h4 style={{ fontFamily: 'Outfit', marginBottom: '0.75rem' }}>Client Ticket Log History</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Product</th>
                      <th>Concern</th>
                      <th>Requested Date</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Technician</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientTickets.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--fg-secondary))' }}>
                          No tickets submitted by this client.
                        </td>
                      </tr>
                    ) : (
                      clientTickets.map(ticket => {
                        const techName = ticket.technical_staff
                          ? `${ticket.technical_staff.firstname} ${ticket.technical_staff.lastname}`
                          : 'Unassigned';

                        return (
                          <tr key={ticket.ticket_id}>
                            <td style={{ fontWeight: 600 }}>#{ticket.ticket_id}</td>
                            <td>{ticket.products?.product_name || 'N/A'}</td>
                            <td>{ticket.concerns?.concern_name || 'N/A'}</td>
                            <td>{new Date(ticket.date_requested).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge badge-${ticket.priority?.toLowerCase()}`}>
                                {ticket.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                                {ticket.status}
                              </span>
                            </td>
                            <td style={{ fontStyle: ticket.technical_staff ? 'normal' : 'italic', color: ticket.technical_staff ? 'inherit' : 'hsl(var(--fg-muted))' }}>
                              {techName}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="card-widget" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--fg-secondary))' }}>
            Select a client from the sidebar registry to inspect details.
          </div>
        )}

      </div>

    </div>
  );
}
