'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role === 'ADMIN') {
          router.push('/admin');
        } else if (user.role === 'LECTURER') {
          router.push('/dosen');
        } else if (user.role === 'STUDENT') {
          router.push('/mahasiswa');
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal login.');

      // Save user session
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);

      // Redirect
      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else if (data.user.role === 'LECTURER') {
        router.push('/dosen');
      } else if (data.user.role === 'STUDENT') {
        router.push('/mahasiswa');
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (role) => {
    if (role === 'ADMIN') {
      setEmail('admin@uin-alauddin.ac.id');
      setPassword('admin123');
    } else if (role === 'LECTURER') {
      setEmail('irwan@uin-alauddin.ac.id');
      setPassword('dosen123');
    } else if (role === 'STUDENT') {
      setEmail('ahmad@uin-alauddin.ac.id');
      setPassword('mhs123');
    } else if (role === 'STUDENT_FAIRUZ') {
      setEmail('fairuz@uin-alauddin.ac.id');
      setPassword('mhs123');
    }
  };

  return (
    <>
      <Navbar />
      
      <main className="layout-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        paddingTop: '20px'
      }}>
        <div className="glass-panel animate-fade" style={{
          maxWidth: '440px',
          width: '100%',
          padding: '40px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '800',
              fontSize: '1.5rem',
              marginBottom: '16px',
              boxShadow: 'var(--shadow-md)'
            }}>
              SI
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Selamat Datang
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Masuk untuk mengelola jadwal perkuliahan
            </p>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Email Akademik
              </label>
              <input 
                type="email" 
                id="email"
                className="form-control" 
                placeholder="nama@uin-alauddin.ac.id"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input 
                type="password" 
                id="password"
                className="form-control" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '8px', fontWeight: '700' }}
              disabled={loading}
            >
              {loading ? 'Masuk...' : 'Masuk ke Portal'}
            </button>
          </form>

          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600' }}>
              AKSES UJI COBA CEPAT (DEMO):
            </p>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleFillCredentials('ADMIN')}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700' }}
              >
                Admin
              </button>
              <button 
                onClick={() => handleFillCredentials('LECTURER')}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700' }}
              >
                Dosen (Irwan)
              </button>
              <button 
                onClick={() => handleFillCredentials('STUDENT')}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700' }}
              >
                Mhs Terkunci (Dani)
              </button>
              <button 
                onClick={() => handleFillCredentials('STUDENT_FAIRUZ')}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem', fontWeight: '700' }}
              >
                Mhs Baru (Fairuz)
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
