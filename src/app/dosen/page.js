'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function DosenDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selected preferred days (e.g. ['Senin', 'Rabu'])
  const [selectedDays, setSelectedDays] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');
  
  // Swap state
  const [swapTargetScheduleId, setSwapTargetScheduleId] = useState('');
  const [swapMyScheduleId, setSwapMyScheduleId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapStatus, setSwapStatus] = useState('');
  
  // Reschedule state
  const [rescheduleTargetId, setRescheduleTargetId] = useState(null);
  const [availableEmptySlots, setAvailableEmptySlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedEmptySlotIndex, setSelectedEmptySlotIndex] = useState('');
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState('jadwal');
  const [scheduleWeek, setScheduleWeek] = useState('current'); // 'current' or 'next'

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
        
        // Find existing day preferences of this lecturer
        const existingPrefs = result.lecturerPreferences
          .filter(p => p.lecturerId === parsedUser.lecturerId)
          .map(p => p.preferredDay);
        setSelectedDays(existingPrefs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const refreshData = async () => {
    const res = await fetch('/api/data');
    if (res.ok) {
      const freshData = await res.json();
      setData(freshData);
    }
  };

  const handleDayToggle = (day) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
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
          preferredDays: selectedDays
        })
      });

      if (!res.ok) throw new Error('Gagal menyimpan preferensi.');
      
      setSaveStatus('Berhasil disimpan!');
      setTimeout(() => setSaveStatus(''), 3000);
      await refreshData();
    } catch (err) {
      setSaveStatus(`Error: ${err.message}`);
    }
  };

  const handleSubmitSwap = async () => {
    if (!swapMyScheduleId || !swapTargetScheduleId || !swapReason) {
      setSwapStatus('Semua field harus diisi!');
      return;
    }
    setSwapStatus('Mengirim...');
    try {
      const res = await fetch('/api/schedule/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.lecturerId,
          requesterScheduleId: swapMyScheduleId,
          targetScheduleId: swapTargetScheduleId,
          reason: swapReason
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengajukan tukar jadwal.');
      setSwapStatus('Permintaan tukar jadwal berhasil dikirim! Menunggu persetujuan admin.');
      setSwapMyScheduleId('');
      setSwapTargetScheduleId('');
      setSwapReason('');
      await refreshData();
    } catch (err) {
      setSwapStatus(`Error: ${err.message}`);
    }
  };

  const handleInitiateReschedule = async (scheduleId) => {
    if (rescheduleTargetId === scheduleId) {
      setRescheduleTargetId(null);
      setAvailableEmptySlots([]);
      setSelectedEmptySlotIndex('');
      return;
    }
    setRescheduleTargetId(scheduleId);
    setLoadingSlots(true);
    setAvailableEmptySlots([]);
    setSelectedEmptySlotIndex('');
    try {
      const res = await fetch(`/api/schedule/reschedule-empty?scheduleId=${scheduleId}`);
      if (!res.ok) throw new Error('Gagal mengambil slot kosong.');
      const result = await res.json();
      setAvailableEmptySlots(result.slots || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (selectedEmptySlotIndex === '') return;
    const opt = availableEmptySlots[selectedEmptySlotIndex];
    try {
      const res = await fetch('/api/schedule/reschedule-empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: rescheduleTargetId,
          timeSlotId: opt.timeSlotId,
          roomId: opt.roomId
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memindahkan jadwal.');
      alert('Jadwal berhasil dipindahkan ke slot kosong!');
      setRescheduleTargetId(null);
      setAvailableEmptySlots([]);
      setSelectedEmptySlotIndex('');
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAcceptSwapRequest = async (swapId) => {
    if (!confirm('Setujui permintaan tukar jadwal ini?')) return;
    try {
      const res = await fetch('/api/schedule/swap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, status: 'APPROVED' })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menyetujui pertukaran.');
      alert('Tukar jadwal berhasil disetujui!');
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectSwapRequest = async (swapId) => {
    if (!confirm('Tolak permintaan tukar jadwal ini?')) return;
    try {
      const res = await fetch('/api/schedule/swap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swapId, status: 'REJECTED', adminNote: 'Ditolak oleh dosen tujuan' })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menolak pertukaran.');
      alert('Tukar jadwal berhasil ditolak.');
      await refreshData();
    } catch (err) {
      alert(err.message);
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
  
  // All other lecturers' schedules (for swap target)
  const otherSchedules = data.schedules.filter(s => s.lecturerId !== user.lecturerId && s.status === 'PUBLISHED');

  // My swap requests
  const mySwapRequests = (data.swapRequests || []).filter(sr => sr.requesterId === user.lecturerId || sr.targetId === user.lecturerId);

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
            Selamat datang, <strong>{user?.name}</strong>. Di sini Anda dapat memantau jadwal mengajar, mengisi preferensi hari mengajar, dan mengajukan tukar jadwal.
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
            Preferensi Hari Mengajar
          </button>
          <button 
            className={`tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
            onClick={() => setActiveTab('swap')}
          >
            Tukar Jadwal
          </button>
        </section>

        {/* Tab 1: Jadwal Mengajar */}
        {activeTab === 'jadwal' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Jadwal Mengajar Semester Aktif</h2>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn ${scheduleWeek === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  onClick={() => setScheduleWeek('current')}
                >
                  Minggu Ini (Sementara)
                </button>
                <button 
                  className={`btn ${scheduleWeek === 'next' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  onClick={() => setScheduleWeek('next')}
                >
                  Minggu Depan (Tetap)
                </button>
              </div>
            </div>

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
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySchedules.map(schedule => {
                      const slot = scheduleWeek === 'current' ? (schedule.tempTimeSlot || schedule.timeSlot) : schedule.timeSlot;
                      const room = scheduleWeek === 'current' ? (schedule.tempRoom || schedule.room) : schedule.room;
                      const isTemp = scheduleWeek === 'current' && (schedule.tempTimeSlotId || schedule.tempRoomId);

                      return (
                        <React.Fragment key={schedule.id}>
                          <tr>
                            <td>
                              <strong>{slot?.day}</strong>
                              {isTemp && (
                                <span className="badge badge-warning" style={{ fontSize: '0.6rem', display: 'block', marginTop: '4px' }}>Sementara</span>
                              )}
                            </td>
                            <td>{slot?.startTime} - {slot?.endTime}</td>
                            <td>{schedule.course?.name}</td>
                            <td><span className="badge badge-primary">{schedule.course?.credits} SKS</span></td>
                            <td>{schedule.class?.name}</td>
                            <td><span style={{ color: 'var(--primary)', fontWeight: '600' }}>{room?.code}</span></td>
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
                            <td>
                              <button
                                onClick={() => handleInitiateReschedule(schedule.id)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
                                disabled={scheduleWeek !== 'current'}
                              >
                                {rescheduleTargetId === schedule.id ? 'Batal' : 'Pindah Slot'}
                              </button>
                            </td>
                          </tr>
                        {rescheduleTargetId === schedule.id && (
                          <tr>
                            <td colSpan="9" style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.85rem' }}>Pilih Jam & Ruangan Kosong:</strong>
                                {loadingSlots ? (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Memuat slot kosong...</span>
                                ) : availableEmptySlots.length === 0 ? (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Tidak ada slot kosong yang tersedia untuk kelas dan dosen ini.</span>
                                ) : (
                                  <>
                                    <select 
                                      className="form-control form-select" 
                                      style={{ width: 'auto', display: 'inline-block', fontSize: '0.85rem', padding: '6px 12px' }}
                                      value={selectedEmptySlotIndex}
                                      onChange={e => setSelectedEmptySlotIndex(e.target.value)}
                                    >
                                      <option value="">Pilih Slot...</option>
                                      {availableEmptySlots.map((opt, idx) => (
                                        <option key={idx} value={idx}>
                                          {opt.day}, {opt.startTime} - {opt.endTime} (Ruang {opt.roomCode})
                                        </option>
                                      ))}
                                    </select>
                                    <button 
                                      onClick={handleConfirmReschedule}
                                      className="btn btn-primary"
                                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                      disabled={selectedEmptySlotIndex === ''}
                                    >
                                      Pindahkan
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Preferensi Hari Mengajar */}
        {activeTab === 'preferensi' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Preferensi Hari Mengajar</h2>
                <p style={{ fontSize: '0.85rem' }}>
                  Pilih hari-hari yang paling nyaman bagi Anda untuk mengajar. Algoritma penjadwalan otomatis akan memprioritaskan hari pilihan Anda.
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

            {/* Day selection grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
              {days.map(day => {
                const isChecked = selectedDays.includes(day);
                return (
                  <label 
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '16px 24px',
                      border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontSize: '1rem',
                      fontWeight: '600',
                      transition: 'all var(--transition-fast)',
                      minWidth: '140px',
                      justifyContent: 'center'
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleDayToggle(day)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              * Preferensi bersifat opsional. Jika tidak memilih hari apapun, sistem akan menjadwalkan secara otomatis tanpa preferensi khusus.
            </p>
          </section>
        )}

        {/* Tab 3: Tukar Jadwal */}
        {activeTab === 'swap' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Ajukan Tukar Jadwal</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Pilih jadwal Anda yang ingin ditukar, lalu pilih jadwal dosen lain sebagai tujuan tukar. Permintaan akan diverifikasi agar tidak terjadi bentrok, dan harus disetujui oleh Admin.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Jadwal Saya yang Akan Ditukar</label>
                <select className="form-control form-select" value={swapMyScheduleId} onChange={e => setSwapMyScheduleId(e.target.value)}>
                  <option value="">Pilih Jadwal Anda...</option>
                  {mySchedules.filter(s => s.status === 'PUBLISHED').map(s => (
                    <option key={s.id} value={s.id}>
                      {s.timeSlot?.day} {s.timeSlot?.startTime} - {s.course?.name} ({s.class?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Jadwal Dosen Lain (Tujuan Tukar)</label>
                <select className="form-control form-select" value={swapTargetScheduleId} onChange={e => setSwapTargetScheduleId(e.target.value)}>
                  <option value="">Pilih Jadwal Tujuan...</option>
                  {otherSchedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.lecturer?.name} — {s.timeSlot?.day} {s.timeSlot?.startTime} - {s.course?.name} ({s.class?.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Alasan Tukar Jadwal</label>
              <input type="text" className="form-control" placeholder="Contoh: Jadwal bentrok dengan kegiatan lain" value={swapReason} onChange={e => setSwapReason(e.target.value)} />
            </div>

            {swapStatus && (
              <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: swapStatus.startsWith('Error') ? 'var(--danger-light)' : 'var(--success-light)', color: swapStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)', fontSize: '0.9rem', marginBottom: '16px' }}>
                {swapStatus}
              </div>
            )}

            <button onClick={handleSubmitSwap} className="btn btn-primary">
              Ajukan Tukar Jadwal
            </button>

            {/* Swap History */}
            {mySwapRequests.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Daftar Permintaan Tukar Jadwal</h3>
                <div className="table-container">
                  <table className="table-premium" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Pengaju</th>
                        <th>Jadwal Pengaju</th>
                        <th>Penerima</th>
                        <th>Jadwal Penerima</th>
                        <th>Alasan</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySwapRequests.map(sr => {
                        const isRequester = sr.requesterId === user.lecturerId;
                        return (
                          <tr key={sr.id}>
                            <td><strong>{sr.requester?.name || (isRequester ? user.name : 'Dosen Lain')}</strong></td>
                            <td>{sr.requesterSchedule?.course?.name} ({sr.requesterSchedule?.timeSlot?.day} {sr.requesterSchedule?.timeSlot?.startTime})</td>
                            <td><strong>{sr.target?.name || (!isRequester ? user.name : 'Dosen Lain')}</strong></td>
                            <td>{sr.targetSchedule?.course?.name} ({sr.targetSchedule?.timeSlot?.day} {sr.targetSchedule?.timeSlot?.startTime})</td>
                            <td>{sr.reason}</td>
                            <td>
                              <span className={`badge ${sr.status === 'PENDING' ? 'badge-warning' : sr.status === 'APPROVED' ? 'badge-accent' : 'badge-danger'}`}>
                                {sr.status === 'PENDING' ? 'Menunggu' : sr.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                              </span>
                            </td>
                            <td>
                              {!isRequester && sr.status === 'PENDING' && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }} 
                                    onClick={() => handleAcceptSwapRequest(sr.id)}
                                  >
                                    Setuju
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--danger)' }} 
                                    onClick={() => handleRejectSwapRequest(sr.id)}
                                  >
                                    Tolak
                                  </button>
                                </div>
                              )}
                              {isRequester && sr.status === 'PENDING' && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Menunggu Respon</span>
                              )}
                              {sr.status !== 'PENDING' && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Selesai</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
