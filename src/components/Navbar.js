'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTimeout(() => {
      setTheme(savedTheme);
    }, 0);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Load user session from local storage (or cookie)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setTimeout(() => {
          setUser(parsedUser);
        }, 0);
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="glass-panel" style={{
      margin: '16px 24px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 'var(--radius-md)',
      position: 'sticky',
      top: '16px',
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '800',
          fontSize: '1.1rem'
        }}>
          SI
        </div>
        <Link href="/" style={{ fontWeight: '800', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
          SI<span style={{ color: 'var(--primary)', fontWeight: '600' }}>Schedule</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary" 
          style={{ 
            padding: '8px 12px', 
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer' 
          }}
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Halo, <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>
            </span>
            <Link 
              href={user.role === 'ADMIN' ? '/admin' : user.role === 'LECTURER' ? '/dosen' : '/mahasiswa'} 
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Dashboard
            </Link>
            <button 
              onClick={handleLogout}
              className="btn btn-danger"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Keluar
            </button>
          </div>
        ) : (
          <Link 
            href="/login" 
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            Masuk Portal
          </Link>
        )}
      </div>
    </nav>
  );
}
