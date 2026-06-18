import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCheck, Info } from 'lucide-react';
import supabase from '../supabaseClient';

export default function NotificationCenter({ userProfile, tickets, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!userProfile) return;
    const isAdmin = userProfile.position === 'Admin';
    if (isAdmin) {
      // Admin gets notified of Resolved tickets that are unread
      const resolvedUnread = tickets.filter(t => t.status === 'Resolved' && !t.is_viewed);
      setNotifications(resolvedUnread);
    } else {
      // Technician gets notified of tickets assigned to them that are unread
      const techUnread = tickets.filter(
        t => t.technical_id === userProfile.technical_id && !t.is_viewed
      );
      setNotifications(techUnread);
    }
  }, [tickets, userProfile]);

  // Realtime subscription for tickets
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          console.log('Realtime change received:', payload);
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  const handleDismiss = async (ticketId, e) => {
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

  const handleMarkAllRead = async () => {
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Outfit', fontSize: '1.2rem' }}>
                <Bell size={18} /> Notifications
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

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'hsl(var(--fg-secondary))', gap: '0.5rem' }}>
                  <Info size={24} />
                  <p>{userProfile?.position === 'Admin' ? 'No new resolved tickets.' : 'No new assigned tickets.'}</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.ticket_id} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid hsl(var(--border-color))', 
                      backgroundColor: 'hsl(var(--bg-tertiary))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'hsl(var(--fg-primary))' }}>
                        Ticket #{notif.ticket_id}
                      </span>
                      <span className={`badge badge-${notif.priority?.toLowerCase()}`}>
                        {notif.priority}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary))' }}>
                      <strong>Client:</strong> {notif.clients?.company_name || 'Loading client...'}
                    </p>

                    {notif.solution && (
                      <div style={{ 
                        fontSize: '0.8rem', 
                        padding: '0.5rem', 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: 'hsl(var(--bg-secondary))',
                        borderLeft: '3px solid #00b894',
                        color: 'hsl(var(--fg-primary))'
                      }}>
                        <strong>Solution:</strong> {notif.solution.length > 60 ? `${notif.solution.substring(0, 60)}...` : notif.solution}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-muted))' }}>
                        {new Date(notif.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={(e) => handleDismiss(notif.ticket_id, e)}
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
