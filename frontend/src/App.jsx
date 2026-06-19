import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase
} from './supabaseClient';
import logoMssc from './assets/logo_mssc.png';
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, LogOut, Sun, Moon,
  Lock, ArrowRight, ShieldAlert, CheckCircle, Settings, Key, Building,
  Eye, EyeOff, X
} from 'lucide-react';
import NotificationCenter from './components/NotificationCenter';
import AdminDashboard from './components/AdminDashboard';
import TicketManager from './components/TicketManager';
import TechnicalManager from './components/TechnicalManager';
import AnalyticsReports from './components/AnalyticsReports';
import TechnicianDashboard from './components/TechnicianDashboard';
import ClientDashboard from './components/ClientDashboard';
import ClientManager from './components/ClientManager';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const isExplicitLoginRef = useRef(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // App Navigation
  const [activeTab, setActiveTab] = useState('dashboard');

  // Global Data States
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [products, setProducts] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Authentication UI Toggle
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

  // Auth Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [position, setPosition] = useState('Technical');
  const [branch, setBranch] = useState('DAVAO');
  const [adminPasscode, setAdminPasscode] = useState('');

  // Client Sign Up Form Fields
  const [companyName, setCompanyName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Password visibility toggles
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showAdminPw, setShowAdminPw] = useState(false);

  // Auth Modal popup for guests
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Logout modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Success login toast state
  const [loginToast, setLoginToast] = useState('');

  // Routing state (determine if rendering client login or technical staff login)
  const [isTechnicalUrl, setIsTechnicalUrl] = useState(
    window.location.hash === '#/technical' ||
    window.location.search.includes('role=technical') ||
    window.location.pathname.endsWith('/technical')
  );

  // Listen to hash and URL routing changes
  useEffect(() => {
    const handleHashChange = () => {
      setIsTechnicalUrl(
        window.location.hash === '#/technical' ||
        window.location.search.includes('role=technical') ||
        window.location.pathname.endsWith('/technical')
      );
      // Reset forms & state when URL route changes
      setUsername('');
      setEmail('');
      setPassword('');
      setFirstname('');
      setLastname('');
      setPosition('Technical');
      setCompanyName('');
      setContactNumber('');
      setAuthError('');
      setAuthSuccess('');
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // -----------------------------------------------------------------
  // Theme Manager
  // -----------------------------------------------------------------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Dynamic Tab Title
  useEffect(() => {
    let title = 'Ticket Monitoring';
    if (!session) {
      title = 'Create Support Request | Ticket Monitoring';
    } else if (userProfile) {
      const type = userProfile.userType;
      const role = userProfile.position;
      const activeTabLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

      if (type === 'client') {
        if (activeTab === 'dashboard') {
          title = 'Client Dashboard | Ticket Monitoring';
        } else if (activeTab === 'tickets') {
          title = 'Support Tickets | Ticket Monitoring';
        } else {
          title = `${activeTabLabel} | Ticket Monitoring`;
        }
      } else if (role === 'Admin') {
        if (activeTab === 'dashboard') {
          title = 'Admin Dashboard | Ticket Monitoring';
        } else if (activeTab === 'tickets') {
          title = 'Manage Tickets | Ticket Monitoring';
        } else if (activeTab === 'technical') {
          title = 'Technical Managers | Ticket Monitoring';
        } else if (activeTab === 'clients') {
          title = 'Manage Clients | Ticket Monitoring';
        } else if (activeTab === 'reports') {
          title = 'Analytics & Reports | Ticket Monitoring';
        } else {
          title = `${activeTabLabel} | Ticket Monitoring`;
        }
      } else { // Technician / Staff
        if (activeTab === 'dashboard') {
          title = 'Technician Dashboard | Ticket Monitoring';
        } else if (activeTab === 'tickets') {
          title = 'Tickets Queue | Ticket Monitoring';
        } else if (activeTab === 'technical') {
          title = 'Technical Directory | Ticket Monitoring';
        } else if (activeTab === 'reports') {
          title = 'Analytics | Ticket Monitoring';
        } else {
          title = `${activeTabLabel} | Ticket Monitoring`;
        }
      }
    }
    document.title = title;
  }, [session, userProfile, activeTab]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // -----------------------------------------------------------------
  // Supabase Auth Listeners (Empty dependency array to prevent loops)
  // -----------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession) {
        fetchUserProfile(activeSession.user.id, activeSession);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
      if (activeSession) {
        fetchUserProfile(activeSession.user.id, activeSession);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch products & concerns publicly at startup for non-logged-in guest submit form
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const { data: prodData } = await supabase.from('products').select('*').order('product_name', { ascending: true });
        if (prodData && prodData.length > 0) setProducts(prodData);
        const { data: concernData } = await supabase.from('concerns').select('*').order('concern_name', { ascending: true });
        if (concernData && concernData.length > 0) setConcerns(concernData);
      } catch (err) {
        console.warn('Failed to load public data:', err);
      }
    };
    fetchPublicData();
  }, []);

  // -----------------------------------------------------------------
  // Data Fetchers
  // -----------------------------------------------------------------
  const fetchUserProfile = async (userId, currentSession) => {
    try {
      const activeSession = currentSession || session;
      const userMetadata = activeSession?.user?.user_metadata || {};
      const userEmail = activeSession?.user?.email;

      let profileData = null;

      // 1. Try to find in technical_staff table by user_id
      const { data: staffData } = await supabase
        .from('technical_staff')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (staffData) {
        profileData = { ...staffData, userType: 'staff' };
      } else {
        // 2. Try to find in clients table by user_id
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (clientData) {
          profileData = { ...clientData, userType: 'client' };
        } else {
          // Determine the user's role/type
          const userRole = userMetadata.role || userMetadata.position;
          const isUserClient = userRole === 'Client';

          if (isUserClient) {
            // 3. Fallback for Client: Search by email in clients
            let clientRow = null;
            if (userEmail) {
              const { data: clientByEmail } = await supabase
                .from('clients')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();
              clientRow = clientByEmail;
            }

            // 4. Fallback for Client: Search by company_name if email fallback failed
            if (!clientRow && userMetadata.company_name) {
              const { data: clientByCompany } = await supabase
                .from('clients')
                .select('*')
                .eq('company_name', userMetadata.company_name.trim())
                .maybeSingle();
              clientRow = clientByCompany;
            }

            if (clientRow) {
              // Link user_id in database
              const { data: updatedClient } = await supabase
                .from('clients')
                .update({ user_id: userId, email: userEmail })
                .eq('client_id', clientRow.client_id)
                .select()
                .maybeSingle();

              if (updatedClient) {
                profileData = { ...updatedClient, userType: 'client' };
              } else {
                profileData = { ...clientRow, user_id: userId, email: userEmail, userType: 'client' };
              }
            } else {
              // 5. Self-healing: Insert missing client row
              const newClientData = {
                user_id: userId,
                company_name: userMetadata.company_name?.trim() || `Company ${userId.substring(0, 8)}`,
                contact_person: `${userMetadata.firstname || ''} ${userMetadata.lastname || ''}`.trim() || 'Client User',
                contact_number: userMetadata.contact_number || '',
                email: userEmail
              };

              const { data: newClient, error: insertErr } = await supabase
                .from('clients')
                .insert([newClientData])
                .select()
                .maybeSingle();

              if (newClient) {
                profileData = { ...newClient, userType: 'client' };
              } else {
                console.error('Failed to self-heal insert client row:', insertErr);
                profileData = {
                  client_id: userId, // last resort fallback client ID
                  company_name: newClientData.company_name,
                  contact_person: newClientData.contact_person,
                  email: userEmail,
                  contact_number: newClientData.contact_number,
                  userType: 'client'
                };
              }
            }
          } else {
            // 6. Fallback for Technical Staff: Search by email in technical_staff
            let staffRow = null;
            if (userEmail) {
              const { data: staffByEmail } = await supabase
                .from('technical_staff')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();
              staffRow = staffByEmail;
            }

            if (staffRow) {
              // Link user_id in database
              const { data: updatedStaff } = await supabase
                .from('technical_staff')
                .update({ user_id: userId })
                .eq('technical_id', staffRow.technical_id)
                .select()
                .maybeSingle();

              if (updatedStaff) {
                profileData = { ...updatedStaff, userType: 'staff' };
              } else {
                profileData = { ...staffRow, user_id: userId, userType: 'staff' };
              }
            } else {
              // 7. Self-healing: Insert missing technical_staff row
              const newStaffData = {
                user_id: userId,
                firstname: userMetadata.firstname || 'Technical',
                lastname: userMetadata.lastname || 'Staff',
                email: userEmail,
                branch: userMetadata.branch || 'DAVAO',
                position: userMetadata.position || 'Technical',
                is_active: userMetadata.position === 'Admin',
                can_view_tickets: true,
                can_view_technical: true,
                can_view_reports: true
              };

              const { data: newStaff, error: insertErr } = await supabase
                .from('technical_staff')
                .insert([newStaffData])
                .select()
                .maybeSingle();

              if (newStaff) {
                profileData = { ...newStaff, userType: 'staff' };
              } else {
                console.error('Failed to self-heal insert staff row:', insertErr);
                profileData = {
                  firstname: newStaffData.firstname,
                  lastname: newStaffData.lastname,
                  position: newStaffData.position,
                  branch: newStaffData.branch,
                  is_active: newStaffData.is_active,
                  userType: 'staff'
                };
              }
            }
          }
        }
      }

      if (profileData) {
        // Check if user is logging in for the first time in this render session to trigger toast
        if (isExplicitLoginRef.current) {
          const displayName = profileData.userType === 'client'
            ? profileData.contact_person
            : `${profileData.firstname} ${profileData.lastname}`;
          setLoginToast(`Logged in successfully! Welcome back, ${displayName}.`);
          setTimeout(() => setLoginToast(''), 4000);
          isExplicitLoginRef.current = false;
        }
        setUserProfile(profileData);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const loadGlobalData = useCallback(async () => {
    if (!session || !userProfile) return;
    // Non-active technicians are blocked from loading details
    if (userProfile.userType === 'staff' && !userProfile.is_active) return;

    setIsLoadingData(true);
    try {
      // 1. Fetch tickets with relationships
      const { data: ticketsData, error: ticketErr } = await supabase
        .from('tickets')
        .select(`
          *,
          clients(company_name, contact_person, contact_number, email),
          products(product_name, version),
          concerns(concern_name),
          technical_staff(firstname, lastname, email, branch, position)
        `)
        .order('created_at', { ascending: false });

      if (ticketErr) throw ticketErr;
      setTickets(ticketsData || []);

      // 2. Fetch technical staff profiles
      const { data: staffData, error: staffErr } = await supabase
        .from('technical_staff')
        .select('*')
        .order('firstname', { ascending: true });

      if (staffErr) throw staffErr;
      setStaff(staffData || []);

      // 3. Fetch products
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('product_name', { ascending: true });

      if (prodErr) throw prodErr;
      setProducts(prodData || []);

      // 4. Fetch concerns
      const { data: concernData, error: concernErr } = await supabase
        .from('concerns')
        .select('*')
        .order('concern_name', { ascending: true });

      if (concernErr) throw concernErr;
      setConcerns(concernData || []);

      // 5. Fetch clients
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('company_name', { ascending: true });

      if (clientErr) throw clientErr;
      setClients(clientData || []);

    } catch (err) {
      console.error('Error fetching global database objects:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [session, userProfile]);

  useEffect(() => {
    if (session && userProfile) {
      loadGlobalData();
    }
  }, [session, userProfile, loadGlobalData]);

  // Refetch user profile on refresh to make sure active toggles propagate instantly
  const handleRefresh = useCallback(async () => {
    if (session) {
      await fetchUserProfile(session.user.id, session);
    }
    await loadGlobalData();
  }, [session, loadGlobalData]);

  // Polling to keep notification counters and status badges synchronized
  useEffect(() => {
    const interval = setInterval(() => {
      if (session && userProfile) {
        handleRefresh();
      }
    }, 12000); // Poll every 12 seconds
    return () => clearInterval(interval);
  }, [session, userProfile, handleRefresh]);

  // Guard: if a technician's active tab permission is revoked, redirect to dashboard
  useEffect(() => {
    if (!userProfile || userProfile.userType === 'client' || userProfile.position === 'Admin') return;
    const tabPermissions = {
      tickets: userProfile.can_view_tickets,
      technical: userProfile.can_view_technical,
      reports: userProfile.can_view_reports,
    };
    if (activeTab in tabPermissions && !tabPermissions[activeTab]) {
      setActiveTab('dashboard');
    }
  }, [userProfile, activeTab]);

  // -----------------------------------------------------------------
  // Auth Operations (Login / Signup)
  // -----------------------------------------------------------------
  const checkUsernameUnique = async (usrName) => {
    const clean = usrName.trim().toLowerCase();
    if (!clean) return false;

    const { data: clientData } = await supabase
      .from('clients')
      .select('username')
      .eq('username', clean)
      .maybeSingle();

    if (clientData) return false;

    const { data: staffData } = await supabase
      .from('technical_staff')
      .select('username')
      .eq('username', clean)
      .maybeSingle();

    if (staffData) return false;

    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      isExplicitLoginRef.current = true;
      const virtualEmail = username.trim().toLowerCase() + '@ticketmonitoring.local';
      const { error } = await supabase.auth.signInWithPassword({ email: virtualEmail, password });
      if (error) {
        isExplicitLoginRef.current = false;
        throw error;
      }
      setAuthSuccess('Logged in successfully!');
    } catch (err) {
      isExplicitLoginRef.current = false;
      setAuthError(err.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (isTechnicalUrl) {
      // Technical signup
      if (position === 'Admin' && adminPasscode !== 'Admin2026') {
        setAuthError('Incorrect Secret Admin Passcode.');
        return;
      }

      if (!username.trim() || !firstname.trim() || !lastname.trim()) {
        setAuthError('Please fill in all registration fields (including Username).');
        return;
      }

      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) {
        setAuthError('Username is already taken. Please choose another one.');
        return;
      }

      const virtualEmail = username.trim().toLowerCase() + '@ticketmonitoring.local';
      try {
        const { data: { user }, error } = await supabase.auth.signUp({
          email: virtualEmail,
          password,
          options: {
            data: {
              firstname,
              lastname,
              position,
              branch,
              role: 'Technical',
              username: username.trim().toLowerCase(),
              contact_email: email.trim() || null,
              admin_passcode: position === 'Admin' ? adminPasscode : null
            }
          }
        });

        if (error) throw error;
        if (user) {
          setAuthSuccess(
            position === 'Admin'
              ? 'Admin Account registered and approved! Logging you in...'
              : 'Registration complete. Your account is pending Admin approval.'
          );
          // Automatically login if they are admin, else prompt for approval screen
          if (position === 'Admin') {
            isExplicitLoginRef.current = true;
            try {
              const { error: signInErr } = await supabase.auth.signInWithPassword({ email: virtualEmail, password });
              if (signInErr) {
                isExplicitLoginRef.current = false;
                throw signInErr;
              }
            } catch (err) {
              isExplicitLoginRef.current = false;
              throw err;
            }
          } else {
            // Log out immediately to force approval flow
            isExplicitLoginRef.current = false;
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        setAuthError(err.message);
      }
    } else {
      // Client signup
      if (!username.trim() || !companyName.trim() || !firstname.trim() || !lastname.trim() || !contactNumber.trim()) {
        setAuthError('Please fill in all registration fields (including Username and Contact Number).');
        return;
      }

      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) {
        setAuthError('Username is already taken. Please choose another one.');
        return;
      }

      const virtualEmail = username.trim().toLowerCase() + '@ticketmonitoring.local';
      try {
        const { data: { user }, error } = await supabase.auth.signUp({
          email: virtualEmail,
          password,
          options: {
            data: {
              firstname,
              lastname,
              company_name: companyName.trim(),
              contact_number: contactNumber.trim(),
              role: 'Client',
              username: username.trim().toLowerCase(),
              contact_email: email.trim() || null
            }
          }
        });

        if (error) throw error;

        if (user) {
          setAuthSuccess('Client registration complete! Redirecting to dashboard...');
          isExplicitLoginRef.current = true;

          // Insert client entry manually as backup constraint safety (prevent duplicate console errors)
          try {
            const { data: existingClient } = await supabase
              .from('clients')
              .select('client_id, user_id')
              .eq('company_name', companyName.trim())
              .maybeSingle();

            const dbEmail = email.trim() || null;

            if (!existingClient) {
              await supabase
                .from('clients')
                .insert([{
                  user_id: user.id,
                  company_name: companyName.trim(),
                  contact_person: `${firstname.trim()} ${lastname.trim()}`,
                  contact_number: contactNumber.trim(),
                  email: dbEmail,
                  username: username.trim().toLowerCase()
                }]);
            } else {
              await supabase
                .from('clients')
                .update({
                  user_id: user.id,
                  email: dbEmail,
                  username: username.trim().toLowerCase()
                })
                .eq('client_id', existingClient.client_id);
            }
          } catch (dbErr) {
            console.warn('Backup database insert handled by database trigger:', dbErr);
          }
        }
      } catch (err) {
        setAuthError(err.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setSession(null);
    setActiveTab('dashboard');
    setAuthMode('login');
    setAuthSuccess('');
    setAuthError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setFirstname('');
    setLastname('');
    setCompanyName('');
    setContactNumber('');
    setAdminPasscode('');
  };

  const triggerLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  const handleClearTechBadge = async () => {
    setActiveTab('dashboard'); // always navigate to dashboard first
    if (!session || !userProfile || userProfile.userType !== 'staff' || userProfile.position === 'Admin') return;
    const techUnviewed = tickets.filter(t => t.technical_id === userProfile.technical_id && !t.is_viewed);
    if (techUnviewed.length > 0) {
      try {
        await supabase
          .from('tickets')
          .update({ is_viewed: true })
          .eq('technical_id', userProfile.technical_id)
          .eq('is_viewed', false);
        handleRefresh();
      } catch (err) {
        console.error('Failed to clear technician badge:', err);
      }
    }
  };

  const handleAdminTicketTabClick = async () => {
    setActiveTab('tickets');
    if (userProfile && userProfile.position === 'Admin') {
      const pendingUnviewed = tickets.filter(t => t.status === 'Pending' && !t.is_viewed);
      if (pendingUnviewed.length > 0) {
        try {
          await supabase
            .from('tickets')
            .update({ is_viewed: true })
            .eq('status', 'Pending')
            .eq('is_viewed', false);
          handleRefresh();
        } catch (err) {
          console.error('Failed to clear admin pending badge:', err);
        }
      }
    }
  };

  // -----------------------------------------------------------------
  // Navigation Guards
  // -----------------------------------------------------------------
  const isAdmin = userProfile?.position === 'Admin';
  const isClient = userProfile?.userType === 'client';

  const canViewTickets = isAdmin || userProfile?.can_view_tickets;
  const canViewTechnical = isAdmin || userProfile?.can_view_technical;
  const canViewReports = isAdmin || userProfile?.can_view_reports;

  const renderActiveTab = () => {
    if (activeTab === 'profile') {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1rem',
          minHeight: '60vh'
        }}>
          <div className="card-widget" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-md)',
            backgroundColor: 'hsl(var(--bg-secondary))'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 800,
              fontFamily: 'Outfit',
              boxShadow: '0 8px 20px rgba(var(--primary-rgb), 0.3)',
              border: '3px solid hsl(var(--bg-secondary))'
            }}>
              {isClient
                ? (userProfile?.company_name?.[0] || 'C').toUpperCase()
                : `${userProfile?.firstname?.[0] || ''}${userProfile?.lastname?.[0] || ''}`.toUpperCase().substring(0, 2)}
            </div>

            <div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.35rem', fontWeight: 700, color: 'hsl(var(--fg-primary))', marginBottom: '0.25rem' }}>
                {isClient
                  ? userProfile?.contact_person
                  : `${userProfile?.firstname} ${userProfile?.lastname}`}
              </h2>
              {session?.user?.email && !session.user.email.endsWith('@ticketmonitoring.local') && (
                <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem' }}>
                  {session.user.email}
                </p>
              )}
            </div>

            <div style={{
              width: '100%',
              backgroundColor: 'hsl(var(--bg-tertiary))',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              textAlign: 'left',
              border: '1px solid hsl(var(--border-color))'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>User ID:</span>
                <span style={{ color: 'hsl(var(--fg-primary))', fontFamily: 'monospace', fontWeight: 600 }}>{session?.user?.id.substring(0, 12)}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>Account Type:</span>
                <span style={{ color: 'hsl(var(--fg-primary))', fontWeight: 600, textTransform: 'capitalize' }}>
                  {userProfile?.userType === 'client' ? 'Client Partner' : (userProfile?.position === 'Admin' ? 'Administrator' : 'Technician Staff')}
                </span>
              </div>
              {isClient ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>Company Name:</span>
                    <span style={{ color: 'hsl(var(--fg-primary))', fontWeight: 600 }}>{userProfile?.company_name}</span>
                  </div>
                  {userProfile?.contact_number && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>Contact Number:</span>
                      <span style={{ color: 'hsl(var(--fg-primary))', fontWeight: 600 }}>{userProfile?.contact_number}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>Department:</span>
                    <span style={{ color: 'hsl(var(--fg-primary))', fontWeight: 600 }}>{userProfile?.position}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'hsl(var(--fg-secondary))', fontWeight: 500 }}>Office Branch:</span>
                    <span style={{ color: 'hsl(var(--fg-primary))', fontWeight: 600 }}>{userProfile?.branch}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem'
            }}>
              {/* Theme toggle for mobile */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                backgroundColor: 'hsl(var(--bg-secondary))',
                border: '1px solid hsl(var(--border-color))',
                borderRadius: 'var(--radius-md)'
              }}>
                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--fg-primary))', fontWeight: 500 }}>Appearance Mode</span>
                <button
                  type="button"
                  className="theme-btn"
                  onClick={toggleTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    border: '1px solid hsl(var(--border-color))',
                    cursor: 'pointer',
                    backgroundColor: 'hsl(var(--bg-tertiary))',
                    color: 'hsl(var(--fg-primary))'
                  }}
                >
                  {theme === 'light' ? <><Moon size={15} /> Dark</> : <><Sun size={15} /> Light</>}
                </button>
              </div>

              {/* Signout Button */}
              <button
                type="button"
                className="btn btn-danger"
                onClick={triggerLogoutConfirm}
                style={{
                  justifyContent: 'center',
                  padding: '0.75rem',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                <LogOut size={16} /> Sign Out of Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isClient) {
      return (
        <ClientDashboard
          userProfile={userProfile}
          tickets={tickets}
          products={products}
          concerns={concerns}
          onRefresh={handleRefresh}
          handleLogout={triggerLogoutConfirm}
          view={activeTab === 'tickets' ? 'tickets' : 'dashboard'}
        />
      );
    }

    if (isAdmin) {
      switch (activeTab) {
        case 'dashboard':
          return <AdminDashboard tickets={tickets} staff={staff} onTabChange={setActiveTab} />;
        case 'tickets':
          return canViewTickets ? (
            <TicketManager
              tickets={tickets} staff={staff} products={products} concerns={concerns} clients={clients}
              onRefresh={handleRefresh} adminUser={userProfile}
            />
          ) : <ForbiddenScreen />;
        case 'technical':
          return canViewTechnical ? (
            <TechnicalManager
              staff={staff} tickets={tickets} products={products} concerns={concerns} clients={clients}
              onRefresh={handleRefresh} adminUser={userProfile}
            />
          ) : <ForbiddenScreen />;
        case 'clients':
          return (
            <ClientManager
              clients={clients}
              tickets={tickets}
              staff={staff}
              onRefresh={handleRefresh}
            />
          );
        case 'reports':
          return canViewReports ? <AnalyticsReports tickets={tickets} staff={staff} /> : <ForbiddenScreen />;
        default:
          return <AdminDashboard tickets={tickets} staff={staff} onTabChange={setActiveTab} />;
      }
    } else {
      // Non-admin staff — respect their can_view_* permission flags
      switch (activeTab) {
        case 'dashboard':
          return (
            <TechnicianDashboard
              userProfile={userProfile} tickets={tickets} clients={clients} products={products} concerns={concerns}
              onRefresh={handleRefresh}
            />
          );
        case 'tickets':
          return userProfile?.can_view_tickets ? (
            <TicketManager
              tickets={tickets} staff={staff} products={products} concerns={concerns} clients={clients}
              onRefresh={handleRefresh} adminUser={userProfile}
            />
          ) : <ForbiddenScreen />;
        case 'technical':
          return userProfile?.can_view_technical ? (
            <TechnicalManager
              staff={staff} tickets={tickets} products={products} concerns={concerns} clients={clients}
              onRefresh={handleRefresh} adminUser={userProfile}
            />
          ) : <ForbiddenScreen />;
        case 'reports':
          return userProfile?.can_view_reports ? (
            <AnalyticsReports tickets={tickets} staff={staff} />
          ) : <ForbiddenScreen />;
        default:
          return (
            <TechnicianDashboard
              userProfile={userProfile} tickets={tickets} clients={clients} products={products} concerns={concerns}
              onRefresh={handleRefresh}
            />
          );
      }
    }
  };

  // -----------------------------------------------------------------
  // Screen Render Flows
  // -----------------------------------------------------------------  // 1. Not Logged In Screen
  if (!session) {
    return (
      <div className="auth-page" style={{ padding: '2rem 1rem' }}>
        <div className="auth-card" style={{ maxWidth: '600px' }}>
          <div className="auth-header">
            <img className="auth-logo" src={logoMssc} alt="MSSC Logo" />
            <h1 style={{ fontFamily: 'Outfit', fontSize: '1.45rem', marginTop: '0.25rem', color: 'hsl(var(--fg-primary))' }}>
              Create Support Request
            </h1>
            <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem', textAlign: 'center' }}>
              Fill out the details below to submit a technical concern to our support team.
            </p>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
              <label>Company Name <span style={{ color: 'red' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Acme Corporation"
                style={{ pointerEvents: 'none' }}
                readOnly
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
                <label>Contact Person <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="John Doe"
                  style={{ pointerEvents: 'none' }}
                  readOnly
                />
              </div>
              <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
                <label>Contact Email (Optional)</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="john.doe@company.com"
                  style={{ pointerEvents: 'none' }}
                  readOnly
                />
              </div>
            </div>

            <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
              <label>Contact Number <span style={{ color: 'red' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="+639171234567"
                style={{ pointerEvents: 'none' }}
                readOnly
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
                <label>Affected Product <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="form-control"
                  style={{ pointerEvents: 'none' }}
                  readOnly
                >
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
                <label>Concern Category <span style={{ color: 'red' }}>*</span></label>
                <select
                  className="form-control"
                  style={{ pointerEvents: 'none' }}
                  readOnly
                >
                  <option value="">Select a concern...</option>
                  {concerns.map(c => (
                    <option key={c.concern_id} value={c.concern_id}>{c.concern_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" onClick={() => setShowAuthModal(true)} style={{ cursor: 'pointer' }}>
              <label>Concern Description <span style={{ color: 'red' }}>*</span></label>
              <textarea
                className="form-control"
                placeholder="Describe your issue or concern in detail..."
                style={{ minHeight: '80px', resize: 'none', pointerEvents: 'none' }}
                readOnly
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ justifyContent: 'center', padding: '0.7rem', marginTop: '0.5rem' }}
              onClick={() => setShowAuthModal(true)}
            >
              Submit Support Request
            </button>
          </form>

          {/* Direct Sign In Quick Link */}
          <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', fontSize: '0.82rem' }}>
            <span style={{ color: 'hsl(var(--fg-secondary))' }}>Already have an account? </span>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setShowAuthModal(true); }}
              style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: 600 }}
            >
              Sign In here
            </a>
          </div>
        </div>

        {/* Modal Auth Popup */}
        {showAuthModal && (
          <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setShowAuthModal(false)}>
            <div className="auth-card" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '460px', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={{
                  position: 'absolute',
                  right: '1.25rem',
                  top: '1.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--fg-secondary))',
                  lineHeight: 0,
                  padding: '0.25rem',
                  zIndex: 10
                }}
              >
                <X size={20} />
              </button>

              <div className="auth-header">
                <img className="auth-logo" src={logoMssc} alt="MSSC Logo" />
                <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.85rem', textAlign: 'center' }}>
                  {isTechnicalUrl ? 'Work Monitoring & Support Ticket Management (Staff)' : 'Client Support Portal'}
                </p>
              </div>

              <div style={{ display: 'flex', border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.2rem', backgroundColor: 'hsl(var(--bg-tertiary))' }}>
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                  style={{
                    flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                    backgroundColor: authMode === 'login' ? 'hsl(var(--bg-secondary))' : 'transparent',
                    color: authMode === 'login' ? 'hsl(var(--fg-primary))' : 'hsl(var(--fg-secondary))',
                    fontWeight: authMode === 'login' ? 600 : 400,
                    borderRadius: 'calc(var(--radius-md) - 2px)'
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess(''); }}
                  style={{
                    flex: 1, padding: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                    backgroundColor: authMode === 'signup' ? 'hsl(var(--bg-secondary))' : 'transparent',
                    color: authMode === 'signup' ? 'hsl(var(--fg-primary))' : 'hsl(var(--fg-secondary))',
                    fontWeight: authMode === 'signup' ? 600 : 400,
                    borderRadius: 'calc(var(--radius-md) - 2px)'
                  }}
                >
                  {isTechnicalUrl ? 'Register Staff' : 'Register Client'}
                </button>
              </div>

              {authError && (
                <div style={{ color: '#ff7675', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #ff7675', backgroundColor: 'rgba(255, 118, 117, 0.05)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  {authError}
                </div>
              )}

              {authSuccess && (
                <div style={{ color: '#00b894', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #00b894', backgroundColor: 'rgba(0, 184, 148, 0.05)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  {authSuccess}
                </div>
              )}

              {authMode === 'login' ? (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showLoginPw ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '2.4rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw(p => !p)}
                        style={{
                          position: 'absolute', right: '0.7rem', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', lineHeight: 0,
                          color: 'hsl(var(--fg-secondary))', padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.6rem', marginTop: '0.25rem' }}>
                    Sign In <ArrowRight size={15} />
                  </button>
                </form>
              ) : isTechnicalUrl ? (
                /* Technical Staff Signup */
                <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>Username <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="john_doe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="John"
                        value={firstname}
                        onChange={(e) => setFirstname(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Doe"
                        value={lastname}
                        onChange={(e) => setLastname(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address (Optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="john.doe@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showSignupPw ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '2.4rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPw(p => !p)}
                        style={{
                          position: 'absolute', right: '0.7rem', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', lineHeight: 0,
                          color: 'hsl(var(--fg-secondary))', padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div className="form-group">
                      <label>Office Branch</label>
                      <select className="form-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                        <option value="DAVAO">DAVAO</option>
                        <option value="MANILA">MANILA</option>
                        <option value="CEBU">CEBU</option>
                        <option value="GENERAL SANTOS">GENERAL SANTOS</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Position</label>
                      <select className="form-control" value={position} onChange={(e) => setPosition(e.target.value)}>
                        <option value="Technical">Technical</option>
                        <option value="Support">Support</option>
                        <option value="Sales">Sales</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.6rem', marginTop: '0.1rem' }}>
                    Register Profile <ArrowRight size={15} />
                  </button>
                </form>
              ) : (
                /* Client Signup */
                <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>Username <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="john_doe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Acme Corporation"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div className="form-group">
                      <label>Contact First Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="John"
                        value={firstname}
                        onChange={(e) => setFirstname(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Last Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Doe"
                        value={lastname}
                        onChange={(e) => setLastname(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address (Optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="contact@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input
                        type={showSignupPw ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '2.4rem' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPw(p => !p)}
                        style={{
                          position: 'absolute', right: '0.7rem', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', lineHeight: 0,
                          color: 'hsl(var(--fg-secondary))', padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showSignupPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Contact Number (Viber/Phone) <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+639171234567"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.6rem', marginTop: '0.1rem' }}>
                    Register Client <ArrowRight size={15} />
                  </button>
                </form>
              )}

              {/* Separate URL Switcher Link */}
              <div style={{ textAlign: 'center', marginTop: '1.25rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1rem', fontSize: '0.82rem' }}>
                {isTechnicalUrl ? (
                  <a href="#" style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: 600 }}>
                    Are you a client? Go to Client Support Portal
                  </a>
                ) : (
                  <a href="#/technical" style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: 600 }}>
                    Are you a technician or admin? Go to Staff Portal
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Pending Approval Screen (For inactive technicians only)
  if (userProfile && userProfile.userType === 'staff' && !userProfile.is_active) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', gap: '1.5rem' }}>
          <ShieldAlert size={48} style={{ color: '#ff7675', alignSelf: 'center' }} />
          <h1 style={{ fontFamily: 'Outfit', fontSize: '1.5rem' }}>Pending Admin Approval</h1>
          <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.9rem' }}>
            Hi <strong>{userProfile.firstname}</strong>, your account has been registered successfully, but is currently set to <strong>Inactive</strong>.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-muted))' }}>
            Please contact your system Administrator to activate your account profile before you can access the system dashboard.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleRefresh}>
              Check Status
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={triggerLogoutConfirm}>
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compute badge counts
  const unviewedTechTickets = userProfile && userProfile.userType === 'staff'
    ? tickets.filter(t => t.technical_id === userProfile.technical_id && !t.is_viewed).length
    : 0;

  const pendingAdminTickets = userProfile && userProfile.position === 'Admin'
    ? tickets.filter(t => t.status === 'Pending' && !t.is_viewed).length
    : 0;

  // 3. Main Dashboard Layout (For active users)
  if (isClient) {
    return (
      <div className="client-app-container">
        {/* Dynamic Keyframes for sliding toast */}
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(120%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>

        {/* Success Login Toast */}
        {loginToast && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            backgroundColor: 'rgba(0, 184, 148, 0.95)',
            color: '#fff',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 10px 25px rgba(0, 184, 148, 0.25)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'Outfit',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <CheckCircle size={18} />
            <span>{loginToast}</span>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowLogoutConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
              <ShieldAlert size={48} style={{ color: '#ff7675', marginBottom: '1rem', alignSelf: 'center' }} />
              <h2 style={{ fontFamily: 'Outfit', marginBottom: '0.5rem' }}>Confirm Sign Out</h2>
              <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Are you sure you want to log out of your ticket monitoring account?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Navbar */}
        <header className="client-navbar">
          <div className="client-navbar-container">
            <div className="client-navbar-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
              <img src={logoMssc} alt="MSSC Logo" className="client-navbar-logo" />
            </div>

            <nav className="client-navbar-nav">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`client-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={16} />
                <span>Submit Request</span>
              </button>
              <button
                onClick={() => setActiveTab('tickets')}
                className={`client-nav-btn ${activeTab === 'tickets' ? 'active' : ''}`}
              >
                <ClipboardList size={16} />
                <span>My Tickets</span>
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`client-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              >
                <Settings size={16} />
                <span>Profile Settings</span>
              </button>
            </nav>

            <div className="client-navbar-actions">
              <NotificationCenter
                userProfile={userProfile}
                tickets={tickets}
                onRefresh={handleRefresh}
              />

              <button className="theme-btn" onClick={toggleTheme} style={{ border: '1px solid hsl(var(--border-color))', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', color: 'hsl(var(--fg-primary))' }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              <button className="btn btn-secondary" onClick={triggerLogoutConfirm} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', height: '36px' }}>
                <LogOut size={14} /> <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="client-main-content">
          {renderActiveTab()}
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">

      {/* Dynamic Keyframes for sliding toast */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Success Login Toast */}
      {loginToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          backgroundColor: 'rgba(0, 184, 148, 0.95)',
          color: '#fff',
          padding: '1rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 25px rgba(0, 184, 148, 0.25)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'Outfit',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <CheckCircle size={18} />
          <span>{loginToast}</span>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <ShieldAlert size={48} style={{ color: '#ff7675', marginBottom: '1rem', alignSelf: 'center' }} />
            <h2 style={{ fontFamily: 'Outfit', marginBottom: '0.5rem' }}>Confirm Sign Out</h2>
            <p style={{ color: 'hsl(var(--fg-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to log out of your ticket monitoring account?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="sidebar-logo-img" src={logoMssc} alt="MSSC Logo" />
        </div>

        <nav className="sidebar-nav">
          {isClient ? (
            <>
              <a
                onClick={() => setActiveTab('dashboard')}
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </a>
              <a
                onClick={() => setActiveTab('tickets')}
                className={`sidebar-item ${activeTab === 'tickets' ? 'active' : ''}`}
              >
                <ClipboardList size={18} />
                <span>Ticket</span>
              </a>
            </>
          ) : isAdmin ? (
            <>
              <a
                onClick={() => setActiveTab('dashboard')}
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard Overview</span>
              </a>

              {canViewTickets && (
                <a
                  onClick={handleAdminTicketTabClick}
                  className={`sidebar-item ${activeTab === 'tickets' ? 'active' : ''}`}
                >
                  <ClipboardList size={18} />
                  <span>Ticket Board</span>
                  {pendingAdminTickets > 0 && (
                    <span className="sidebar-badge">{pendingAdminTickets}</span>
                  )}
                </a>
              )}

              {canViewTechnical && (
                <a
                  onClick={() => setActiveTab('technical')}
                  className={`sidebar-item ${activeTab === 'technical' ? 'active' : ''}`}
                >
                  <Users size={18} />
                  <span>Technical Panel</span>
                </a>
              )}

              <a
                onClick={() => setActiveTab('clients')}
                className={`sidebar-item ${activeTab === 'clients' ? 'active' : ''}`}
              >
                <Building size={18} />
                <span>Clients Directory</span>
              </a>

              {canViewReports && (
                <a
                  onClick={() => setActiveTab('reports')}
                  className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
                >
                  <BarChart3 size={18} />
                  <span>Analytics Reports</span>
                </a>
              )}
            </>
          ) : (
            /* Non-admin staff views — tabs shown based on can_view_* flags */
            <>
              <a
                onClick={handleClearTechBadge}
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <LayoutDashboard size={18} />
                <span>My Dashboard</span>
                {unviewedTechTickets > 0 && (
                  <span className="sidebar-badge">{unviewedTechTickets}</span>
                )}
              </a>

              {userProfile?.can_view_tickets && (
                <a
                  onClick={() => setActiveTab('tickets')}
                  className={`sidebar-item ${activeTab === 'tickets' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <ClipboardList size={18} />
                  <span>Ticket Board</span>
                </a>
              )}

              {userProfile?.can_view_technical && (
                <a
                  onClick={() => setActiveTab('technical')}
                  className={`sidebar-item ${activeTab === 'technical' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <Users size={18} />
                  <span>Technical Panel</span>
                </a>
              )}

              {userProfile?.can_view_reports && (
                <a
                  onClick={() => setActiveTab('reports')}
                  className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <BarChart3 size={18} />
                  <span>Analytics Reports</span>
                </a>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>
              {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
            </div>
            <button className="theme-btn" onClick={toggleTheme}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          <button className="btn btn-secondary" onClick={triggerLogoutConfirm} style={{ justifyContent: 'center' }}>
            <LogOut size={16} /> <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel View */}
      <main className="main-content">

        {/* Top Header bar */}
        <header className="top-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontFamily: 'Outfit' }}>
              {activeTab === 'profile' ? 'User Profile' :
                isClient ? (activeTab === 'tickets' ? 'Support Tickets' : 'Client Support Portal') :
                  activeTab === 'dashboard' ? 'Dashboard Overview' :
                    activeTab === 'tickets' ? 'Ticket Management' :
                      activeTab === 'technical' ? 'Technical Staff' :
                        activeTab === 'clients' ? 'Clients Directory' : 'Analytics & Reports'}
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>
              {activeTab === 'profile' ? 'Manage your account settings and preference details.' :
                isClient ? (activeTab === 'tickets' ? 'View and track your submitted support requests.' : 'Submit support requests and trace technician resolutions.') :
                  'Manage concerns, track resolution speeds, and view staff statistics.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

            {/* Realtime Alert Notifications Bell */}
            <NotificationCenter
              userProfile={userProfile}
              tickets={tickets}
              onRefresh={handleRefresh}
            />

            <div className="user-profile-badge" onClick={() => setActiveTab('profile')} style={{ cursor: 'pointer' }}>
              <div className="avatar">
                {isClient
                  ? (userProfile?.company_name?.[0] || 'C').toUpperCase()
                  : `${userProfile?.firstname?.[0] || ''}${userProfile?.lastname?.[0] || ''}`.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>
                  {isClient
                    ? userProfile?.contact_person
                    : `${userProfile?.firstname} ${userProfile?.lastname}`}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--fg-secondary))' }}>
                  {isClient
                    ? userProfile?.company_name
                    : `${userProfile?.position} • ${userProfile?.branch}`}
                </span>
              </div>
            </div>

          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        {renderActiveTab()}

      </main>

      {/* Mobile Bottom Navigation Bar */}
      {session && userProfile && (userProfile.userType !== 'staff' || userProfile.is_active) && (
        <div className="mobile-bottom-nav">
          {isClient ? (
            <>
              <div
                onClick={() => setActiveTab('dashboard')}
                className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </div>
              <div
                onClick={() => setActiveTab('tickets')}
                className={`mobile-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
              >
                <ClipboardList size={20} />
                <span>Tickets</span>
              </div>
            </>
          ) : isAdmin ? (
            <>
              <div
                onClick={() => setActiveTab('dashboard')}
                className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </div>
              {canViewTickets && (
                <div
                  onClick={handleAdminTicketTabClick}
                  className={`mobile-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
                >
                  <ClipboardList size={20} />
                  <span>Tickets</span>
                  {pendingAdminTickets > 0 && (
                    <span className="mobile-nav-badge">{pendingAdminTickets}</span>
                  )}
                </div>
              )}
              {canViewTechnical && (
                <div
                  onClick={() => setActiveTab('technical')}
                  className={`mobile-nav-item ${activeTab === 'technical' ? 'active' : ''}`}
                >
                  <Users size={20} />
                  <span>Technical</span>
                </div>
              )}
              <div
                onClick={() => setActiveTab('clients')}
                className={`mobile-nav-item ${activeTab === 'clients' ? 'active' : ''}`}
              >
                <Building size={20} />
                <span>Clients</span>
              </div>
              {canViewReports && (
                <div
                  onClick={() => setActiveTab('reports')}
                  className={`mobile-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                >
                  <BarChart3 size={20} />
                  <span>Reports</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                onClick={handleClearTechBadge}
                className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
                {unviewedTechTickets > 0 && (
                  <span className="mobile-nav-badge">{unviewedTechTickets}</span>
                )}
              </div>
              {userProfile?.can_view_tickets && (
                <div
                  onClick={() => setActiveTab('tickets')}
                  className={`mobile-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
                >
                  <ClipboardList size={20} />
                  <span>Tickets</span>
                </div>
              )}
              {userProfile?.can_view_technical && (
                <div
                  onClick={() => setActiveTab('technical')}
                  className={`mobile-nav-item ${activeTab === 'technical' ? 'active' : ''}`}
                >
                  <Users size={20} />
                  <span>Technical</span>
                </div>
              )}
              {userProfile?.can_view_reports && (
                <div
                  onClick={() => setActiveTab('reports')}
                  className={`mobile-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                >
                  <BarChart3 size={20} />
                  <span>Reports</span>
                </div>
              )}
            </>
          )}
          {/* User Icon for Profile */}
          <div
            onClick={() => setActiveTab('profile')}
            className={`mobile-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: activeTab === 'profile' ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--primary-rgb), 0.08)',
              color: activeTab === 'profile' ? 'hsl(var(--primary))' : 'hsl(var(--fg-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 700,
              border: `1.5px solid ${activeTab === 'profile' ? 'hsl(var(--primary))' : 'hsl(var(--border-color))'}`
            }}>
              {isClient
                ? (userProfile?.company_name?.[0] || 'C').toUpperCase()
                : `${userProfile?.firstname?.[0] || ''}${userProfile?.lastname?.[0] || ''}`.toUpperCase().substring(0, 2)}
            </div>
            <span>Profile</span>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponents helper screens
function ForbiddenScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', textAlign: 'center' }}>
      <Lock size={40} style={{ color: '#ff7675', marginBottom: '1rem' }} />
      <h3>Access Privilege Denied</h3>
      <p style={{ color: 'hsl(var(--fg-secondary))', marginTop: '0.5rem' }}>
        You do not have the required dashboard permissions to view this screen module.
      </p>
    </div>
  );
}
