import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, CheckCheck, Info, TicketCheck, ClipboardList } from 'lucide-react';
import supabase from '../supabaseClient';

// Helper: localStorage key for client's seen resolved ticket IDs
const clientSeenKey = (companyId) => `client_seen_resolved_${companyId}`;

function getClientSeenIds(companyId) {
  try {
    const raw = localStorage.getItem(clientSeenKey(companyId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClientSeenIds(companyId, ids) {
  try {
    localStorage.setItem(clientSeenKey(companyId), JSON.stringify(ids));
  } catch { /* ignore */ }
}

/**
 * Smart timestamp:
 *  - Same day          → "2:30 PM"
 *  - Yesterday         → "Yesterday · 2:30 PM"
 *  - Within 7 days     → "Mon · 2:30 PM"
 *  - Older             → "Jun 17 · 2:30 PM"  (or "Jun 17, 2024" across years)
 */
function formatNotifTime(rawDate) {
  if (!rawDate) return '';
  const date  = new Date(rawDate);
  const now   = new Date();
  const time  = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86400000);
  const startOf7DaysAgo  = new Date(startOfToday - 6 * 86400000);

  if (date >= startOfToday) {
    return time;                                          // "2:30 PM"
  } else if (date >= startOfYesterday) {
    return `Yesterday · ${time}`;                        // "Yesterday · 2:30 PM"
  } else if (date >= startOf7DaysAgo) {
    const day = date.toLocaleDateString([], { weekday: 'short' });
    return `${day} · ${time}`;                           // "Mon · 2:30 PM"
  } else {
    const sameYear = date.getFullYear() === now.getFullYear();
    const dateStr  = date.toLocaleDateString([], {
      month: 'short', day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' })
    });
    return `${dateStr} · ${time}`;                      // "Jun 17 · 2:30 PM"
  }
}


export default function NotificationCenter({ userProfile, tickets, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const isAdmin  = userProfile?.position === 'Admin';
  const isClient = userProfile?.userType === 'client';
  const isTech   = !isAdmin && !isClient && userProfile?.userType === 'staff';

  // ---------------------------------------------------------------
  // Build notification list whenever tickets or profile changes
  // ---------------------------------------------------------------
  const buildNotifications = useCallback(() => {
    if (!userProfile) return;

    if (isAdmin) {
      // Admin: new tickets submitted by clients (Pending + unread)
      const newTickets = tickets.filter(t => t.status === 'Pending' && !t.is_viewed);
      setNotifications(newTickets);

    } else if (isTech) {
      // Tech: tickets newly assigned to them (unread)
      const assigned = tickets.filter(
        t => t.technical_id === userProfile.technical_id && !t.is_viewed
      );
      setNotifications(assigned);

    } else if (isClient) {
      // Client: their tickets that have been resolved and not yet seen
      const companyId = userProfile.client_id;
      const seenIds   = getClientSeenIds(companyId);
      const resolved  = tickets.filter(
        t => t.company_id === companyId &&
             t.status === 'Resolved' &&
             !seenIds.includes(t.ticket_id)
      );
      setNotifications(resolved);
    }
  }, [tickets, userProfile, isAdmin, isTech, isClient]);

  useEffect(() => {
    buildNotifications();
  }, [buildNotifications]);

  // ---------------------------------------------------------------
  // Realtime subscription
  // ---------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('notif-center-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => onRefresh()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [onRefresh]);

  // ---------------------------------------------------------------
  // Dismiss handlers
  // ---------------------------------------------------------------

  // Admin / Tech: mark single ticket is_viewed = true in DB
  const handleDismissDB = async (ticketId, e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ is_viewed: true })
        .eq('ticket_id', ticketId);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  // Client: mark single resolved ticket as seen in localStorage
  const handleDismissClient = (ticketId, e) => {
    e.stopPropagation();
    const companyId = userProfile.client_id;
    const seenIds   = getClientSeenIds(companyId);
    if (!seenIds.includes(ticketId)) {
      saveClientSeenIds(companyId, [...seenIds, ticketId]);
    }
    setNotifications(prev => prev.filter(n => n.ticket_id !== ticketId));
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    if (isClient) {
      const companyId = userProfile.client_id;
      const allIds    = notifications.map(n => n.ticket_id);
      const seenIds   = getClientSeenIds(companyId);
      saveClientSeenIds(companyId, [...new Set([...seenIds, ...allIds])]);
      setNotifications([]);
      return;
    }
    // Admin / Tech: DB update
    try {
      const unreadIds = notifications.map(n => n.ticket_id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from('tickets')
        .update({ is_viewed: true })
        .in('ticket_id', unreadIds);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // ---------------------------------------------------------------
  // Empty state label
  // ---------------------------------------------------------------
  const emptyLabel = isAdmin
    ? 'No new tickets submitted.'
    : isClient
    ? 'No resolved tickets yet.'
    : 'No new assigned tickets.';

  // ---------------------------------------------------------------
  // Notification card label
  // ---------------------------------------------------------------
  const notifLabel = (notif) => {
    if (isAdmin)  return `New ticket submitted by ${notif.clients?.company_name || 'a client'}`;
    if (isClient) return `Your ticket has been resolved!`;
    return `New ticket assigned to you`;
  };

  const notifIcon = (notif) => {
    if (isAdmin)  return <ClipboardList size={14} style={{ color: '#fdcb6e' }} />;
    if (isClient) return <TicketCheck   size={14} style={{ color: '#00b894' }} />;
    return              <TicketCheck    size={14} style={{ color: 'hsl(var(--primary))' }} />;
  };

  const accentColor = isClient ? '#00b894' : isAdmin ? '#fdcb6e' : 'hsl(var(--primary))';

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Trigger */}
      <button
        className="theme-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative', border: '1px solid hsl(var(--border-color))' }}
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="notification-count">{notifications.length}</span>
        )}
      </button>

      {/* Slide-over Notification Panel */}
      {isOpen && (
        <>
          <div
            className="modal-overlay"
            style={{ backgroundColor: 'transparent', zIndex: 1004 }}
            onClick={() => setIsOpen(false)}
          />
          <div className="slide-over" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit', fontSize: '1.2rem' }}>
                <Bell size={18} /> Notifications
                {notifications.length > 0 && (
                  <span style={{
                    backgroundColor: accentColor, color: '#fff',
                    borderRadius: '999px', fontSize: '0.7rem',
                    padding: '0.1rem 0.45rem', fontWeight: 700
                  }}>{notifications.length}</span>
                )}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {notifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <CheckCheck size={14} /> Clear all
                  </button>
                )}
                <button className="close-modal-btn" onClick={() => setIsOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'hsl(var(--fg-secondary))', gap: '0.5rem' }}>
                  <Info size={24} />
                  <p>{emptyLabel}</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.ticket_id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${accentColor}44`,
                      backgroundColor: 'hsl(var(--bg-tertiary))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      position: 'relative',
                      borderLeft: `3px solid ${accentColor}`
                    }}
                  >
                    {/* Row 1: label + priority */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'hsl(var(--fg-primary))', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
                        {notifIcon(notif)}
                        {notifLabel(notif)}
                      </span>
                      <span className={`badge badge-${notif.priority?.toLowerCase()}`}>
                        {notif.priority}
                      </span>
                    </div>

                    {/* Row 2: ticket ID + client */}
                    <p style={{ fontSize: '0.82rem', color: 'hsl(var(--fg-secondary))' }}>
                      <strong>Ticket #{notif.ticket_id}</strong>
                      {isClient
                        ? notif.solution && ` — ${notif.solution.length > 55 ? notif.solution.substring(0, 55) + '…' : notif.solution}`
                        : ` — ${notif.clients?.company_name || ''}`
                      }
                    </p>

                    {/* Row 3: concern */}
                    {notif.concern_description && (
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))', fontStyle: 'italic' }}>
                        "{notif.concern_description.length > 70
                          ? notif.concern_description.substring(0, 70) + '…'
                          : notif.concern_description}"
                      </p>
                    )}

                    {/* Row 4: time + dismiss */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-muted))' }}>
                        {formatNotifTime(notif.updated_at || notif.date_requested)}
                      </span>
                      <button
                        onClick={(e) => isClient ? handleDismissClient(notif.ticket_id, e) : handleDismissDB(notif.ticket_id, e)}
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
