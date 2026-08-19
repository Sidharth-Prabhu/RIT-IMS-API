import React, { useState } from 'react';
import { GraduationCap, User, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => void;
  loading: boolean;
  error: string;
}

export default function LoginForm({ onSubmit, loading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(username.trim(), password);
  };


  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-icon-wrapper">
          <GraduationCap size={40} />
        </div>
        
        <h1 className="login-title">IMS Grade Fetcher</h1>
        <p className="login-subtitle">
          Securely fetch your RIT IMS academic reports and GPA analytics
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="registerNumber">Register Number</label>
            <div className="input-wrapper">
              <input
                id="registerNumber"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 2117240020329"
                required
                className="form-input"
                disabled={loading}
              />
              <User className="input-icon" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter IMS password"
                required
                className="form-input"
                disabled={loading}
                style={{ paddingRight: '48px' }}
              />
              <Lock className="input-icon" />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="input-toggle-btn"
                aria-label={showPass ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-alert">
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Accessing IMS Portal...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <p className="form-footer-note">
            Your login credentials are sent securely to the college IMS portal. No passwords or personal data are stored.
          </p>
        </div>

      </div>
    </div>
  );
}
