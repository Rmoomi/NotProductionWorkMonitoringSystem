import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, CheckSquare, Square, Mail, MapPin, UserCheck, Plus, Pencil, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import supabase from '../supabaseClient';
import { API_URL } from '../config';

export default function TechnicalManager({ staff, tickets, products, concerns, clients, onRefresh, adminUser }) {
  const [selectedTech, setSelectedTech] = useState(staff[0] || null);
  const [activeModal, setActiveModal] = useState(null); // 'add_edit' | 'quick_ticket'
  
  // Forms state
  const [techForm, setTechForm] = useState({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    contact_viber: '',
    branch: 'DAVAO',
    position: 'Technical'
  });

  const [quickTicketForm, setQuickTicketForm] = useState({
    company_id: '',
    product_id: '',
    concern_id: '',
    concern_description: '',
    priority: 'Medium'
  });

  const handleSelectTech = (tech) => {
    setSelectedTech(tech);
  };

  // Toggle active status via Node API
  const handleToggleActive = async (tech) => {
    const nextStatus = !tech.is_active;
    try {
      const response = await fetch(`${API_URL}/api/technical/${tech.technical_id}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: nextStatus,
          admin_id: adminUser?.technical_id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Refresh data
      onRefresh();
      // Update selected profile state
      setSelectedTech({ ...tech, is_active: nextStatus });
    } catch (err) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  // Update permissions via Node API
  const handlePermissionToggle = async (field, currentVal) => {
    if (!selectedTech) return;
    const nextVal = !currentVal;

    try {
      const response = await fetch(`${API_URL}/api/technical/${selectedTech.technical_id}/privileges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: nextVal,
          admin_id: adminUser?.technical_id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      onRefresh();
      setSelectedTech({ ...selectedTech, [field]: nextVal });
    } catch (err) {
      alert(`Failed to update privilege: ${err.message}`);
    }
  };

  // Add / Edit profile
  const handleAddEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeModal === 'add_edit' && !selectedTech?.technical_id) {
        // Check username uniqueness
        const cleanUsername = techForm.username.trim().toLowerCase();
        
        const { data: existingClient } = await supabase
          .from('clients')
          .select('username')
          .eq('username', cleanUsername)
          .maybeSingle();
        if (existingClient) {
          alert('Username is already taken by a client.');
          return;
        }

        const { data: existingStaff } = await supabase
          .from('technical_staff')
          .select('username')
          .eq('username', cleanUsername)
          .maybeSingle();
        if (existingStaff) {
          alert('Username is already taken by a staff member.');
          return;
        }

        if (!techForm.password || techForm.password.length < 6) {
          alert('Password must be at least 6 characters long.');
          return;
        }

        const staffEmail = techForm.email.trim() || (cleanUsername + '@ticketmonitoring.local');

        // Create temporary Supabase client so we don't disrupt current Admin session storage
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        // 1. Sign up the user in Supabase Auth
        const { data: authData, error: signupErr } = await tempSupabase.auth.signUp({
          email: staffEmail,
          password: techForm.password,
          options: {
            data: {
              firstname: techForm.firstname.trim(),
              lastname: techForm.lastname.trim(),
              position: techForm.position,
              branch: techForm.branch,
              role: 'Technical',
              username: cleanUsername,
              contact_email: techForm.email.trim() || null
            }
          }
        });

        if (signupErr) throw signupErr;

        // 2. Since auth.signUp triggers handle_new_auth_user(), the row is already in the database.
        // We now update it with contact_viber and set is_active to true (since Admin created them)
        if (authData?.user) {
          const { error: updateErr } = await supabase
            .from('technical_staff')
            .update({
              contact_viber: techForm.contact_viber.trim() || null,
              is_active: true
            })
            .eq('user_id', authData.user.id);
            
          if (updateErr) throw updateErr;
        }
      } else {
        // Edit existing
        const response = await fetch(`${API_URL}/api/technical/${selectedTech.technical_id}/privileges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstname: techForm.firstname,
            lastname: techForm.lastname,
            contact_viber: techForm.contact_viber,
            branch: techForm.branch,
            position: techForm.position,
            admin_id: adminUser?.technical_id
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
      }

      closeModal();
      onRefresh();
    } catch (err) {
      alert(`Failed to save technician: ${err.message}`);
    }
  };

  // Quick ticket submit for selected technician
  const handleQuickTicketSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTech) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .insert([{
          company_id: quickTicketForm.company_id,
          product_id: parseInt(quickTicketForm.product_id),
          concern_id: parseInt(quickTicketForm.concern_id),
          concern_description: quickTicketForm.concern_description,
          priority: quickTicketForm.priority,
          status: 'In Progress', // starts assigned
          technical_id: selectedTech.technical_id,
          assigned: true,
          assigned_date: new Date().toISOString()
        }]);

      if (error) throw error;

      closeModal();
      onRefresh();
      alert(`Ticket assigned to ${selectedTech.firstname} successfully.`);
    } catch (err) {
      alert(`Quick ticket creation failed: ${err.message}`);
    }
  };

  const openAddEditModal = (mode) => {
    if (mode === 'edit' && selectedTech) {
      setTechForm({
        username: selectedTech.username || '',
        firstname: selectedTech.firstname,
        lastname: selectedTech.lastname,
        email: selectedTech.email,
        password: '',
        contact_viber: selectedTech.contact_viber || '',
        branch: selectedTech.branch || 'DAVAO',
        position: selectedTech.position || 'Technical'
      });
      setActiveModal('add_edit');
    } else {
      setTechForm({
        username: '',
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        contact_viber: '',
        branch: 'DAVAO',
        position: 'Technical'
      });
      // Set selectedTech dummy null so we know it is create
      setSelectedTech(null);
      setActiveModal('add_edit');
    }
  };

  const openQuickTicketModal = () => {
    setQuickTicketForm({
      company_id: clients[0]?.client_id || '',
      product_id: products[0]?.product_id || '',
      concern_id: concerns[0]?.concern_id || '',
      concern_description: '',
      priority: 'Medium'
    });
    setActiveModal('quick_ticket');
  };

  const closeModal = () => {
    setActiveModal(null);
    if (!selectedTech && staff.length > 0) {
      setSelectedTech(staff[0]);
    }
  };

  // Filter tickets for selected technician
  const assignedTickets = selectedTech 
    ? tickets.filter(t => t.technical_id === selectedTech.technical_id) 
    : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '2rem', height: 'calc(100vh - 160px)' }}>
      
      {/* Left Sidebar List */}
      <div className="card-widget" style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'Outfit' }}>Technical Staff</span>
          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => openAddEditModal('add')}>
            <Plus size={14} /> Add
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {staff.length === 0 ? (
            <p style={{ color: 'hsl(var(--fg-secondary))', textAlign: 'center', fontSize: '0.85rem' }}>No staff registered.</p>
          ) : (
            staff.map(tech => {
              const initials = `${tech.firstname?.[0] || ''}${tech.lastname?.[0] || ''}`.toUpperCase();
              const isSelected = selectedTech && selectedTech.technical_id === tech.technical_id;
              
              return (
                <div 
                  key={tech.technical_id}
                  onClick={() => handleSelectTech(tech)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                    border: isSelected ? '1px solid rgba(var(--primary-rgb), 0.3)' : '1px solid transparent',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div className="avatar" style={{ border: 'none', backgroundColor: tech.is_active ? 'rgba(0, 184, 148, 0.15)' : 'rgba(100, 116, 139, 0.15)', color: tech.is_active ? '#00b894' : '#64748b' }}>
                    {initials}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'hsl(var(--fg-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tech.firstname} {tech.lastname}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>
                      {tech.position} • {tech.branch}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.75rem', gap: '0.2rem' }}>
                    <span style={{ 
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: tech.is_active ? '#00b894' : '#ff7675'
                    }} />
                    <span style={{ color: 'hsl(var(--fg-secondary))' }}>{tech.resolve}/{tech.total_ticket}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail Pane */}
      {selectedTech ? (
        <div className="card-widget" style={{ height: '100%', overflowY: 'auto', gap: '1.5rem' }}>
          
          {/* Staff Profile Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div 
                className="avatar" 
                style={{ 
                  width: '60px', height: '60px', fontSize: '1.5rem', 
                  backgroundColor: 'rgba(var(--primary-rgb), 0.15)', border: 'none' 
                }}
              >
                {`${selectedTech.firstname?.[0] || ''}${selectedTech.lastname?.[0] || ''}`.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontFamily: 'Outfit' }}>{selectedTech.firstname} {selectedTech.lastname}</h2>
                <div style={{ display: 'flex', gap: '0.75rem', color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {selectedTech.email && !selectedTech.email.endsWith('@ticketmonitoring.local') && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={14} /> {selectedTech.email}</span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {selectedTech.branch} ({selectedTech.position})</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => openAddEditModal('edit')}>
                <Pencil size={14} /> Edit Profile
              </button>
              <button className="btn btn-primary" onClick={openQuickTicketModal}>
                <Plus size={14} /> Assign Ticket
              </button>
            </div>
          </div>

          {/* Performance Rate & Switch Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            
            {/* Control Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ fontFamily: 'Outfit' }}>System Authorization</h4>
              
              {/* Active Toggle Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Active Status</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Enables login permissions</div>
                </div>
                <button 
                  onClick={() => handleToggleActive(selectedTech)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedTech.is_active ? '#00b894' : '#ff7675' }}
                >
                  {selectedTech.is_active ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              {/* Privileges Matrix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--fg-secondary))' }}>PAGE ACCESSIBILITY RIGHTS</div>
                
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span>View Ticket Board</span>
                  <button 
                    type="button" 
                    onClick={() => handlePermissionToggle('can_view_tickets', selectedTech.can_view_tickets)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedTech.can_view_tickets ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))' }}
                  >
                    {selectedTech.can_view_tickets ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span>View Technical Panel</span>
                  <button 
                    type="button" 
                    onClick={() => handlePermissionToggle('can_view_technical', selectedTech.can_view_technical)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedTech.can_view_technical ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))' }}
                  >
                    {selectedTech.can_view_technical ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <span>View Reports & Charts</span>
                  <button 
                    type="button" 
                    onClick={() => handlePermissionToggle('can_view_reports', selectedTech.can_view_reports)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedTech.can_view_reports ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))' }}
                  >
                    {selectedTech.can_view_reports ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                </label>
              </div>

            </div>

            {/* Performance Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)', justifyContent: 'center' }}>
              <h4 style={{ fontFamily: 'Outfit' }}>Performance Indicators</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit' }}>{selectedTech.total_ticket}</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Assigned</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit', color: '#00b894' }}>{selectedTech.resolve}</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Resolved</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit', color: '#ff7675' }}>{selectedTech.unresolve}</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Unresolved</div>
                </div>
              </div>

              {/* Progress */}
              <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <span>Resolution Rate</span>
                  <span>
                    {selectedTech.total_ticket > 0 
                      ? Math.round((selectedTech.resolve / selectedTech.total_ticket) * 100)
                      : 0}%
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'hsl(var(--bg-tertiary))', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${selectedTech.total_ticket > 0 ? (selectedTech.resolve / selectedTech.total_ticket) * 100 : 0}%`, 
                    backgroundColor: '#00b894' 
                  }} />
                </div>
              </div>
            </div>

          </div>

          {/* Assigned Tickets Table */}
          <div>
            <h4 style={{ fontFamily: 'Outfit', marginBottom: '0.75rem' }}>Active Tickets Assigned</h4>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Client</th>
                    <th>Product</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedTickets.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlignment: 'center', padding: '2rem', color: 'hsl(var(--fg-secondary))' }}>
                        No tickets assigned to this technician.
                      </td>
                    </tr>
                  ) : (
                    assignedTickets.map(ticket => (
                      <tr key={ticket.ticket_id}>
                        <td style={{ fontWeight: 600 }}>#{ticket.ticket_id}</td>
                        <td>{ticket.clients?.company_name}</td>
                        <td>{ticket.products?.product_name}</td>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="card-widget" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--fg-secondary))' }}>
          Select a technician from the sidebar to inspect profiles.
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ----------------------------------------------------------------- */}
      
      {/* Add / Edit Modal */}
      {activeModal === 'add_edit' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{!selectedTech ? 'Add New Technical Staff' : 'Edit Technical Profile'}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={techForm.firstname}
                    onChange={(e) => setTechForm({ ...techForm, firstname: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={techForm.lastname}
                    onChange={(e) => setTechForm({ ...techForm, lastname: e.target.value })}
                    required
                  />
                </div>
              </div>

              {!selectedTech && (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={techForm.username}
                      onChange={(e) => setTechForm({ ...techForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Email Address (Optional)</label>
                      <input
                        type="email"
                        className="form-control"
                        value={techForm.email}
                        onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        placeholder="Min 6 characters"
                        className="form-control"
                        value={techForm.password}
                        onChange={(e) => setTechForm({ ...techForm, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Viber / Contact Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={techForm.contact_viber}
                  onChange={(e) => setTechForm({ ...techForm, contact_viber: e.target.value })}
                  placeholder="e.g. +639123456789"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Branch</label>
                  <select
                    className="form-control"
                    value={techForm.branch}
                    onChange={(e) => setTechForm({ ...techForm, branch: e.target.value })}
                  >
                    <option value="DAVAO">DAVAO</option>
                    <option value="MANILA">MANILA</option>
                    <option value="CEBU">CEBU</option>
                    <option value="GENERAL SANTOS">GENERAL SANTOS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Position</label>
                  <select
                    className="form-control"
                    value={techForm.position}
                    onChange={(e) => setTechForm({ ...techForm, position: e.target.value })}
                  >
                    <option value="Technical">Technical</option>
                    <option value="Support">Support</option>
                    <option value="Sales">Sales</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Technician</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Quick Ticket Modal */}
      {activeModal === 'quick_ticket' && selectedTech && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quick Ticket for {selectedTech.firstname}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleQuickTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label>Client Company</label>
                <select
                  className="form-control"
                  value={quickTicketForm.company_id}
                  onChange={(e) => setQuickTicketForm({ ...quickTicketForm, company_id: e.target.value })}
                  required
                >
                  {clients.map(c => (
                    <option key={c.client_id} value={c.client_id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Product</label>
                  <select
                    className="form-control"
                    value={quickTicketForm.product_id}
                    onChange={(e) => setQuickTicketForm({ ...quickTicketForm, product_id: e.target.value })}
                    required
                  >
                    {products.map(p => (
                      <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Concern Category</label>
                  <select
                    className="form-control"
                    value={quickTicketForm.concern_id}
                    onChange={(e) => setQuickTicketForm({ ...quickTicketForm, concern_id: e.target.value })}
                    required
                  >
                    {concerns.map(cn => (
                      <option key={cn.concern_id} value={cn.concern_id}>{cn.concern_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Concern Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={quickTicketForm.concern_description}
                  onChange={(e) => setQuickTicketForm({ ...quickTicketForm, concern_description: e.target.value })}
                  placeholder="Details of the client issue..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  className="form-control"
                  value={quickTicketForm.priority}
                  onChange={(e) => setQuickTicketForm({ ...quickTicketForm, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create & Assign</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
