import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase
} from './supabaseClient';
import logoMssc from './assets/logo_mssc.png';
import {
  LayoutDashboard, ClipboardList, Users, BarChart3, LogOut, Sun, Moon,
  Lock, ArrowRight, ShieldAlert, CheckCircle, Settings, Key, Building
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
      setEmail('');
      setPassword('');
      setFirstname('');
      setLastname('');
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
        } else if (userEmail) {
          // 3. Fallback: Search by email in clients first (clients are pre-seeded or registered)
          const { data: clientDataByEmail } = await supabase
            .from('clients')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (clientDataByEmail) {
            // Link user_id in database
            await supabase
              .from('clients')
              .update({ user_id: userId })
              .eq('client_id', clientDataByEmail.client_id);

            profileData = { ...clientDataByEmail, user_id: userId, userType: 'client' };
          } else {
            // 4. Fallback: Search by email in technical_staff
            const { data: staffDataByEmail } = await supabase
              .from('technical_staff')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();

            if (staffDataByEmail) {
              // Link user_id in database
              await supabase
                .from('technical_staff')
                .update({ user_id: userId })
                .eq('technical_id', staffDataByEmail.technical_id);

              profileData = { ...staffDataByEmail, user_id: userId, userType: 'staff' };
            }
          }
        }
      }

      // 5. If still not found, check role in metadata or default to fallback based on metadata role
      if (!profileData) {
        const userRole = userMetadata.role || userMetadata.position;
        if (userRole === 'Client') {
          profileData = {
            client_id: userId, // fallback client ID
            company_name: userMetadata.company_name || 'Client Company',
            contact_person: `${userMetadata.firstname || ''} ${userMetadata.lastname || ''}`.trim() || 'Client User',
            email: userEmail,
            contact_number: userMetadata.contact_number || '',
            userType: 'client'
          };
        } else {
          profileData = {
            firstname: userMetadata.firstname || 'Technical',
            lastname: userMetadata.lastname || 'Staff',
            position: userMetadata.position || 'Technical',
            branch: userMetadata.branch || 'DAVAO',
            is_active: userMetadata.position === 'Admin',
            userType: 'staff'
          };
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

  // -----------------------------------------------------------------
  // Auth Operations (Login / Signup)
  // -----------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      isExplicitLoginRef.current = true;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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

      try {
        const { data: { user }, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              firstname,
              lastname,
              position,
              branch,
              role: 'Technical',
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
              const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
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
      if (!companyName.trim() || !firstname.trim() || !lastname.trim()) {
        setAuthError('Please fill in all registration fields.');
        return;
      }

      try {
        const { data: { user }, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              firstname,
              lastname,
              company_name: companyName.trim(),
              contact_number: contactNumber.trim(),
              role: 'Client'
            }
          }
        });

        if (error) throw error;

        if (user) {
          setAuthSuccess('Client registration complete! Redirecting to dashboard...');
          isExplicitLoginRef.current = true;

          // Insert client entry manually as backup constraint safety
          try {
            await supabase
              .from('clients')
              .insert([{
                user_id: user.id,
                company_name: companyName.trim(),
                contact_person: `${firstname.trim()} ${lastname.trim()}`,
                contact_number: contactNumber.trim(),
                email: email
              }]);
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
  };

  const triggerLogoutConfirm = () => {
    setShowLogoutConfirm(true);
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
      // Technician profile lands on personal dashboard
      return (
        <TechnicianDashboard
          userProfile={userProfile} tickets={tickets} clients={clients} products={products} concerns={concerns}
          onRefresh={handleRefresh}
        />
      );
    }
  };

  // -----------------------------------------------------------------
  // Screen Render Flows
  // -----------------------------------------------------------------

  // 1. Not Logged In Screen
  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
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
            <div style={{ color: '#ff7675', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #ff7675', backgroundColor: 'rgba(255, 118, 117, 0.05)', fontSize: '0.85rem' }}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{ color: '#00b894', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #00b894', backgroundColor: 'rgba(0, 184, 148, 0.05)', fontSize: '0.85rem' }}>
              {authSuccess}
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.75rem' }}>
                Sign In <ArrowRight size={16} />
              </button>
            </form>
          ) : isTechnicalUrl ? (
            /* Technical Staff Signup */
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="john.doe@ticketflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              {position === 'Admin' && (
                <div className="form-group">
                  <label style={{ color: '#8b5cf6' }}>Secret Admin Passcode</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter admin code"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--fg-secondary))' }}>
                    Tip: Passcode is `Admin2026`
                  </span>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.75rem' }}>
                Register Profile <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            /* Client Signup */
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="contact@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Contact Number (Viber/Phone)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+639171234567"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.75rem' }}>
                Register Client <ArrowRight size={16} />
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
    ? tickets.filter(t => t.status === 'Pending').length
    : 0;

  // 3. Main Dashboard Layout (For active users)
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
              Are you sure you want to log out of your TicketFlow account?
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
                  onClick={() => setActiveTab('tickets')}
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
            /* Technician views */
            <a className="sidebar-item active">
              <LayoutDashboard size={18} />
              <span>My Dashboard</span>
              {unviewedTechTickets > 0 && (
                <span className="sidebar-badge">{unviewedTechTickets}</span>
              )}
            </a>
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
              {isClient ? (activeTab === 'tickets' ? 'Support Tickets' : 'Client Support Portal') :
                activeTab === 'dashboard' ? 'Dashboard Overview' :
                  activeTab === 'tickets' ? 'Ticket Management' :
                    activeTab === 'technical' ? 'Technical Staff' :
                      activeTab === 'clients' ? 'Clients Directory' : 'Analytics & Reports'}
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary))' }}>
              {isClient ? (activeTab === 'tickets' ? 'View and track your submitted support requests.' : 'Submit support requests and trace technician resolutions.') :
                'Manage concerns, track resolution speeds, and view staff statistics.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

            {/* Realtime Alert Notifications Bell for Admin */}
            {isAdmin && (
              <NotificationCenter
                userProfile={userProfile}
                tickets={tickets}
                onRefresh={handleRefresh}
              />
            )}

            <div className="user-profile-badge">
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
