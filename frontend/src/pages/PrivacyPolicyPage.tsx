import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      <header
        style={{
          backgroundColor: 'rgb(154, 51, 52)',
          padding: '8px 16px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="flex items-center gap-4" style={{ flex: '0 0 auto' }}>
          <img src="https://wildfiregames.com/img/logo.png" alt="Wildfire Games" style={{ height: '48px', width: 'auto' }} />
          <div>
            <h1 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0, lineHeight: 1 }}>Mod Manager</h1>
            <p style={{ color: '#ddd', fontSize: '12px', margin: '2px 0 0 0' }}>0 A.D.</p>
          </div>
        </div>
        <nav>
          <Link to="/login" style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h2>
        <p className="text-gray-600 mb-6">Last updated: December 13, 2025</p>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
          <p>
            This application is designed for internal moderation workflows for 0 A.D. mods.
            We value your privacy and minimise personal data collection.
          </p>

          <h3 className="text-lg font-semibold">Data We Process</h3>
          <ul className="list-disc ml-6 space-y-1 text-gray-800">
            <li><span className="font-medium">Email (hashed):</span> We store an HMAC-SHA256 hash of your email for authentication; the actual email is not stored.</li>
            <li><span className="font-medium">Password (hashed):</span> Passwords are stored using Argon2 hashing. We never store plaintext passwords.</li>
            <li><span className="font-medium">Nickname:</span> A display name to improve UX. You may change it via admin tools (if enabled).</li>
            <li><span className="font-medium">Audit logs:</span> We record actions (e.g., user management, mod sync) with timestamps and your user ID for accountability.</li>
            <li><span className="font-medium">Technical info:</span> Basic user-agent may be logged for diagnostics; we do not store IP addresses.</li>
          </ul>

          <h3 className="text-lg font-semibold">GDPR Compliance</h3>
          <ul className="list-disc ml-6 space-y-1 text-gray-800">
            <li>We collect only necessary data for security and moderation.</li>
            <li>No IP addresses are stored in audit logs.</li>
            <li>Access is restricted; tokens expire regularly, and sessions are protected.</li>
            <li>You can request account removal via an administrator.</li>
          </ul>

        </section>

        <div className="mt-6 text-sm text-gray-600">
          <Link to="/login" className="text-wildfire-600 hover:text-wildfire-700 font-medium">Return to Sign In</Link>
        </div>
      </main>
    </div>
  );
}

export default PrivacyPolicyPage;
