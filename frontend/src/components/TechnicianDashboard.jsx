import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, CheckCircle, ClipboardList, Briefcase, Plus, Save, Key, Mail, Phone, MapPin, 
  ChevronRight, ChevronDown, Eye, Filter, X, ArrowUpRight, Clock 
} from 'lucide-react';
import supabase from '../supabaseClient';
import { API_URL } from '../config';

export default function TechnicianDashboard({ userProfile, tickets, clients, products, concerns, onRefresh }) {
  const [techTab, setTechTab] = useState('queue'); // 'queue' | 'self_ticket' | 'settings'
  const [statusTab, setStatusTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Collapse
  const [collapsedCompanies, setCollapsedCompanies] = useState({});
  const [selectedTickets, setSelectedTickets] = useState([]);
  
  // Columns
  const [visibleCols, setVisibleCols] = useState({
    id: true,
    product: true,
    concern: true,
    priority: true,
    status: true,
    date: true
  });
  const [showColMenu, setShowColMenu] = useState(false);

  // Modals / Actions
  const [activeModal, setActiveModal] = useState(null); // 'view' | 'update_status' | 'bulk_update'
  const [targetTicket, setTargetTicket] = useState(null);

  // Remarks inside view modal
  const [newRemarkText, setNewRemarkText] = useState('');
  const [ticketRemarks, setTicketRemarks] = useState([]);

  // Form states
  const [statusVal, setStatusVal] = useState('In Progress');
  const [solutionVal, setSolutionVal] = useState('');
  const [remarksVal, setRemarksVal] = useState('');

  // Bulk status form
  const [bulkStatusVal, setBulkStatusVal] = useState('In Progress');
  const [bulkSolutionVal, setBulkSolutionVal] = useState('');
  const [bulkRemarksVal, setBulkRemarksVal] = useState('');

  // Self Ticket Form
  const [companySearch, setCompanySearch] = useState('');
  const [matchingClients, setMatchingClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Create New Client inside Self-Ticket if not found
  const [newClientForm, setNewClientForm] = useState({
    username: '',
    company_name: '',
    contact_person: '',
    contact_number: '',
    email: ''
  });
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  const [selfTicketForm, setSelfTicketForm] = useState({
    product_id: '',
    concern_id: '',
    concern_description: '',
    priority: 'Medium'
  });

  // Add Product State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  const currentConcernId = selfTicketForm.concern_id || concerns[0]?.concern_id?.toString() || '';
  const selectedConcern = concerns.find(c => c.concern_id.toString() === currentConcernId.toString());
  const isOthersSelected = selectedConcern?.concern_name === 'Others';

  const renderAsterisk = (value) => {
    if (value && value.toString().trim() !== '') return null;
    return <span style={{ color: 'red', marginLeft: '4px' }}>*</span>;
  };

  // Settings Forms
  const [profileSettings, setProfileSettings] = useState({
    firstname: userProfile?.firstname || '',
    lastname: userProfile?.lastname || '',
    contact_viber: userProfile?.contact_viber || '',
    branch: userProfile?.branch || 'DAVAO'
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Fetch ticket remarks
  useEffect(() => {
    if (activeModal === 'view' && targetTicket) {
      fetchRemarks(targetTicket.ticket_id);
    }
  }, [activeModal, targetTicket]);

  const fetchRemarks = async (ticketId) => {
    try {
      const { data, error } = await supabase
        .from('remarks')
        .select('*, technical_staff(firstname, lastname)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTicketRemarks(data || []);
    } catch (err) {
      console.error('Failed to fetch remarks:', err);
    }
  };

  const handleAddRemark = async (e) => {
    e.preventDefault();
    if (!newRemarkText.trim() || !targetTicket) return;

    try {
      const { error } = await supabase
        .from('remarks')
        .insert([{
          ticket_id: targetTicket.ticket_id,
          created_by: userProfile.technical_id,
          remark_text: newRemarkText.trim()
        }]);

      if (error) throw error;
      setNewRemarkText('');
      fetchRemarks(targetTicket.ticket_id);
      onRefresh();
    } catch (err) {
      console.error('Failed to add remark:', err);
    }
  };

  // Filter tickets for this technician
  const myTickets = useMemo(() => {
    return tickets.filter(t => t.technical_id === userProfile?.technical_id);
  }, [tickets, userProfile]);

  const filteredTickets = useMemo(() => {
    return myTickets.filter(ticket => {
      // Tab filter
      if (statusTab !== 'All' && ticket.status !== statusTab) {
        return false;
      }
      // Search filter
      const search = searchTerm.toLowerCase();
      const companyMatch = ticket.clients?.company_name?.toLowerCase().includes(search);
      const descMatch = ticket.concern_description?.toLowerCase().includes(search);
      const idMatch = ticket.ticket_id.toString().includes(search);
      return companyMatch || descMatch || idMatch;
    });
  }, [myTickets, statusTab, searchTerm]);

  // Group by client
  const companyGroups = useMemo(() => {
    const groups = {};
    filteredTickets.forEach(ticket => {
      const compName = ticket.clients?.company_name || 'Unassigned Client';
      if (!groups[compName]) {
        groups[compName] = [];
      }
      groups[compName].push(ticket);
    });
    return groups;
  }, [filteredTickets]);

  const handleSelectTicket = (id) => {
    setSelectedTickets(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllGroup = (groupTickets) => {
    const groupIds = groupTickets.map(t => t.ticket_id);
    const allSelected = groupIds.every(id => selectedTickets.includes(id));
    if (allSelected) {
      setSelectedTickets(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedTickets(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  // Set viewed to true when viewing
  const handleOpenViewModal = async (ticket) => {
    setTargetTicket(ticket);
    setActiveModal('view');

    if (!ticket.is_viewed) {
      try {
        await supabase
          .from('tickets')
          .update({ is_viewed: true })
          .eq('ticket_id', ticket.ticket_id);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenStatusModal = (ticket) => {
    setTargetTicket(ticket);
    setStatusVal(ticket.status);
    setSolutionVal(ticket.solution || '');
    setRemarksVal('');
    setActiveModal('update_status');
  };

  // Update Status Single Submit
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusVal) return;
    if ((statusVal === 'Resolved' || statusVal === 'Closed') && !solutionVal.trim()) {
      alert('Please provide a solution or remarks before resolving/closing.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_ids: [targetTicket.ticket_id],
          action: 'status',
          value: statusVal,
          solution: solutionVal,
          archived_by: userProfile.technical_id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Save remark log if provided
      if (remarksVal.trim()) {
        await supabase.from('remarks').insert([{
          ticket_id: targetTicket.ticket_id,
          created_by: userProfile.technical_id,
          remark_text: `Updated status to ${statusVal}. Note: ${remarksVal.trim()}`
        }]);
      }

      setActiveModal(null);
      setTargetTicket(null);
      onRefresh();
    } catch (err) {
      alert(`Error updating: ${err.message}`);
    }
  };

  // Bulk Status Updates Submit
  const handleBulkStatusSubmit = async (e) => {
    e.preventDefault();
    if (selectedTickets.length === 0) return;
    if ((bulkStatusVal === 'Resolved' || bulkStatusVal === 'Closed') && !bulkSolutionVal.trim()) {
      alert('Please provide a solution before resolving/closing tickets.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_ids: selectedTickets,
          action: 'status',
          value: bulkStatusVal,
          solution: bulkSolutionVal,
          archived_by: userProfile.technical_id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Add remark to all
      if (bulkRemarksVal.trim()) {
        const remarkRows = selectedTickets.map(tid => ({
          ticket_id: tid,
          created_by: userProfile.technical_id,
          remark_text: `Bulk updated to ${bulkStatusVal}. Note: ${bulkRemarksVal.trim()}`
        }));
        await supabase.from('remarks').insert(remarkRows);
      }

      setSelectedTickets([]);
      setActiveModal(null);
      onRefresh();
      alert(data.message);
    } catch (err) {
      alert(`Bulk update failed: ${err.message}`);
    }
  };

  // Autocomplete search clients
  const handleCompanySearch = (val) => {
    setCompanySearch(val);
    if (!val.trim()) {
      setMatchingClients([]);
      setSelectedClient(null);
      return;
    }

    const matches = clients.filter(c => 
      c.company_name.toLowerCase().includes(val.toLowerCase())
    );
    setMatchingClients(matches);
  };

  const handleSelectClientMatch = (client) => {
    setSelectedClient(client);
    setCompanySearch(client.company_name);
    setMatchingClients([]);
    setShowNewClientForm(false);
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
      setSelfTicketForm(prev => ({ ...prev, product_id: data.product_id.toString() }));
      setIsAddingProduct(false);
      setNewProductName('');
    } catch (err) {
      alert('Failed to add product: ' + err.message);
    }
  };

  const handleSelfTicketSubmit = async (e) => {
    e.preventDefault();
    if (showNewClientForm) {
      if (!newClientForm.username.trim() || !newClientForm.company_name.trim() || !newClientForm.contact_person.trim()) {
        alert('Please fill in all required client fields (including Username).');
        return;
      }

      const cleanUsername = newClientForm.username.trim().toLowerCase();
      // Uniqueness check
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
    } else {
      if (!selectedClient) {
        alert('Please select an existing client or click "Add New Client".');
        return;
      }
    }
    const activeProductId = isAddingProduct ? newProductName : (selfTicketForm.product_id || products[0]?.product_id?.toString());
    const activeConcernId = selfTicketForm.concern_id || concerns[0]?.concern_id?.toString();
    if (!activeProductId || !activeConcernId || !selfTicketForm.priority || (isOthersSelected && !selfTicketForm.concern_description.trim())) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      let finalClientId;

      if (showNewClientForm) {
        const cleanUsername = newClientForm.username.trim().toLowerCase();
        const clientEmail = newClientForm.email.trim() || null;
        
        // Create new client first
        const { data: newClient, error } = await supabase
          .from('clients')
          .insert([{
            username: cleanUsername,
            company_name: newClientForm.company_name.trim(),
            contact_person: newClientForm.contact_person.trim(),
            contact_number: newClientForm.contact_number.trim() || null,
            email: clientEmail
          }])
          .select('client_id')
          .single();
        if (error) throw error;
        finalClientId = newClient.client_id;
      } else {
        if (!selectedClient) {
          alert('Please select an existing client or click "Add New Client".');
          return;
        }
        finalClientId = selectedClient.client_id;
      }

      // Insert ticket auto-assigned to self, status 'In Progress'
      const { error } = await supabase
        .from('tickets')
        .insert([{
          company_id: finalClientId,
          product_id: parseInt(selfTicketForm.product_id || products[0]?.product_id),
          concern_id: parseInt(selfTicketForm.concern_id || concerns[0]?.concern_id),
          concern_description: selfTicketForm.concern_description,
          priority: selfTicketForm.priority,
          status: 'In Progress',
          technical_id: userProfile.technical_id,
          assigned: true,
          assigned_date: new Date().toISOString()
        }]);

      if (error) throw error;

      alert('Self-ticket generated successfully!');
      setTechTab('queue');
      onRefresh();

      // Reset Form
      setCompanySearch('');
      setSelectedClient(null);
      setSelfTicketForm({
        product_id: '',
        concern_id: '',
        concern_description: '',
        priority: 'Medium'
      });
      setNewClientForm({ username: '', company_name: '', contact_person: '', contact_number: '', email: '' });
      setShowNewClientForm(false);
    } catch (err) {
      alert(`Failed to create self ticket: ${err.message}`);
    }
  };

  // Update Settings
  const handleProfileSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/technical/${userProfile.technical_id}/privileges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: profileSettings.firstname,
          lastname: profileSettings.lastname,
          contact_viber: profileSettings.contact_viber,
          branch: profileSettings.branch,
          admin_id: userProfile.technical_id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      onRefresh();
      alert('Profile details updated successfully.');
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      alert('Password updated successfully.');
    } catch (err) {
      alert(`Password update failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Profile Summary Header Card */}
      <div 
        className="card-widget" 
        style={{ 
          padding: '1.5rem', background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.1) 0%, transparent 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="avatar" style={{ width: '50px', height: '50px', fontSize: '1.25rem', border: 'none', backgroundColor: '#0984e3', color: '#fff' }}>
            {`${userProfile?.firstname?.[0] || ''}${userProfile?.lastname?.[0] || ''}`.toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontFamily: 'Outfit' }}>Welcome, {userProfile?.firstname} {userProfile?.lastname}!</h2>
            <div style={{ display: 'flex', gap: '0.75rem', color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {userProfile?.branch} Branch</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Briefcase size={14} /> {userProfile?.position} Specialist</span>
            </div>
          </div>
        </div>

        {/* Mini Performance KPIs */}
        <div style={{ display: 'flex', gap: '1.5rem', borderLeft: '1px solid hsl(var(--border-color))', paddingLeft: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'Outfit' }}>{myTickets.length}</div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--fg-secondary))', textTransform: 'uppercase' }}>Total Assigned</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'Outfit', color: '#00b894' }}>{userProfile?.resolve}</div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--fg-secondary))', textTransform: 'uppercase' }}>Resolved</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'Outfit', color: '#ff7675' }}>{userProfile?.unresolve}</div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--fg-secondary))', textTransform: 'uppercase' }}>Active Queue</div>
          </div>
        </div>
      </div>

      {/* Main Nav Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', gap: '1.5rem' }}>
        <button 
          className="btn" 
          onClick={() => setTechTab('queue')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0.25rem', fontSize: '0.95rem',
            color: techTab === 'queue' ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))',
            fontWeight: techTab === 'queue' ? 600 : 400,
            borderBottom: techTab === 'queue' ? '2px solid hsl(var(--primary))' : 'none',
            borderRadius: 0
          }}
        >
          My Ticket Queue
        </button>
        <button 
          className="btn" 
          onClick={() => setTechTab('self_ticket')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0.25rem', fontSize: '0.95rem',
            color: techTab === 'self_ticket' ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))',
            fontWeight: techTab === 'self_ticket' ? 600 : 400,
            borderBottom: techTab === 'self_ticket' ? '2px solid hsl(var(--primary))' : 'none',
            borderRadius: 0
          }}
        >
          Self-Ticket Generator
        </button>
        <button 
          className="btn" 
          onClick={() => setTechTab('settings')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 0.25rem', fontSize: '0.95rem',
            color: techTab === 'settings' ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))',
            fontWeight: techTab === 'settings' ? 600 : 400,
            borderBottom: techTab === 'settings' ? '2px solid hsl(var(--primary))' : 'none',
            borderRadius: 0
          }}
        >
          Profile Settings
        </button>
      </div>

      {/* Render Dynamic Panels */}
      
      {/* 1. Ticket Queue Panel */}
      {techTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            
            {/* Status Tabs */}
            <div style={{ display: 'flex', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.2rem', backgroundColor: 'hsl(var(--bg-secondary))' }}>
              {['All', 'In Progress', 'Paused', 'Resolved'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className="btn"
                  style={{
                    padding: '0.3rem 0.6rem', fontSize: '0.8rem',
                    backgroundColor: statusTab === tab ? 'hsl(var(--primary))' : 'transparent',
                    color: statusTab === tab ? '#fff' : 'hsl(var(--fg-secondary))',
                    borderRadius: 'calc(var(--radius-md) - 2px)'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Column visibility dropdown */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-secondary" onClick={() => setShowColMenu(!showColMenu)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Filter size={14} /> Column Filters <ChevronDown size={12} />
                </button>
                {showColMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowColMenu(false)} />
                    <div style={{
                      position: 'absolute', right: 0, marginTop: '0.5rem',
                      backgroundColor: 'hsl(var(--bg-secondary))',
                      border: '1px solid hsl(var(--border-color))',
                      borderRadius: 'var(--radius-md)', padding: '0.5rem',
                      boxShadow: 'var(--shadow-md)', zIndex: 100,
                      display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '150px'
                    }}>
                      {Object.keys(visibleCols).map(col => (
                        <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                          <input
                            type="checkbox"
                            checked={visibleCols[col]}
                            onChange={(e) => setVisibleCols(prev => ({ ...prev, [col]: e.target.checked }))}
                          />
                          <span style={{ textTransform: 'capitalize' }}>{col}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selectedTickets.length > 0 && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setBulkStatusVal('In Progress');
                    setBulkSolutionVal('');
                    setBulkRemarksVal('');
                    setActiveModal('bulk_update');
                  }}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  Bulk Update ({selectedTickets.length})
                </button>
              )}
            </div>

          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search queue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', backgroundColor: 'hsl(var(--bg-secondary))' }}
            />
          </div>

          {/* Grouped Queue */}
          <div>
            {Object.keys(companyGroups).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'hsl(var(--bg-secondary))', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)' }}>
                <ClipboardList size={32} style={{ color: 'hsl(var(--fg-muted))', marginBottom: '0.5rem' }} />
                <p style={{ color: 'hsl(var(--fg-secondary))' }}>No tickets assigned to you match this filter.</p>
              </div>
            ) : (
              Object.keys(companyGroups).map(companyName => {
                const groupTickets = companyGroups[companyName];
                const isCollapsed = collapsedCompanies[companyName];
                const allResolved = groupTickets.every(t => t.status === 'Resolved' || t.status === 'Closed');

                const groupSelectedCount = groupTickets.filter(t => selectedTickets.includes(t.ticket_id)).length;
                const allGroupSelected = groupSelectedCount === groupTickets.length;

                return (
                  <div 
                    key={companyName} 
                    className={`company-group ${allResolved ? 'resolved-tickets' : 'active-tickets'}`}
                  >
                    <div className="company-header" onClick={() => setCollapsedCompanies(prev => ({ ...prev, [companyName]: !prev[companyName] }))}>
                      <div className="company-title" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          onChange={() => handleSelectAllGroup(groupTickets)}
                        />
                        <span>{companyName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}></th>
                              {visibleCols.id && <th>ID</th>}
                              {visibleCols.product && <th>Product</th>}
                              {visibleCols.concern && <th>Concern</th>}
                              {visibleCols.priority && <th>Priority</th>}
                              {visibleCols.status && <th>Status</th>}
                              {visibleCols.date && <th>Requested</th>}
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupTickets.map(ticket => (
                              <tr key={ticket.ticket_id} style={{ fontWeight: !ticket.is_viewed ? '600' : 'normal' }}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedTickets.includes(ticket.ticket_id)}
                                    onChange={() => handleSelectTicket(ticket.ticket_id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                                {visibleCols.id && (
                                  <td style={{ fontWeight: 600 }}>
                                    #{ticket.ticket_id}
                                    {!ticket.is_viewed && <span style={{ marginLeft: '0.4rem', color: '#ff7675', fontSize: '0.65rem', border: '1px solid #ff7675', padding: '0.05rem 0.2rem', borderRadius: '4px' }}>NEW</span>}
                                  </td>
                                )}
                                {visibleCols.product && <td>{ticket.products?.product_name}</td>}
                                {visibleCols.concern && <td>{ticket.concerns?.concern_name}</td>}
                                {visibleCols.priority && (
                                  <td>
                                    <span className={`badge badge-${ticket.priority?.toLowerCase()}`}>
                                      {ticket.priority}
                                    </span>
                                  </td>
                                )}
                                {visibleCols.status && (
                                  <td>
                                    <span className={`badge badge-${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                                      {ticket.status}
                                    </span>
                                  </td>
                                )}
                                {visibleCols.date && <td>{new Date(ticket.date_requested).toLocaleDateString()}</td>}
                                <td>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => handleOpenViewModal(ticket)}>
                                      <Eye size={12} /> View
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => handleOpenStatusModal(ticket)}>
                                      <Save size={12} /> Status
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* 2. Self Ticket Panel */}
      {techTab === 'self_ticket' && (
        <div className="card-widget" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Plus size={18} /> Self-Ticket Generator
          </h3>

          <form onSubmit={handleSelfTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            
            {/* Client Lookup */}
            {!showNewClientForm ? (
              <div className="form-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Client Company Lookup {renderAsterisk(selectedClient)}</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setShowNewClientForm(true)}>
                    Add New Client Instead
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search company by name..."
                  value={companySearch}
                  onChange={(e) => handleCompanySearch(e.target.value)}
                />
                
                {/* Autocomplete list */}
                {matchingClients.length > 0 && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top: '100%',
                    backgroundColor: 'hsl(var(--bg-secondary))',
                    border: '1px solid hsl(var(--border-color))',
                    borderRadius: 'var(--radius-md)', zIndex: 100, maxHeight: '150px', overflowY: 'auto',
                    boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column'
                  }}>
                    {matchingClients.map(c => (
                      <div 
                        key={c.client_id}
                        onClick={() => handleSelectClientMatch(c)}
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', hover: 'background-color: hsl(var(--bg-tertiary))', borderBottom: '1px solid hsl(var(--border-color))' }}
                      >
                        <strong>{c.company_name}</strong> - {c.contact_person}
                      </div>
                    ))}
                  </div>
                )}
                {selectedClient && (
                  <div style={{ fontSize: '0.8rem', color: '#00b894', marginTop: '0.25rem' }}>
                    Linked to client: <strong>{selectedClient.company_name}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ border: '1px solid hsl(var(--border-color))', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600 }}>Create New Client Row</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setShowNewClientForm(false)}>
                    Find Existing Client
                  </button>
                </div>
                <div className="form-group">
                  <label>Username {renderAsterisk(newClientForm.username)}</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="john_doe"
                    value={newClientForm.username}
                    onChange={(e) => setNewClientForm({ ...newClientForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name {renderAsterisk(newClientForm.company_name)}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClientForm.company_name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contact Person {renderAsterisk(newClientForm.contact_person)}</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClientForm.contact_person}
                    onChange={(e) => setNewClientForm({ ...newClientForm, contact_person: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newClientForm.contact_number}
                      onChange={(e) => setNewClientForm({ ...newClientForm, contact_number: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email (Optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      value={newClientForm.email}
                      onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Product & Concern */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Product {renderAsterisk(isAddingProduct ? newProductName : selfTicketForm.product_id)}</label>
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
                    value={selfTicketForm.product_id}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setIsAddingProduct(true);
                      } else {
                        setSelfTicketForm({ ...selfTicketForm, product_id: e.target.value });
                      }
                    }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                    ))}
                    <option value="ADD_NEW">+ Add New Product...</option>
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Concern Category {renderAsterisk(selfTicketForm.concern_id)}</label>
                <select
                  className="form-control"
                  value={selfTicketForm.concern_id}
                  onChange={(e) => setSelfTicketForm({ ...selfTicketForm, concern_id: e.target.value })}
                  required
                >
                  {concerns.map(cn => (
                    <option key={cn.concern_id} value={cn.concern_id}>{cn.concern_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Concern Description {isOthersSelected && renderAsterisk(selfTicketForm.concern_description)}</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder={isOthersSelected ? "Describe the issue reported by the client (required)..." : "Describe the issue reported by the client (optional)..."}
                value={selfTicketForm.concern_description}
                onChange={(e) => setSelfTicketForm({ ...selfTicketForm, concern_description: e.target.value })}
                required={isOthersSelected}
              />
            </div>

            <div className="form-group">
              <label>Priority {renderAsterisk(selfTicketForm.priority)}</label>
              <select
                className="form-control"
                value={selfTicketForm.priority}
                onChange={(e) => setSelfTicketForm({ ...selfTicketForm, priority: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>
              Note: Self-tickets are automatically assigned to you, and start with **In Progress** status.
            </p>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
              Create and Auto-Assign
            </button>

          </form>
        </div>
      )}

      {/* 3. Settings Panel */}
      {techTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* Profile details */}
          <div className="card-widget">
            <h3 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <User size={18} /> Update Profile Info
            </h3>
            <form onSubmit={handleProfileSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileSettings.firstname}
                  onChange={(e) => setProfileSettings({ ...profileSettings, firstname: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileSettings.lastname}
                  onChange={(e) => setProfileSettings({ ...profileSettings, lastname: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Viber Contact Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileSettings.contact_viber}
                  onChange={(e) => setProfileSettings({ ...profileSettings, contact_viber: e.target.value })}
                  placeholder="+639123456789"
                />
              </div>
              <div className="form-group">
                <label>Branch Office</label>
                <select
                  className="form-control"
                  value={profileSettings.branch}
                  onChange={(e) => setProfileSettings({ ...profileSettings, branch: e.target.value })}
                >
                  <option value="DAVAO">DAVAO</option>
                  <option value="MANILA">MANILA</option>
                  <option value="CEBU">CEBU</option>
                  <option value="GENERAL SANTOS">GENERAL SANTOS</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                Save Profile Details
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="card-widget">
            <h3 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Key size={18} /> Change Password
            </h3>
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                Update Password
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ----------------------------------------------------------------- */}
      
      {/* View Modal */}
      {activeModal === 'view' && targetTicket && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket Details #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h4 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem' }}>Client Information</h4>
                <p style={{ marginTop: '0.5rem' }}><strong>Company Name:</strong> {targetTicket.clients?.company_name}</p>
                <p><strong>Contact Person:</strong> {targetTicket.clients?.contact_person}</p>
                <p><strong>Contact Viber:</strong> {targetTicket.clients?.contact_number || 'N/A'}</p>
              </div>
              <div>
                <h4 style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem' }}>Specifications</h4>
                <p style={{ marginTop: '0.5rem' }}><strong>Product:</strong> {targetTicket.products?.product_name} ({targetTicket.products?.version})</p>
                <p><strong>Concern:</strong> {targetTicket.concerns?.concern_name}</p>
                <p><strong>Priority:</strong> <span className={`badge badge-${targetTicket.priority?.toLowerCase()}`}>{targetTicket.priority}</span></p>
                <p><strong>Status:</strong> <span className={`badge badge-${targetTicket.status?.toLowerCase().replace(' ', '-')}`}>{targetTicket.status}</span></p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
              <h4>Concern Description</h4>
              <p style={{ backgroundColor: 'hsl(var(--bg-tertiary))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {targetTicket.concern_description}
              </p>
            </div>

            {targetTicket.solution && (
              <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
                <h4 style={{ color: '#00b894' }}>My Resolution notes</h4>
                <p style={{ backgroundColor: 'rgba(0, 184, 148, 0.08)', borderLeft: '4px solid #00b894', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
                  {targetTicket.solution}
                </p>
              </div>
            )}

            {/* Remarks Timeline */}
            <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4>Conversation History / Logs</h4>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                {ticketRemarks.length === 0 ? (
                  <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem' }}>No remarks written yet.</p>
                ) : (
                  ticketRemarks.map(rem => (
                    <div key={rem.remark_id} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'hsl(var(--bg-tertiary))', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--fg-secondary))', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <strong>{rem.technical_staff ? `${rem.technical_staff.firstname} ${rem.technical_staff.lastname}` : 'System'}</strong>
                        <span>{new Date(rem.created_at).toLocaleString()}</span>
                      </div>
                      <p>{rem.remark_text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddRemark} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Type updates / remarks..."
                  className="form-control"
                  style={{ flex: 1 }}
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Add</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Single Modal */}
      {activeModal === 'update_status' && targetTicket && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Ticket Status #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label>Status</label>
                <select
                  className="form-control"
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  required
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Paused">Paused</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {statusVal === 'Resolved' && (
                <div className="form-group">
                  <label style={{ color: '#00b894' }}>Documented Solution Notes (Required)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Enter what steps were taken to resolve this concern..."
                    value={solutionVal}
                    onChange={(e) => setSolutionVal(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Progress Log / Remark (Optional)</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Add details regarding this status update..."
                  value={remarksVal}
                  onChange={(e) => setRemarksVal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {activeModal === 'bulk_update' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Update Status ({selectedTickets.length} tickets)</h2>
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleBulkStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label>New Status</label>
                <select
                  className="form-control"
                  value={bulkStatusVal}
                  onChange={(e) => setBulkStatusVal(e.target.value)}
                  required
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Paused">Paused</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {bulkStatusVal === 'Resolved' && (
                <div className="form-group">
                  <label style={{ color: '#00b894' }}>Documented Solution Notes (Required for Resolved)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Describe solutions applied..."
                    value={bulkSolutionVal}
                    onChange={(e) => setBulkSolutionVal(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Add Progress Log to All Selected</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Optional log message..."
                  value={bulkRemarksVal}
                  onChange={(e) => setBulkRemarksVal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Bulk Updates</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
