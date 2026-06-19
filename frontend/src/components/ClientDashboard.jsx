import React, { useState, useEffect } from 'react';
import { 
  Ticket, Clock, CheckCircle, Plus, X, Search, 
  Filter, HelpCircle, Mail, Phone, User, Building, 
  AlertTriangle, CheckCircle2, ChevronRight, LogOut 
} from 'lucide-react';
import supabase from '../supabaseClient';

export default function ClientDashboard({ userProfile, tickets, products, concerns, onRefresh, handleLogout, view }) {
  const [activeModal, setActiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form State
  const [form, setForm] = useState({
    product_id: '',
    concern_id: '',
    concern_description: '',
    priority: 'Medium'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  const selectedConcern = concerns.find(c => c.concern_id.toString() === form.concern_id.toString());
  const isOthersSelected = selectedConcern?.concern_name === 'Others';

  const renderAsterisk = (value) => {
    if (value && value.toString().trim() !== '') return null;
    return <span style={{ color: 'red', marginLeft: '4px' }}>*</span>;
  };

  const handleAddNewProduct = async () => {
    if (!newProductName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ product_name: newProductName.trim(), version: '' }])
        .select()
        .single();
      
      if (error) throw error;
      
      await onRefresh();
      setForm(prev => ({ ...prev, product_id: data.product_id.toString() }));
      setIsAddingProduct(false);
      setNewProductName('');
    } catch (err) {
      alert('Failed to add product: ' + err.message);
    }
  };

  // Set default form values when products/concerns load
  useEffect(() => {
    if (products.length > 0 && concerns.length > 0) {
      setForm(prev => ({
        ...prev,
        product_id: prev.product_id || products[0].product_id.toString(),
        concern_id: prev.concern_id || concerns[0].concern_id.toString()
      }));
    }
  }, [products, concerns]);

  // Filter client's tickets
  const clientTickets = tickets.filter(t => t.company_id === userProfile?.client_id);

  // Filter by search & status
  const filteredTickets = clientTickets.filter(t => {
    const matchesSearch = 
      t.ticket_id.toString().includes(searchTerm) ||
      (t.concern_description && t.concern_description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.products?.product_name && t.products.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.concerns?.concern_name && t.concerns.concern_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const total = clientTickets.length;
  const pending = clientTickets.filter(t => t.status === 'Pending').length;
  const inProgress = clientTickets.filter(t => ['Assigned', 'In Progress', 'Paused'].includes(t.status)).length;
  const resolved = clientTickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    if (!form.product_id || !form.concern_id || (isOthersSelected && !form.concern_description.trim())) {
      setFormError('Please fill in all required fields. Issue description is required when concern category is "Others".');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('tickets')
        .insert([{
          company_id: userProfile.client_id,
          product_id: parseInt(form.product_id),
          concern_id: parseInt(form.concern_id),
          concern_description: form.concern_description.trim(),
          priority: form.priority,
          status: 'Pending',
          assigned: false,
          date_requested: new Date().toISOString()
        }]);

      if (error) throw error;

      setFormSuccess('Your support ticket has been submitted successfully!');
      setForm(prev => ({
        ...prev,
        concern_description: '',
        priority: 'Medium'
      }));

      // Refresh parent state
      onRefresh();

      // Close modal after brief delay
      setTimeout(() => {
        setActiveModal(false);
        setFormSuccess('');
      }, 1500);

    } catch (err) {
      setFormError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {view === 'dashboard' ? (
        <div className="google-form-container">
          
          {/* Header Card with Gradient Theme Banner */}
          <div className="google-form-card google-form-header-card">
            <div className="google-form-header-bar"></div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '1.85rem', fontWeight: '700', color: 'hsl(var(--fg-primary))', marginTop: '0.5rem' }}>
              Support Request Form
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'hsl(var(--fg-secondary))', lineHeight: '1.5' }}>
              Submit a new technical concern or request support for your products. We will assign a technician to handle your issue shortly.
            </p>
            <div style={{ 
              borderTop: '1px solid hsl(var(--border-color))', 
              paddingTop: '0.85rem', 
              marginTop: '0.5rem',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontSize: '0.8rem', 
              color: 'hsl(var(--fg-secondary))',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                Logged in as <strong>{userProfile?.username || userProfile?.contact_person}</strong> 
                {userProfile?.email && !userProfile.email.endsWith('@ticketmonitoring.local') && ` (${userProfile.email})`}
              </div>
              <div style={{ color: 'red', fontWeight: '500' }}>* Required</div>
            </div>
          </div>

          {formError && (
            <div style={{ color: '#ff7675', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #ff7675', backgroundColor: 'rgba(255, 118, 117, 0.05)', fontSize: '0.85rem' }}>
              {formError}
            </div>
          )}

          {formSuccess && (
            <div style={{ color: '#00b894', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #00b894', backgroundColor: 'rgba(0, 184, 148, 0.05)', fontSize: '0.85rem' }}>
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Section 1: Product Selection */}
            <div className="google-form-card google-form-section">
              <label>
                Affected Product / System {renderAsterisk(isAddingProduct ? newProductName : form.product_id)}
              </label>
              <div className="google-form-desc">
                Select the product or software system that is experiencing issues.
              </div>
              
              {isAddingProduct ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="New product name (e.g. Biotime)"
                    className="form-control"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    required
                    style={{ height: '42px' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleAddNewProduct}
                    style={{ padding: '0.375rem 1rem', fontSize: '0.85rem' }}
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => { setIsAddingProduct(false); setNewProductName(''); }}
                    style={{ padding: '0.375rem 1rem', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  className="form-control"
                  value={form.product_id}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      setIsAddingProduct(true);
                    } else {
                      setForm({ ...form, product_id: e.target.value });
                    }
                  }}
                  required
                  style={{ height: '42px', marginTop: '0.5rem' }}
                >
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} {p.version ? `(${p.version})` : ''}
                    </option>
                  ))}
                  <option value="ADD_NEW">+ Add New Product...</option>
                </select>
              )}
            </div>

            {/* Section 2: Concern Category */}
            <div className="google-form-card google-form-section">
              <label>
                Concern Category {renderAsterisk(form.concern_id)}
              </label>
              <div className="google-form-desc">
                Select the category that best describes your technical issue.
              </div>
              <select
                className="form-control"
                value={form.concern_id}
                onChange={(e) => setForm({ ...form, concern_id: e.target.value })}
                required
                style={{ height: '42px', marginTop: '0.5rem' }}
              >
                {concerns.map(c => (
                  <option key={c.concern_id} value={c.concern_id}>
                    {c.concern_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section 3: Issue Description */}
            <div className="google-form-card google-form-section">
              <label>
                Issue Description {isOthersSelected && renderAsterisk(form.concern_description)}
              </label>
              <div className="google-form-desc">
                Provide details about the issue you are experiencing (e.g. error messages, unexpected behavior).
              </div>
              <textarea
                className="form-control"
                rows="5"
                value={form.concern_description}
                onChange={(e) => setForm({ ...form, concern_description: e.target.value })}
                placeholder={isOthersSelected ? "Please describe your specific concern (required)..." : "Provide details about the issue you are experiencing (optional)..."}
                required={isOthersSelected}
                style={{ resize: 'none', marginTop: '0.5rem', padding: '0.75rem' }}
              />
            </div>

            {/* Section 4: Priority Request */}
            <div className="google-form-card google-form-section">
              <label>
                Priority Request {renderAsterisk(form.priority)}
              </label>
              <div className="google-form-desc">
                How urgent is this concern? High priority is reserved for system-down or critical business-stopping issues.
              </div>
              
              <div className="google-form-radio-group">
                {[
                  { value: 'Low', label: 'Low (General query / non-urgent request)' },
                  { value: 'Medium', label: 'Medium (Standard operational issue / minor interruption)' },
                  { value: 'High', label: 'High (Critical failure / system down / blocked operations)' }
                ].map(opt => (
                  <div 
                    key={opt.value}
                    onClick={() => setForm({ ...form, priority: opt.value })}
                    className={`google-form-radio-option ${form.priority === opt.value ? 'selected' : ''}`}
                  >
                    <input 
                      type="radio" 
                      name="priority"
                      value={opt.value}
                      checked={form.priority === opt.value}
                      onChange={() => {}} 
                    />
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit and Clear Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting} 
                style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 600, justifyContent: 'center' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
              </button>
              
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setForm(prev => ({
                  ...prev,
                  concern_description: '',
                  priority: 'Medium'
                }))}
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
              >
                Clear Form
              </button>
            </div>

          </form>
        </div>
      ) : (
        /* Filter and List Widget */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Ticket stats grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-info">
                <h3>Total Requests</h3>
                <span className="metric-value">{total}</span>
              </div>
              <div className="metric-icon-box">
                <Ticket size={24} />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h3>Pending Review</h3>
                <span className="metric-value" style={{ color: '#ff7675' }}>{pending}</span>
              </div>
              <div className="metric-icon-box" style={{ color: '#ff7675', backgroundColor: 'rgba(255, 118, 117, 0.1)' }}>
                <Clock size={24} />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h3>In Progress</h3>
                <span className="metric-value" style={{ color: 'hsl(var(--primary))' }}>{inProgress}</span>
              </div>
              <div className="metric-icon-box" style={{ color: 'hsl(var(--primary))', backgroundColor: 'rgba(9, 132, 227, 0.1)' }}>
                <HelpCircle size={24} />
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-info">
                <h3>Resolved Support</h3>
                <span className="metric-value" style={{ color: '#00b894' }}>{resolved}</span>
              </div>
              <div className="metric-icon-box" style={{ color: '#00b894', backgroundColor: 'rgba(0, 184, 148, 0.1)' }}>
                <CheckCircle size={24} />
              </div>
            </div>
          </div>

          <div className="card-widget">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'Outfit' }}>Your Support Tickets</span>
              <button className="btn btn-primary" onClick={() => setActiveModal(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.3rem' }}>
                <Plus size={14} /> Request Support
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--fg-muted))' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search ticket ID or details..."
                  style={{ paddingLeft: '2.25rem', paddingRight: '0.5rem', height: '38px', fontSize: '0.85rem' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filter Toggle */}
              <div style={{ display: 'flex', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.2rem', backgroundColor: 'hsl(var(--bg-secondary))' }}>
                {['All', 'Pending', 'In Progress', 'Resolved', 'Closed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className="btn"
                    style={{
                      padding: '0.3rem 0.6rem', fontSize: '0.75rem',
                      backgroundColor: statusFilter === status ? 'hsl(var(--primary))' : 'transparent',
                      color: statusFilter === status ? '#fff' : 'hsl(var(--fg-secondary))',
                      borderRadius: 'calc(var(--radius-md) - 2px)'
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tickets Table / List */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Product</th>
                  <th>Concern Category</th>
                  <th>Description</th>
                  <th>Date Requested</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Technical Staff</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--fg-secondary))' }}>
                      {clientTickets.length === 0 ? "You have not submitted any support tickets yet." : "No tickets matching your search query or status filter."}
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map(t => {
                    const techName = t.technical_staff 
                      ? `${t.technical_staff.firstname} ${t.technical_staff.lastname}` 
                      : 'Not Assigned Yet';
                    
                    return (
                      <tr key={t.ticket_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicket(t)}>
                        <td style={{ fontWeight: 700 }}>#{t.ticket_id}</td>
                        <td>{t.products?.product_name || 'N/A'}</td>
                        <td>{t.concerns?.concern_name || 'N/A'}</td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {t.concern_description}
                        </td>
                        <td>{new Date(t.date_requested).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge badge-${t.priority?.toLowerCase()}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${t.status?.toLowerCase().replace(' ', '-')}`}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ fontStyle: t.technical_staff ? 'normal' : 'italic', color: t.technical_staff ? 'inherit' : 'hsl(var(--fg-muted))' }}>
                          {techName}
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.2rem' }} onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }}>
                            Inspect <ChevronRight size={12} />
                          </button>
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
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ----------------------------------------------------------------- */}

      {/* Support Request Form Modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={() => setActiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>Request Technical Support</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(false)}><X size={20} /></button>
            </div>
            
            {formError && (
              <div style={{ color: '#ff7675', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #ff7675', backgroundColor: 'rgba(255, 118, 117, 0.05)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            {formSuccess && (
              <div style={{ color: '#00b894', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #00b894', backgroundColor: 'rgba(0, 184, 148, 0.05)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
               <div className="form-group">
                <label>Affected Product / System {renderAsterisk(isAddingProduct ? newProductName : form.product_id)}</label>
                {isAddingProduct ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="New product name (e.g. Biotime)"
                      className="form-control"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={handleAddNewProduct}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      Save
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => { setIsAddingProduct(false); setNewProductName(''); }}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    className="form-control"
                    value={form.product_id}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setIsAddingProduct(true);
                      } else {
                        setForm({ ...form, product_id: e.target.value });
                      }
                    }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name} {p.version ? `(${p.version})` : ''}
                      </option>
                    ))}
                    <option value="ADD_NEW">+ Add New Product...</option>
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>Concern Category {renderAsterisk(form.concern_id)}</label>
                <select
                  className="form-control"
                  value={form.concern_id}
                  onChange={(e) => setForm({ ...form, concern_id: e.target.value })}
                  required
                >
                  {concerns.map(c => (
                    <option key={c.concern_id} value={c.concern_id}>
                      {c.concern_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Issue Description {isOthersSelected && renderAsterisk(form.concern_description)}</label>
                 <textarea
                  className="form-control"
                  rows="4"
                  value={form.concern_description}
                  onChange={(e) => setForm({ ...form, concern_description: e.target.value })}
                  placeholder={isOthersSelected ? "Please describe your specific concern (required)..." : "Provide details about the issue you are experiencing (optional)..."}
                  required={isOthersSelected}
                />
              </div>

              <div className="form-group">
                <label>Priority Request {renderAsterisk(form.priority)}</label>
                <select
                  className="form-control"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="Low">Low (General Query)</option>
                  <option value="Medium">Medium (Operational Issue)</option>
                  <option value="High">High (System Down / Critical)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Ticket Details Inspector Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Support Ticket Details #{selectedTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={() => setSelectedTicket(null)}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>PRODUCT SYSTEM</span>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    {selectedTicket.products?.product_name || 'N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>CONCERN CATEGORY</span>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                    {selectedTicket.concerns?.concern_name || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>ISSUE DESCRIPTION</span>
                <div style={{ 
                  marginTop: '0.4rem', 
                  padding: '1rem', 
                  backgroundColor: 'hsl(var(--bg-tertiary))', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedTicket.concern_description}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', backgroundColor: 'hsl(var(--bg-secondary))', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Requested Date</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {new Date(selectedTicket.date_requested).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Priority</span>
                  <div style={{ marginTop: '0.2rem' }}>
                    <span className={`badge badge-${selectedTicket.priority?.toLowerCase()}`}>
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Status</span>
                  <div style={{ marginTop: '0.2rem' }}>
                    <span className={`badge badge-${selectedTicket.status?.toLowerCase().replace(' ', '-')}`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>Technician</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem', color: selectedTicket.technical_staff ? 'inherit' : 'hsl(var(--fg-muted))' }}>
                    {selectedTicket.technical_staff 
                      ? `${selectedTicket.technical_staff.firstname} ${selectedTicket.technical_staff.lastname}` 
                      : 'Pending Assignment'}
                  </div>
                </div>
              </div>

              {selectedTicket.solution && (
                <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#00b894', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={16} /> RESOLUTION SOLUTION
                  </span>
                  <div style={{ 
                    marginTop: '0.4rem', 
                    padding: '1rem', 
                    backgroundColor: 'rgba(0, 184, 148, 0.05)', 
                    border: '1px solid rgba(0, 184, 148, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}>
                    {selectedTicket.solution}
                  </div>
                  {selectedTicket.finish_date && (
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-muted))', marginTop: '0.4rem', textAlign: 'right' }}>
                      Resolved at: {new Date(selectedTicket.finish_date).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {selectedTicket.remarks && (
                <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))', fontWeight: 600 }}>REMARKS</span>
                  <div style={{ 
                    marginTop: '0.4rem', 
                    padding: '1rem', 
                    backgroundColor: 'hsl(var(--bg-tertiary))',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}>
                    {selectedTicket.remarks}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>Close</button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
