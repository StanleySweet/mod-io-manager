import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import authService from '../services/authService';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (pwd: string) => {
    if (pwd.length < 12) return 'Password must be at least 12 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain a number';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must contain a special character';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authService.register({ email, nickname, password });
      // Redirect to login after successful registration
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }> | Error;
      if ('response' in axiosError && axiosError.response) {
        setError(axiosError.response.data?.error || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Wildfire Games Header */}
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
          <img 
            src="https://wildfiregames.com/img/logo.png" 
            alt="Wildfire Games" 
            style={{ height: '48px', width: 'auto' }}
          />
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
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
        </nav>
      </header>

      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="card max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <img 
            src="/mod-io-manager-large.svg" 
            alt="0 A.D. Mod Manager" 
            style={{ height: '80px', width: 'auto', margin: '0 auto 16px' }}
          />
          <p className="text-gray-600 mt-3">Join the team</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="nickname" className="block text-sm font-semibold text-gray-700 mb-2">
              Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input-field"
              placeholder="Your public nick (3-32 chars)"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="12+ chars, uppercase, number, special char"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="Confirm your password"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              style={{ color: '#9a3334', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7a2728')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9a3334')}
            >
              Sign in here
            </button>
          </p>
          <p className="text-center text-xs text-gray-500 mt-3">
            <button
              onClick={() => navigate('/privacy')}
              style={{ color: '#9a3334', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7a2728')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9a3334')}
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
