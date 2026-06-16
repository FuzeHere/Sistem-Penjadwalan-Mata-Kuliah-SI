'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function DosenDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selected preferred time slots
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState('jadwal');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'LECTURER') {
      router.push('/admin');
      return;
    }
    setTimeout(() => {
      setUser(parsedUser);
    }, 0);

    async function fetchData() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('Gagal memuat data.');
        const result = await res.json();
        setData(result);
        
        // Find existing preferences of this lecturer
        const existingPrefs = result.lecturerPreferences
          .filter(p => p.lecturerId === parsedUser.lecturerId)
          .map(p => p.timeSlotId);
        setSelectedPreferences(existingPrefs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const handlePreferenceToggle = (slotId) => {
    setSelectedPreferences(prev => {
      if (prev.includes(slotId)) {
        return prev.filter(id => id !== slotId);
      } else {
        return [...prev, slotId];
      }
    });
  };

  const handleSavePreferences = async () => {
    setSaveStatus('Menyimpan...');
    try {
      const res = await fetch('/api/dosen/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturerId: user.lecturerId,
          preferences: selectedPreferences
        })
      });

      if (!res.ok) throw new Error('Gagal menyimpan preferensi.');
      
      setSaveStatus('Berhasil disimpan!');
      setTimeout(() => setSaveStatus(''), 3000);
      
      // Refresh DB data
      const dataRes = await fetch('/api/data');
      if (dataRes.ok) {
        const freshData = await dataRes.json();
        setData(freshData);
      }
    } catch (err) {
      setSaveStatus(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <h3>Memuat Dashboard Dosen...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
        <h2>Error: {error}</h2>
      </div>
    );
  }

  // Filter schedules where this lecturer is assigned
  const mySchedules = data.schedules.filter(s => s.lecturerId === user.lecturerId);

  // Group slots by day for checking preferences easily
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

  return (
    <>
      <Navbar />

      <main className="layout-container">
        {/* Banner */}
        <section className="header-banner animate-fade">
          <span className="badge badge-accent" style={{ marginBottom: '12px' }}>Dosen SI</span>
          <h1>Portal Pengajaran Dosen</h1>
          <p style={{ color: '#e2e8f0', marginTop: '8px' }}>
            Selamat datang, <strong>{user?.name}</strong>. Di sini Anda dapat memantau jadwal mengajar Anda dan mengisi preferensi waktu mengajar untuk semester depan.
          </p>
        </section>

        {/* Tab switcher */}
        <section className="tab-nav animate-fade">
          <button 
            className={`tab-btn ${activeTab === 'jadwal' ? 'active' : ''}`}
            onClick={() => setActiveTab('jadwal')}
          >
            Jadwal Mengajar Saya
          </button>
          <button 
            className={`tab-btn ${activeTab === 'preferensi' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferensi')}
          >
            Atur Preferensi Waktu
          </button>
        </section>

        {/* Tab 1: Jadwal Mengajar */}
        {activeTab === 'jadwal' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Jadwal Mengajar Semester Aktif</h2>
            {mySchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <h3>Belum Ada Jadwal Mengajar</h3>
                <p>Anda belum ditugaskan mengajar untuk kelas manapun di semester ini.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table-premium">
                  <thead>
                    <tr>
                      <th>Hari</th>
                      <th>Jam</th>
                      <th>Mata Kuliah</th>
                      <th>SKS</th>
                      <th>Kelas</th>
                      <th>Ruangan</th>
                      <th>Asisten Dosen</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySchedules.map(schedule => {
                      const isPractical = schedule.course?.type === 'PRACTICAL';
                      return (
                        <tr key={schedule.id}>
                          <td><strong>{schedule.timeSlot?.day}</strong></td>
                          <td>{schedule.timeSlot?.startTime} - {schedule.timeSlot?.endTime}</td>
                          <td>{schedule.course?.name}</td>
                          <td><span className="badge badge-primary">{schedule.course?.credits} SKS</span></td>
                          <td>{schedule.class?.name}</td>
                          <td><span style={{ color: 'var(--primary)', fontWeight: '600' }}>{schedule.room?.code}</span></td>
                          <td>
                            {schedule.assistant ? (
                              <span className="badge badge-accent">{schedule.assistant.name}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${schedule.status === 'PUBLISHED' ? 'badge-accent' : 'badge-warning'}`}>
                              {schedule.status === 'PUBLISHED' ? 'Dipublikasikan' : 'Draft'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Preferensi Waktu */}
        {activeTab === 'preferensi' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Preferensi Waktu Mengajar</h2>
                <p style={{ fontSize: '0.85rem' }}>
                  Pilih slot waktu yang paling nyaman bagi Anda. Algoritma penjadwalan otomatis akan memprioritaskan slot ini.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {saveStatus && <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--primary)' }}>{saveStatus}</span>}
                <button 
                  onClick={handleSavePreferences}
                  className="btn btn-primary"
                >
                  Simpan Preferensi
                </button>
              </div>
            </div>

            {/* Grid display of days and slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
              {days.map(day => {
                const slotsForDay = data.timeSlots.filter(t => t.day === day);
                return (
                  <div key={day} style={{ 
                    borderBottom: '1px solid var(--border-color)', 
                    paddingBottom: '16px',
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr',
                    gap: '16px',
                    alignItems: 'start'
                  }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--primary)', paddingTop: '6px' }}>{day}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {slotsForDay.map(slot => {
                        const isChecked = selectedPreferences.includes(slot.id);
                        return (
                          <label 
                            key={slot.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 14px',
                              border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-secondary)',
                              cursor: 'pointer',
                              userSelect: 'none',
                              fontSize: '0.9rem',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handlePreferenceToggle(slot.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{slot.startTime} - {slot.endTime}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
