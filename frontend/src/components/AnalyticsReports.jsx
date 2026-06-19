import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, Tooltip, Legend, LineChart, Line 
} from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { Calendar, Download, Printer, BarChart3, TrendingUp, Award, BookOpen } from 'lucide-react';

const COLORS = ['#fdcb6e', '#74b9ff', '#0984e3', '#ffeaa7', '#00b894', '#6c5ce7'];
const PRIORITY_COLORS = {
  Low: '#64748b',
  Medium: '#3b82f6',
  High: '#ef4444'
};

export default function AnalyticsReports({ tickets, staff }) {
  const [datePreset, setDatePreset] = useState('This Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [visibleResolvedCount, setVisibleResolvedCount] = useState(5);

  // Filter tickets by date range
  const filteredTickets = useMemo(() => {
    const now = new Date();
    let start = new Date(0); // Epoch
    let end = new Date();

    if (datePreset === 'Today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (datePreset === 'Yesterday') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (datePreset === 'This Week') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (datePreset === 'This Month') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (datePreset === 'Last Month') {
      start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (datePreset === 'Custom' && customStart) {
      start = new Date(customStart);
      if (customEnd) end = new Date(customEnd + 'T23:59:59');
    }

    return tickets.filter(t => {
      const date = new Date(t.date_requested);
      return date >= start && date <= end;
    });
  }, [tickets, datePreset, customStart, customEnd]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    const resolved = filteredTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    const rate = total > 0 ? Math.round((resolved.length / total) * 100) : 0;

    // Elapsed times (hours between date_requested and finish_date for resolved ones)
    const elapsedTimes = resolved
      .filter(t => t.finish_date)
      .map(t => {
        const diff = new Date(t.finish_date) - new Date(t.date_requested);
        return Math.max(0, diff / (1000 * 60 * 60)); // hours
      });

    const avg = elapsedTimes.length > 0 ? Math.round(elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length) : 0;
    const min = elapsedTimes.length > 0 ? Math.round(Math.min(...elapsedTimes)) : 0;
    const max = elapsedTimes.length > 0 ? Math.round(Math.max(...elapsedTimes)) : 0;

    // Solution Documented Rate (tickets with solution field)
    const hasSolution = resolved.filter(t => t.solution && t.solution.trim().length > 0);
    const solRate = resolved.length > 0 ? Math.round((hasSolution.length / resolved.length) * 100) : 0;

    return { total, resolvedCount: resolved.length, rate, avg, min, max, solRate };
  }, [filteredTickets]);

  // Chart Data: Status Distribution
  const statusData = useMemo(() => {
    const counts = {};
    filteredTickets.forEach(t => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    }));
  }, [filteredTickets]);

  // Chart Data: Priority Counts
  const priorityData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    filteredTickets.forEach(t => {
      if (counts[t.priority] !== undefined) counts[t.priority]++;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      tickets: counts[key]
    }));
  }, [filteredTickets]);

  // Chart Data: Resolution Trend (grouped by Day of Month)
  const trendData = useMemo(() => {
    const counts = {};
    // Group resolved tickets by date format 'YYYY-MM-DD'
    const resolved = filteredTickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.finish_date);
    
    resolved.forEach(t => {
      const dStr = new Date(t.finish_date).toISOString().split('T')[0];
      counts[dStr] = (counts[dStr] || 0) + 1;
    });

    return Object.keys(counts)
      .sort()
      .map(date => ({
        date,
        resolved: counts[date]
      }));
  }, [filteredTickets]);

  // Chart Data: Technician Output Rating
  const outputData = useMemo(() => {
    const counts = {};
    const resolved = filteredTickets.filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.technical_id);
    
    resolved.forEach(t => {
      const name = t.technical_staff ? `${t.technical_staff.firstname} ${t.technical_staff.lastname}` : 'Unassigned';
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.keys(counts).map(name => ({
      name,
      resolved: counts[name]
    })).sort((a, b) => b.resolved - a.resolved).slice(0, 5);
  }, [filteredTickets]);

  // Solution Frequency Table
  const solutionsFrequency = useMemo(() => {
    const freqs = {};
    filteredTickets
      .filter(t => t.solution && t.solution.trim().length > 0)
      .forEach(t => {
        const sol = t.solution.trim();
        freqs[sol] = (freqs[sol] || 0) + 1;
      });

    return Object.keys(freqs)
      .map(sol => ({ solution: sol, count: freqs[sol] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredTickets]);

  // Top Performers Leaderboard
  const performersLeaderboard = useMemo(() => {
    return [...staff]
      .map(s => {
        // Find tickets resolved by this technician in the filtered range
        const resolvedInRange = filteredTickets.filter(t => 
          t.technical_id === s.technical_id && 
          (t.status === 'Resolved' || t.status === 'Closed')
        ).length;
        
        return {
          ...s,
          resolvedInRange
        };
      })
      .sort((a, b) => b.resolvedInRange - a.resolvedInRange)
      .slice(0, 5);
  }, [staff, filteredTickets]);

  // Resolved tickets searchable list
  const resolvedList = useMemo(() => {
    return filteredTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
  }, [filteredTickets]);

  // PDF Export
  const handleExportPDF = async () => {
    const element = document.getElementById('analytics-report-view');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190; // margins
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10; // margin top

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`TicketMonitoring_Analytics_Report_${datePreset}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    }
  };

  // Excel Stats Export
  const handleExportExcel = () => {
    const summaryData = [
      { Metric: 'Total Tickets Requested', Value: metrics.total },
      { Metric: 'Total Resolved/Closed', Value: metrics.resolvedCount },
      { Metric: 'Resolution Rate (%)', Value: `${metrics.rate}%` },
      { Metric: 'Avg Resolution Time (hrs)', Value: metrics.avg },
      { Metric: 'Min Resolution Time (hrs)', Value: metrics.min },
      { Metric: 'Max Resolution Time (hrs)', Value: metrics.max },
      { Metric: 'Solution Documented (%)', Value: `${metrics.solRate}%` }
    ];

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Overview Metrics');

    // Add list of resolved tickets
    const resolvedRows = resolvedList.map(t => ({
      'Ticket ID': t.ticket_id,
      'Company Name': t.clients?.company_name || 'N/A',
      'Product': t.products?.product_name || 'N/A',
      'Priority': t.priority,
      'Date Requested': new Date(t.date_requested).toLocaleDateString(),
      'Date Finished': t.finish_date ? new Date(t.finish_date).toLocaleDateString() : 'N/A',
      'Solution Summary': t.solution || ''
    }));
    const wsResolved = XLSX.utils.json_to_sheet(resolvedRows);
    XLSX.utils.book_append_sheet(wb, wsResolved, 'Resolved Tickets Log');

    XLSX.writeFile(wb, `TicketMonitoring_Analytics_Export_${datePreset}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Date controls and prints */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Preset filter */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Calendar size={18} style={{ color: 'hsl(var(--fg-secondary))' }} />
          <div style={{ display: 'flex', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.2rem', backgroundColor: 'hsl(var(--bg-secondary))' }}>
            {['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'Custom'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className="btn"
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.8rem',
                  backgroundColor: datePreset === preset ? 'hsl(var(--primary))' : 'transparent',
                  color: datePreset === preset ? '#fff' : 'hsl(var(--fg-secondary))',
                  borderRadius: 'calc(var(--radius-md) - 2px)'
                }}
              >
                {preset}
              </button>
            ))}
          </div>
          
          {datePreset === 'Custom' && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="date"
                className="form-control"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span>to</span>
              <input
                type="date"
                className="form-control"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Prints buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            <Printer size={16} /> Save PDF Report
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <Download size={16} /> Export Sheets
          </button>
        </div>

      </div>

      {/* Analytics Printable View Wrapper */}
      <div id="analytics-report-view" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Title for PDF Exporting */}
        <div style={{ borderBottom: '2px solid hsl(var(--primary))', paddingBottom: '0.5rem' }}>
          <h2 style={{ fontFamily: 'Outfit', color: 'hsl(var(--fg-primary))' }}>Ticket Monitoring Interactive Report</h2>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary))' }}>
            Period span: {datePreset} {datePreset === 'Custom' ? `(${customStart} to ${customEnd})` : ''} • Generated on {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Period Aggregates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          <div className="metric-card" style={{ padding: '1.25rem' }}>
            <div className="metric-info">
              <h3>Resolution Rate</h3>
              <span className="metric-value" style={{ color: '#00b894' }}>{metrics.rate}%</span>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))', marginTop: '0.25rem' }}>
                {metrics.resolvedCount} of {metrics.total} tickets resolved
              </div>
            </div>
          </div>

          <div className="metric-card" style={{ padding: '1.25rem' }}>
            <div className="metric-info">
              <h3>Avg Speed to Resolve</h3>
              <span className="metric-value" style={{ color: '#0984e3' }}>{metrics.avg} <span style={{ fontSize: '1rem', fontWeight: 500 }}>hrs</span></span>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))', marginTop: '0.25rem' }}>
                Min: {metrics.min}h | Max: {metrics.max}h
              </div>
            </div>
          </div>

          <div className="metric-card" style={{ padding: '1.25rem' }}>
            <div className="metric-info">
              <h3>Documented Solutions</h3>
              <span className="metric-value" style={{ color: '#6c5ce7' }}>{metrics.solRate}%</span>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))', marginTop: '0.25rem' }}>
                Rate of resolved having notes
              </div>
            </div>
          </div>

        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* Status Doughnut */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={16} /> Status Distribution</span>
            </div>
            {statusData.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--fg-secondary))' }}>No status data available.</p>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Priority Levels Horizontal Bar */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={16} /> Priority Levels Breakdown</span>
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={priorityData} layout="vertical">
                  <XAxis type="number" stroke="hsl(var(--fg-muted))" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--fg-muted))" fontSize={11} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="tickets" radius={[0, 4, 4, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resolution Trend Line */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={16} /> Resolution Trend (Days)</span>
            </div>
            {trendData.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--fg-secondary))' }}>No resolutions in selected date range.</p>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" stroke="hsl(var(--fg-muted))" fontSize={11} />
                    <YAxis stroke="hsl(var(--fg-muted))" fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="resolved" stroke="#00b894" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Technician Output Rating */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={16} /> Technician Output Ranking</span>
            </div>
            {outputData.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--fg-secondary))' }}>No technician outputs recorded.</p>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={outputData}>
                    <XAxis dataKey="name" stroke="hsl(var(--fg-muted))" fontSize={11} />
                    <YAxis stroke="hsl(var(--fg-muted))" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="resolved" fill="#0984e3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          )}
          </div>

        </div>

        {/* Top Performers and Solutions tables */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          
          {/* Top Performers */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={16} /> Top Performers Leaderboard</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Technician</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {performersLeaderboard.map((perf, index) => (
                  <tr key={perf.technical_id}>
                    <td>
                      <span className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{perf.firstname} {perf.lastname}</td>
                    <td><strong>{perf.resolvedInRange}</strong> resolved</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Solution Frequency */}
          <div className="card-widget">
            <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={16} /> Solution Frequency Table</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documented Resolution</th>
                  <th>Occurrences</th>
                </tr>
              </thead>
              <tbody>
                {solutionsFrequency.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', color: 'hsl(var(--fg-secondary))', padding: '1.5rem' }}>No solutions logged.</td>
                  </tr>
                ) : (
                  solutionsFrequency.map((sol, index) => (
                    <tr key={index}>
                      <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sol.solution}</td>
                      <td><strong>{sol.count}</strong> times</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Resolved Tickets List with Paginated listing */}
        <div className="card-widget">
          <div className="widget-title" style={{ borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.5rem' }}>
            <span>Searchable List of Resolved Tickets</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Product</th>
                <th>Priority</th>
                <th>Date Resolved</th>
                <th>Solution Details</th>
              </tr>
            </thead>
            <tbody>
              {resolvedList.slice(0, visibleResolvedCount).map(t => (
                <tr key={t.ticket_id}>
                  <td style={{ fontWeight: 600 }}>#{t.ticket_id}</td>
                  <td>{t.clients?.company_name}</td>
                  <td>{t.products?.product_name}</td>
                  <td>
                    <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                  </td>
                  <td>{t.finish_date ? new Date(t.finish_date).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {resolvedList.length > visibleResolvedCount && (
            <button 
              className="btn btn-secondary" 
              onClick={() => setVisibleResolvedCount(prev => prev + 5)}
              style={{ alignSelf: 'center', marginTop: '1rem' }}
            >
              Show More Resolved Tickets
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
