import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Primary Header - Wildfire Games Style (sticky) */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgb(154, 51, 52)',
          padding: '8px 16px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Logo and Branding */}
        <div 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-4 cursor-pointer"
          style={{ flex: '0 0 auto' }}
        >
          <img 
            src="https://wildfiregames.com/img/logo.png" 
            alt="Wildfire Games" 
            style={{ height: '48px', width: 'auto' }}
          />

        </div>

        {/* Right: Navigation and User */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: '1', justifyContent: 'flex-end' }}>
          <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', margin: '0', padding: '0' }}>
            <li>
              <a 
                href="https://www.play0ad.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'none', fontSize: '15px', fontWeight: '500', transition: 'opacity 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                0 A.D.
              </a>
            </li>
            <li>
              <a 
                href="https://gitea.wildfiregames.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'none', fontSize: '15px', fontWeight: '500', transition: 'opacity 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Development
              </a>
            </li>
            <li>
              <a 
                href="https://www.wildfiregames.com/forum/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'none', fontSize: '15px', fontWeight: '500', transition: 'opacity 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Forums
              </a>
            </li>
            <li>
              <a 
                href="https://www.wildfiregames.com/irc.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'white', textDecoration: 'none', fontSize: '15px', fontWeight: '500', transition: 'opacity 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Chat
              </a>
            </li>
          </ul>

          {/* User Info and Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ textAlign: 'right', fontSize: '13px' }}>
              <p style={{ color: 'white', margin: '0', fontWeight: '500' }}>
                {user?.nickname || user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '13px',
                transition: 'background-color 150ms'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      {/* Secondary Header - Context sub-navigation (sticky) */}
      <div
        style={{
          position: 'sticky',
          top: 64,
          zIndex: 40,
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '0' }}>
          <a
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              borderBottom: '2px solid transparent',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#9a3334';
              e.currentTarget.style.borderBottomColor = '#9a3334';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.borderBottomColor = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Mods
          </a>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
          <a
            onClick={() => navigate('/dashboard/settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              borderBottom: '2px solid transparent',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#9a3334';
              e.currentTarget.style.borderBottomColor = '#9a3334';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.borderBottomColor = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"></path>
            </svg>
            Settings
          </a>
          {user?.role === 'admin' && (
            <>
              <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
              <a
                onClick={() => navigate('/dashboard/admin/users')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: '2px solid transparent',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#9a3334';
                  e.currentTarget.style.borderBottomColor = '#9a3334';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"></path>
                </svg>
                Users
              </a>
              <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb' }}></div>
              <a
                onClick={() => navigate('/dashboard/admin/audit-logs')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: '2px solid transparent',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#9a3334';
                  e.currentTarget.style.borderBottomColor = '#9a3334';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.borderBottomColor = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Audit Logs
              </a>
            </>
          )}
        </div>
      </div>

      {/* Main Content (add top padding to clear sticky headers) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ paddingTop: '24px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', marginTop: '48px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              <p style={{ margin: '0 0 4px 0' }}>
                © 2025{' '}
                <a 
                  href="https://github.com/StanleySweet/mod-io-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#9a3334', textDecoration: 'none', fontWeight: '500' }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  mod-io-manager
                </a>
              </p>
              <p style={{ margin: '0' }}>
                Licensed under the{' '}
                <a 
                  href="https://opensource.org/licenses/MIT"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#9a3334', textDecoration: 'none', fontWeight: '500' }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  MIT License
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}