import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, Eye, UserPlus, ShieldAlert, Archive, Trash2, ChevronDown, ChevronRight, 
  Search, EyeOff, Download, Upload, Filter, Save, X, Calendar, ClipboardList 
} from 'lucide-react';
import supabase from '../supabaseClient';
import { API_URL } from '../config';

export default function TicketManager({ tickets, staff, products, concerns, clients, onRefresh, adminUser }) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [collapsedCompanies, setCollapsedCompanies] = useState({});
  const [selectedTickets, setSelectedTickets] = useState([]);
  
  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    product: true,
    concern: true,
    priority: true,
    status: true,
    technician: true,
    date: true
  });
  const [showColDropdown, setShowColDropdown] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'view' | 'assign' | 'status' | 'edit' | 'archive' | 'import' | 'new'
  const [targetTicket, setTargetTicket] = useState(null);
  
  // Form States
  const [assignTechId, setAssignTechId] = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [solutionVal, setSolutionVal] = useState('');
  const [remarksVal, setRemarksVal] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  
  // Create / Edit Ticket fields
  const [ticketForm, setTicketForm] = useState({
    company_id: '',
    product_id: '',
    concern_id: '',
    concern_description: '',
    priority: 'Medium',
    status: 'Pending',
    technical_id: ''
  });

  // Add Product State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  const selectedConcern = concerns.find(c => c.concern_id.toString() === ticketForm.concern_id.toString());
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
      setTicketForm(prev => ({ ...prev, product_id: data.product_id.toString() }));
      setIsAddingProduct(false);
      setNewProductName('');
    } catch (err) {
      alert('Failed to add product: ' + err.message);
    }
  };

  // Import Excel state
  const [importFile, setImportFile] = useState(null);
  const [dupStrategy, setDupStrategy] = useState('merge');
  const [importStatus, setImportStatus] = useState('');

  // Timeline / Remarks inside View Modal
  const [newRemarkText, setNewRemarkText] = useState('');
  const [ticketRemarks, setTicketRemarks] = useState([]);

  // Fetch remarks for targetTicket when viewed
  useEffect(() => {
    if (activeModal === 'view' && targetTicket) {
      fetchTicketRemarks(targetTicket.ticket_id);
    }
  }, [activeModal, targetTicket]);

  const fetchTicketRemarks = async (ticketId) => {
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
          created_by: adminUser?.technical_id,
          remark_text: newRemarkText.trim()
        }]);

      if (error) throw error;
      setNewRemarkText('');
      fetchTicketRemarks(targetTicket.ticket_id);
      onRefresh(); // updates the overall remarks feed in tickets if necessary
    } catch (err) {
      console.error('Failed to add remark:', err);
    }
  };

  // Group tickets by client company name after filtering
  const filteredTickets = tickets.filter(ticket => {
    // Tab filter
    if (activeTab !== 'All' && ticket.status !== activeTab) {
      return false;
    }
    // Search filter
    const search = searchTerm.toLowerCase();
    const idMatch = ticket.ticket_id.toString().includes(search);
    const companyMatch = ticket.clients?.company_name?.toLowerCase().includes(search);
    const descMatch = ticket.concern_description?.toLowerCase().includes(search);
    return idMatch || companyMatch || descMatch;
  });

  // Grouping
  const companyGroups = {};
  filteredTickets.forEach(ticket => {
    const compName = ticket.clients?.company_name || 'Unassigned Client';
    if (!companyGroups[compName]) {
      companyGroups[compName] = [];
    }
    companyGroups[compName].push(ticket);
  });

  const toggleCompanyCollapse = (company) => {
    setCollapsedCompanies(prev => ({
      ...prev,
      [company]: !prev[company]
    }));
  };

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

  // -----------------------------------------------------------------
  // API Call Helpers
  // -----------------------------------------------------------------
  
  // Assign single technician
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignTechId) return;

    try {
      // Fetch response from node server
      const response = await fetch(`${API_URL}/api/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_ids: [targetTicket.ticket_id],
          action: 'assign',
          value: assignTechId,
          archived_by: adminUser?.technical_id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      closeModal();
      onRefresh();
    } catch (err) {
      alert(`Error assigning: ${err.message}`);
    }
  };

  // Update status single
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
          archived_by: adminUser?.technical_id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // If remarksVal is filled, submit a remark too
      if (remarksVal.trim()) {
        await supabase.from('remarks').insert([{
          ticket_id: targetTicket.ticket_id,
          created_by: adminUser?.technical_id,
          remark_text: `Status updated to ${statusVal}. Note: ${remarksVal.trim()}`
        }]);
      }

      closeModal();
      onRefresh();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleEditOrCreateSubmit = async (e) => {
    e.preventDefault();
    const activeProductId = isAddingProduct ? newProductName : ticketForm.product_id;
    if (!ticketForm.company_id || !activeProductId || !ticketForm.concern_id || !ticketForm.priority || (isOthersSelected && !ticketForm.concern_description.trim())) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      if (activeModal === 'new') {
        const { error } = await supabase
          .from('tickets')
          .insert([{
            company_id: ticketForm.company_id,
            product_id: parseInt(ticketForm.product_id),
            concern_id: parseInt(ticketForm.concern_id),
            concern_description: ticketForm.concern_description,
            priority: ticketForm.priority,
            status: ticketForm.technical_id ? 'In Progress' : 'Pending',
            technical_id: ticketForm.technical_id || null,
            assigned: ticketForm.technical_id ? true : false,
            assigned_date: ticketForm.technical_id ? new Date().toISOString() : null
          }]);
        if (error) throw error;
      } else {
        // Edit existing
        const { error } = await supabase
          .from('tickets')
          .update({
            company_id: ticketForm.company_id,
            product_id: parseInt(ticketForm.product_id),
            concern_id: parseInt(ticketForm.concern_id),
            concern_description: ticketForm.concern_description,
            priority: ticketForm.priority,
            status: (ticketForm.technical_id && targetTicket.status === 'Pending') ? 'In Progress' : targetTicket.status,
            technical_id: ticketForm.technical_id || null,
            assigned: ticketForm.technical_id ? true : false,
            assigned_date: ticketForm.technical_id ? (targetTicket.assigned_date || new Date().toISOString()) : null
          })
          .eq('ticket_id', targetTicket.ticket_id);
        if (error) throw error;
      }

      closeModal();
      onRefresh();
    } catch (err) {
      alert(`Error processing: ${err.message}`);
    }
  };

  // Archive Ticket submit
  const handleArchiveSubmit = async (e) => {
    e.preventDefault();
    if (!archiveReason.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/tickets/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: targetTicket.ticket_id,
          archived_by: adminUser?.technical_id,
          archive_reason: archiveReason
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      closeModal();
      onRefresh();
    } catch (err) {
      alert(`Error archiving: ${err.message}`);
    }
  };

  // Bulk operation helpers
  const handleBulkAction = async (action, value) => {
    if (selectedTickets.length === 0) return;

    let confirmMsg = `Are you sure you want to perform bulk ${action} on ${selectedTickets.length} tickets?`;
    if (action === 'delete') {
      confirmMsg += ' This action is permanent!';
    }
    if (!window.confirm(confirmMsg)) return;

    try {
      const payload = {
        ticket_ids: selectedTickets,
        action,
        value,
        archived_by: adminUser?.technical_id,
        archive_reason: 'Bulk action performed'
      };

      const response = await fetch(`${API_URL}/api/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSelectedTickets([]);
      onRefresh();
      alert(data.message);
    } catch (err) {
      alert(`Bulk operation failed: ${err.message}`);
    }
  };

  // -----------------------------------------------------------------
  // Excel Functions
  // -----------------------------------------------------------------
  const downloadTemplate = () => {
    const headers = [[
      'company_name', 'contact_person', 'contact_number', 'email',
      'product_name', 'version', 'concern_name', 'concern_description',
      'priority', 'status', 'date_requested', 'remarks', 'solution', 'technical_email'
    ]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    XLSX.writeFile(wb, 'TicketMonitoring_Import_Template.xlsx');
  };

  const exportFilteredToExcel = () => {
    const excelRows = filteredTickets.map(t => ({
      'Ticket ID': t.ticket_id,
      'Company Name': t.clients?.company_name || 'N/A',
      'Contact Person': t.clients?.contact_person || 'N/A',
      'Contact Number': t.clients?.contact_number || '',
      'Email': t.clients?.email || '',
      'Product': t.products?.product_name || 'N/A',
      'Concern Type': t.concerns?.concern_name || 'N/A',
      'Description': t.concern_description || '',
      'Priority': t.priority,
      'Status': t.status,
      'Technician Email': t.technical_staff?.email || 'Unassigned',
      'Date Requested': t.date_requested ? new Date(t.date_requested).toLocaleDateString() : '',
      'Solution': t.solution || '',
      'Remarks': t.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Tickets');
    XLSX.writeFile(wb, 'TicketMonitoring_Tickets_Export.xlsx');
  };

  const handleExcelImportSubmit = (e) => {
    e.preventDefault();
    if (!importFile) return;

    setImportStatus('Parsing spreadsheet...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet);

        setImportStatus('Uploading to server...');
        const response = await fetch(`${API_URL}/api/tickets/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: jsonRows,
            duplicate_strategy: dupStrategy,
            imported_by: adminUser?.technical_id
          })
        });

        const resData = await response.json();
        if (!response.ok) throw new Error(resData.message);

        setImportStatus('Done!');
        alert(resData.message);
        closeModal();
        onRefresh();
      } catch (err) {
        setImportStatus('');
        alert(`Import error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(importFile);
  };

  // -----------------------------------------------------------------
  // Modal toggles
  // -----------------------------------------------------------------
  const openModal = (mode, ticket = null) => {
    setTargetTicket(ticket);
    setActiveModal(mode);
    
    if (ticket) {
      setAssignTechId(ticket.technical_id || '');
      setStatusVal(ticket.status || '');
      setSolutionVal(ticket.solution || '');
      setRemarksVal('');
      setTicketForm({
        company_id: ticket.company_id,
        product_id: ticket.product_id,
        concern_id: ticket.concern_id,
        concern_description: ticket.concern_description || '',
        priority: ticket.priority,
        status: ticket.status,
        technical_id: ticket.technical_id || ''
      });
    } else {
      setTicketForm({
        company_id: clients[0]?.client_id || '',
        product_id: products[0]?.product_id || '',
        concern_id: concerns[0]?.concern_id || '',
        concern_description: '',
        priority: 'Medium',
        status: 'Pending',
        technical_id: ''
      });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setTargetTicket(null);
    setAssignTechId('');
    setStatusVal('');
    setSolutionVal('');
    setRemarksVal('');
    setArchiveReason('');
    setImportFile(null);
    setImportStatus('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Filter & Buttons Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        
        {/* Tab Selection */}
        <div style={{ display: 'flex', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.2rem', backgroundColor: 'hsl(var(--bg-secondary))' }}>
          {['All', 'Pending', 'In Progress', 'Paused', 'Resolved', 'Closed'].map(statusTab => (
            <button
              key={statusTab}
              onClick={() => setActiveTab(statusTab)}
              className="btn"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                backgroundColor: activeTab === statusTab ? 'hsl(var(--primary))' : 'transparent',
                color: activeTab === statusTab ? '#fff' : 'hsl(var(--fg-secondary))',
                borderRadius: 'calc(var(--radius-md) - 2px)'
              }}
            >
              {statusTab}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => openModal('new')}>
            <Plus size={16} /> Create Ticket
          </button>
          
          <button className="btn btn-secondary" onClick={() => openModal('import')}>
            <Upload size={16} /> Import Excel
          </button>

          <button className="btn btn-secondary" onClick={exportFilteredToExcel}>
            <Download size={16} /> Export Excel
          </button>

          {/* Column Visibility Control */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" onClick={() => setShowColDropdown(!showColDropdown)}>
              <Filter size={16} /> Columns <ChevronDown size={14} />
            </button>
            {showColDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowColDropdown(false)} />
                <div style={{
                  position: 'absolute', right: 0, marginTop: '0.5rem',
                  backgroundColor: 'hsl(var(--bg-secondary))',
                  border: '1px solid hsl(var(--border-color))',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem',
                  boxShadow: 'var(--shadow-md)', zIndex: 100,
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '160px'
                }}>
                  {Object.keys(visibleColumns).map(col => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }))}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{col}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Search Bar & Bulk Actions Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--fg-secondary))' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search Ticket ID, Company or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '100%', backgroundColor: 'hsl(var(--bg-secondary))' }}
          />
        </div>

        {selectedTickets.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 1rem', border: '1px solid hsl(var(--border-color))',
            borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(59, 130, 246, 0.05)'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedTickets.length} Selected</span>
            
            {/* Bulk status */}
            <select 
              className="form-control" 
              defaultValue=""
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkAction('status', e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
            >
              <option value="" disabled>Bulk Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Paused">Paused</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Bulk priority */}
            <select 
              className="form-control" 
              defaultValue=""
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkAction('priority', e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
            >
              <option value="" disabled>Bulk Priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>

            {/* Bulk assign */}
            <select 
              className="form-control" 
              defaultValue=""
              onChange={(e) => {
                if(e.target.value) {
                  handleBulkAction('assign', e.target.value);
                  e.target.value = '';
                }
              }}
              style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }}
            >
              <option value="" disabled>Bulk Assign</option>
              {staff.filter(s=>s.is_active).map(s=>(
                <option key={s.technical_id} value={s.technical_id}>{s.firstname} {s.lastname}</option>
              ))}
            </select>

            <button className="btn btn-secondary" onClick={() => handleBulkAction('archive', null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              <Archive size={14} /> Archive
            </button>

            <button className="btn btn-danger" onClick={() => handleBulkAction('delete', null)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Grouped Clients & Tickets List */}
      <div>
        {Object.keys(companyGroups).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'hsl(var(--bg-secondary))', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-lg)', color: 'hsl(var(--fg-secondary))' }}>
            <ClipboardList size={36} style={{ marginBottom: '1rem', color: 'hsl(var(--fg-muted))' }} />
            <p>No tickets matching the filter criteria were found.</p>
          </div>
        ) : (
          Object.keys(companyGroups).map(companyName => {
            const groupTickets = companyGroups[companyName];
            const isCollapsed = collapsedCompanies[companyName];
            
            // Check if all tickets resolved/closed in group
            const allResolved = groupTickets.every(t => t.status === 'Resolved' || t.status === 'Closed');
            
            const groupSelectedCount = groupTickets.filter(t => selectedTickets.includes(t.ticket_id)).length;
            const allGroupSelected = groupSelectedCount === groupTickets.length;

            return (
              <div 
                key={companyName} 
                className={`company-group ${allResolved ? 'resolved-tickets' : 'active-tickets'}`}
              >
                
                {/* Collapsible Header */}
                <div 
                  className="company-header"
                  onClick={() => toggleCompanyCollapse(companyName)}
                >
                  <div className="company-title" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      onChange={() => handleSelectAllGroup(groupTickets)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{companyName}</span>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>
                      ({groupTickets.length} ticket{groupTickets.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${allResolved ? 'badge-resolved' : 'badge-pending'}`}>
                      {allResolved ? 'Completed' : 'Active Tickets'}
                    </span>
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Collapsible Body */}
                {!isCollapsed && (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', padding: '0.9rem 1.2rem' }}></th>
                          {visibleColumns.id && <th>ID</th>}
                          {visibleColumns.product && <th>Product</th>}
                          {visibleColumns.concern && <th>Concern Type</th>}
                          {visibleColumns.priority && <th>Priority</th>}
                          {visibleColumns.status && <th>Status</th>}
                          {visibleColumns.technician && <th>Assigned Tech</th>}
                          {visibleColumns.date && <th>Date Requested</th>}
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupTickets.map(ticket => (
                          <tr key={ticket.ticket_id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedTickets.includes(ticket.ticket_id)}
                                onChange={() => handleSelectTicket(ticket.ticket_id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            {visibleColumns.id && <td style={{ fontWeight: 600 }}>#{ticket.ticket_id}</td>}
                            {visibleColumns.product && <td>{ticket.products?.product_name || 'N/A'}</td>}
                            {visibleColumns.concern && <td>{ticket.concerns?.concern_name || 'N/A'}</td>}
                            {visibleColumns.priority && (
                              <td>
                                <span className={`badge badge-${ticket.priority?.toLowerCase()}`}>
                                  {ticket.priority}
                                </span>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td>
                                <span className={`badge badge-${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                                  {ticket.status}
                                </span>
                              </td>
                            )}
                            {visibleColumns.technician && (
                              <td>{ticket.technical_staff ? `${ticket.technical_staff.firstname} ${ticket.technical_staff.lastname}` : 'Unassigned'}</td>
                            )}
                            {visibleColumns.date && (
                              <td>{new Date(ticket.date_requested).toLocaleDateString()}</td>
                            )}
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => openModal('view', ticket)} title="View Details">
                                  <Eye size={14} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => openModal('assign', ticket)} title="Assign Technician">
                                  <UserPlus size={14} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => openModal('status', ticket)} title="Update Status">
                                  <ClipboardList size={14} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => openModal('edit', ticket)} title="Edit Ticket">
                                  <Save size={14} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.3rem', color: '#ff7675' }} onClick={() => openModal('archive', ticket)} title="Archive Ticket">
                                  <Archive size={14} />
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

      {/* ----------------------------------------------------------------- */}
      {/* MODALS SECTION */}
      {/* ----------------------------------------------------------------- */}
      
      {/* View Modal */}
      {activeModal === 'view' && targetTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ticket Details #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h4 style={{ marginBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem' }}>Client Information</h4>
                <p><strong>Company:</strong> {targetTicket.clients?.company_name}</p>
                <p><strong>Contact Person:</strong> {targetTicket.clients?.contact_person}</p>
                <p><strong>Viber / Number:</strong> {targetTicket.clients?.contact_number || 'N/A'}</p>
                <p><strong>Email:</strong> {targetTicket.clients?.email || 'N/A'}</p>
              </div>
              <div>
                <h4 style={{ marginBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.25rem' }}>Ticket Specifications</h4>
                <p><strong>Product:</strong> {targetTicket.products?.product_name} ({targetTicket.products?.version})</p>
                <p><strong>Concern:</strong> {targetTicket.concerns?.concern_name}</p>
                <p><strong>Priority:</strong> <span className={`badge badge-${targetTicket.priority?.toLowerCase()}`}>{targetTicket.priority}</span></p>
                <p><strong>Status:</strong> <span className={`badge badge-${targetTicket.status?.toLowerCase().replace(' ', '-')}`}>{targetTicket.status}</span></p>
                <p><strong>Assigned To:</strong> {targetTicket.technical_staff ? `${targetTicket.technical_staff.firstname} ${targetTicket.technical_staff.lastname}` : 'Unassigned'}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
              <h4>Concern Description</h4>
              <p style={{ backgroundColor: 'hsl(var(--bg-tertiary))', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                {targetTicket.concern_description || 'No description provided.'}
              </p>
            </div>

            {targetTicket.solution && (
              <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem' }}>
                <h4 style={{ color: '#00b894' }}>Documented Solution</h4>
                <p style={{ backgroundColor: 'rgba(0, 184, 148, 0.08)', borderLeft: '4px solid #00b894', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
                  {targetTicket.solution}
                </p>
              </div>
            )}

            {/* Remarks Timeline */}
            <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4>Remarks & History Timeline</h4>
              
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                {ticketRemarks.length === 0 ? (
                  <p style={{ color: 'hsl(var(--fg-secondary))', fontStyle: 'italic', fontSize: '0.85rem' }}>No remarks written yet.</p>
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

              <form onSubmit={handleAddRemark} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Type a new remark..."
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

      {/* Assign Modal */}
      {activeModal === 'assign' && targetTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Ticket #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Select Technical Staff</label>
                <select 
                  className="form-control"
                  value={assignTechId}
                  onChange={(e) => setAssignTechId(e.target.value)}
                  required
                >
                  <option value="">-- Choose technician --</option>
                  {staff.filter(s => s.is_active).map(s => (
                    <option key={s.technical_id} value={s.technical_id}>
                      {s.firstname} {s.lastname} ({s.position} - {s.branch})
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary))' }}>
                Note: Assigning a technician shifts the status of this ticket to **In Progress** automatically.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {activeModal === 'status' && targetTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Status: Ticket #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Ticket Status</label>
                <select 
                  className="form-control"
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  required
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Paused">Paused</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {(statusVal === 'Resolved' || statusVal === 'Closed') && (
                <div className="form-group">
                  <label style={{ color: '#00b894' }}>Documented Solution (Required)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Describe the solution applied to close this concern..."
                    value={solutionVal}
                    onChange={(e) => setSolutionVal(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Internal Remarks / Note (Optional)</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Add details regarding this status update..."
                  value={remarksVal}
                  onChange={(e) => setRemarksVal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Status</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Ticket Modal */}
      {(activeModal === 'new' || activeModal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeModal === 'new' ? 'Create Support Ticket' : 'Edit Ticket Details'}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditOrCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group">
                <label>Client Company {renderAsterisk(ticketForm.company_id)}</label>
                <select
                  className="form-control"
                  value={ticketForm.company_id}
                  onChange={(e) => setTicketForm({ ...ticketForm, company_id: e.target.value })}
                  required
                >
                  {clients.map(c => (
                    <option key={c.client_id} value={c.client_id}>{c.company_name} ({c.contact_person})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div className="form-group">
                  <label>Product {renderAsterisk(isAddingProduct ? newProductName : ticketForm.product_id)}</label>
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
                      value={ticketForm.product_id}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setIsAddingProduct(true);
                        } else {
                          setTicketForm({ ...ticketForm, product_id: e.target.value });
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
                  <label>Concern Category {renderAsterisk(ticketForm.concern_id)}</label>
                  <select
                    className="form-control"
                    value={ticketForm.concern_id}
                    onChange={(e) => setTicketForm({ ...ticketForm, concern_id: e.target.value })}
                    required
                  >
                    {concerns.map(cn => (
                      <option key={cn.concern_id} value={cn.concern_id}>{cn.concern_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Concern Description {isOthersSelected && renderAsterisk(ticketForm.concern_description)}</label>
                 <textarea
                  className="form-control"
                  rows="3"
                  value={ticketForm.concern_description}
                  onChange={(e) => setTicketForm({ ...ticketForm, concern_description: e.target.value })}
                  placeholder={isOthersSelected ? "Details of the client issue (required)..." : "Details of the client issue (optional)..."}
                  required={isOthersSelected}
                />
              </div>

               <div className="form-group">
                <label>Priority {renderAsterisk(ticketForm.priority)}</label>
                <select
                  className="form-control"
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="form-group">
                <label>Assign Technician (Optional)</label>
                <select
                  className="form-control"
                  value={ticketForm.technical_id}
                  onChange={(e) => setTicketForm({ ...ticketForm, technical_id: e.target.value })}
                >
                  <option value="">-- Unassigned --</option>
                  {staff.filter(s => s.is_active).map(s => (
                    <option key={s.technical_id} value={s.technical_id}>{s.firstname} {s.lastname}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Ticket</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {activeModal === 'archive' && targetTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Archive Ticket #{targetTicket.ticket_id}</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleArchiveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label>Archive Reason</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Enter reason for soft deleting/archiving this ticket..."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-danger">Confirm Archive</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {activeModal === 'import' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Tickets from Excel</h2>
              <button className="close-modal-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleExcelImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ backgroundColor: 'hsl(var(--bg-tertiary))', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Please use our standardized template headers structure to format your spreadsheets.
                </p>
                <button type="button" className="btn btn-secondary" onClick={downloadTemplate} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  <Download size={14} /> Download Template
                </button>
              </div>

              <div className="form-group">
                <label>Select Spreadsheet File (.xlsx, .xls)</label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  required
                />
              </div>

              <div className="form-group">
                <label>Duplicate Records Strategy</label>
                <select
                  className="form-control"
                  value={dupStrategy}
                  onChange={(e) => setDupStrategy(e.target.value)}
                >
                  <option value="merge">Merge (Create new ticket row)</option>
                  <option value="overwrite">Overwrite (Update active matching tickets)</option>
                  <option value="skip">Skip (Do not import matching records)</option>
                </select>
              </div>

              {importStatus && (
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>{importStatus}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!importFile || importStatus !== ''}>Start Import</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
