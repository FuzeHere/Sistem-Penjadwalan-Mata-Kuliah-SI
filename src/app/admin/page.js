'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { exportScheduleToPDF } from '@/utils/pdfGenerator';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI Tabs: 'overview', 'generator', 'master', 'konflik', 'revisi'
  const [activeTab, setActiveTab] = useState('overview');
  
  // Generator State
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // Master Data Add State
  const [masterTab, setMasterTab] = useState('lecturers');
  const [masterForm, setMasterForm] = useState({});
  const [masterLoading, setMasterLoading] = useState(false);

  // Revision Modal State
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [revisedRoom, setRevisedRoom] = useState('');
  const [revisedSlot, setRevisedSlot] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'ADMIN') {
      router.push('/dosen');
      return;
    }
    setTimeout(() => {
      setUser(parsedUser);
    }, 0);

    fetchData();
  }, [router]);

  async function fetchData() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Gagal memuat data akademik.');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Trigger Scheduler Generator
  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/schedule/generate', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal generate jadwal.');
      
      setGenResult({
        success: true,
        summary: result.summary
      });
      await fetchData(); // Reload fresh schedules
    } catch (err) {
      setGenResult({
        success: false,
        error: err.message
      });
    } finally {
      setGenerating(false);
    }
  };

  // Publish all schedules
  const handlePublish = async () => {
    if (!confirm('Apakah Anda yakin ingin mempublikasikan semua draft jadwal? Mahasiswa akan dapat melihat perubahan ini.')) return;
    try {
      const res = await fetch('/api/schedule/publish', { method: 'POST' });
      if (!res.ok) throw new Error('Gagal mempublikasikan jadwal.');
      alert('Jadwal berhasil dipublikasikan!');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle CRUD record creation
  const handleAddMaster = async (e) => {
    e.preventDefault();
    setMasterLoading(true);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: masterTab,
          record: masterForm
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menambahkan data.');
      }

      setMasterForm({});
      await fetchData();
      alert('Data master berhasil ditambahkan!');
    } catch (err) {
      alert(err.message);
    } finally {
      setMasterLoading(false);
    }
  };

  // Open Revision Modal
  const openRevisionModal = (schedule) => {
    setSelectedSchedule(schedule);
    setRevisedRoom(schedule.roomId);
    setRevisedSlot(schedule.timeSlotId);
    setRevisionReason('');
  };

  // Submit Schedule Revision
  const handleSaveRevision = async () => {
    if (!revisionReason) {
      alert('Alasan revisi wajib diisi!');
      return;
    }
    setRevising(true);
    try {
      const res = await fetch('/api/schedule/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule.id,
          updateData: {
            roomId: revisedRoom,
            timeSlotId: revisedSlot,
            lecturerId: selectedSchedule.lecturerId,
            assistantId: selectedSchedule.assistantId
          },
          revisedBy: user.name,
          reason: revisionReason
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menyimpan revisi.');

      setSelectedSchedule(null);
      await fetchData();
      alert('Jadwal berhasil direvisi!');
    } catch (err) {
      alert(err.message);
    } finally {
      setRevising(false);
    }
  };

  const handleExportPDFAll = (classId, className) => {
    const schedules = data.schedules.filter(s => s.classId === classId);
    exportScheduleToPDF({
      schedules,
      title: 'JADWAL PERKULIAHAN RESMI',
      subtitle: `Kelas: ${className} | Tahun Akademik: 2025/2026 - Ganjil`,
      fileName: `jadwal-kuliah-${className.toLowerCase()}`
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <h3 style={{ margin: 'auto' }}>Memuat Dashboard Admin...</h3>
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

  // Count active stats
  const totalDosen = data.lecturers.length;
  const totalMahasiswa = data.students.length;
  const totalMatkul = data.courses.length;
  const totalRuangan = data.rooms.length;
  const totalKelas = data.classes.length;
  const draftSchedules = data.schedules.filter(s => s.status === 'DRAFT');
  const publishedSchedules = data.schedules.filter(s => s.status === 'PUBLISHED');

  return (
    <>
      <Navbar />

      <main className="layout-container">
        {/* Banner */}
        <section className="header-banner animate-fade">
          <span className="badge badge-primary" style={{ marginBottom: '12px' }}>Admin Jurusan</span>
          <h1>Sistem Manajemen Penjadwalan Akademik</h1>
          <p style={{ color: '#e2e8f0', marginTop: '8px' }}>
            Kelola data akademik dasar, picu penyusunan jadwal otomatis bebas bentrok, revisi manual bila diperlukan, dan publikasikan berkas cetak jadwal perkuliahan.
          </p>
        </section>

        {/* Stats row */}
        <section className="card-grid animate-fade">
          <div className="glass-panel stat-card">
            <span className="stat-title">Dosen Pengajar</span>
            <span className="stat-value">{totalDosen}</span>
            <span className="stat-desc">Dosen aktif jurusan</span>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-title">Mahasiswa & Asdos</span>
            <span className="stat-value">{totalMahasiswa}</span>
            <span className="stat-desc">Mahasiswa terdaftar</span>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-title">Mata Kuliah</span>
            <span className="stat-value">{totalMatkul}</span>
            <span className="stat-desc">Kurikulum aktif</span>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-title">Ruang Kelas</span>
            <span className="stat-value">{totalRuangan}</span>
            <span className="stat-desc">Kapasitas & tipe tersedia</span>
          </div>
        </section>

        {/* Action Controls */}
        <section style={{ display: 'flex', gap: '12px', marginBottom: '32px' }} className="animate-fade">
          <button 
            onClick={() => setActiveTab('generator')}
            className="btn btn-primary"
          >
            Generator Jadwal Otomatis
          </button>
          <button 
            onClick={handlePublish}
            className="btn btn-accent"
            disabled={draftSchedules.length === 0}
          >
            Publikasikan Jadwal
          </button>
        </section>

        {/* Nav Tabs */}
        <section className="tab-nav animate-fade">
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Hasil Jadwal & Revisi
          </button>
          <button className={`tab-btn ${activeTab === 'master' ? 'active' : ''}`} onClick={() => setActiveTab('master')}>
            Kelola Data Master
          </button>
          <button className={`tab-btn ${activeTab === 'students-sks' ? 'active' : ''}`} onClick={() => setActiveTab('students-sks')}>
            Batas SKS Mahasiswa
          </button>
          <button className={`tab-btn ${activeTab === 'konflik' ? 'active' : ''}`} onClick={() => setActiveTab('konflik')}>
            Laporan Bentrok ({data.conflicts.length})
          </button>
          <button className={`tab-btn ${activeTab === 'revisi' ? 'active' : ''}`} onClick={() => setActiveTab('revisi')}>
            Riwayat Revisi ({data.revisions.length})
          </button>
        </section>

        {/* Tab contents */}
        {activeTab === 'overview' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Hasil Jadwal per Kelas (Telah Diterbitkan: {publishedSchedules.length})</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {data.classes.map(cls => {
                const clsSchedules = data.schedules.filter(s => s.classId === cls.id);
                return (
                  <div key={cls.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: 0 }}>Kelas {cls.name} (Semester {cls.semester})</h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleExportPDFAll(cls.id, cls.name)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          disabled={clsSchedules.length === 0}
                        >
                          PDF
                        </button>
                      </div>
                    </div>

                    {clsSchedules.length === 0 ? (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Belum ada jadwal yang disusun untuk kelas ini.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Hari & Jam</th>
                              <th>Mata Kuliah</th>
                              <th>Dosen</th>
                              <th>Asisten Dosen</th>
                              <th>Ruangan</th>
                              <th>Status</th>
                              <th>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clsSchedules.map(s => (
                              <tr key={s.id} style={{ backgroundColor: s.status === 'DRAFT' ? 'rgba(217, 119, 6, 0.05)' : 'transparent' }}>
                                <td>
                                  <strong>{s.timeSlot?.day}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.timeSlot?.startTime} - {s.timeSlot?.endTime}</span>
                                </td>
                                <td>
                                  <strong>{s.course?.name}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.course?.code} ({s.course?.credits} SKS)</span>
                                </td>
                                <td>{s.lecturer?.name}</td>
                                <td>
                                  {s.assistant ? (
                                    <span className="badge badge-accent">{s.assistant.name}</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                  )}
                                </td>
                                <td><span style={{ color: 'var(--primary)', fontWeight: '600' }}>{s.room?.code}</span></td>
                                <td>
                                  <span className={`badge ${s.status === 'PUBLISHED' ? 'badge-primary' : 'badge-warning'}`}>
                                    {s.status}
                                  </span>
                                </td>
                                <td>
                                  <button 
                                    onClick={() => openRevisionModal(s)}
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  >
                                    Revisi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'generator' && (
          <section className="glass-panel animate-fade" style={{ padding: '32px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Penyusun Jadwal Otomatis</h2>
            <p style={{ maxWidth: '600px', margin: '0 auto 24px', color: 'var(--text-secondary)' }}>
              Picu generator jadwal berbasis batasan heuristik (constraint-based). Sistem akan otomatis memperhitungkan preferensi waktu dosen, kapasitas ruangan, kecocokan jenis ruangan, dan menghindari bentrok mengajar maupun bentrok asisten dosen yang sedang kuliah.
            </p>
            
            <button 
              onClick={handleGenerate}
              className="btn btn-primary"
              style={{ padding: '14px 28px', fontSize: '1rem' }}
              disabled={generating}
            >
              {generating ? 'Menghitung & Menyusun Jadwal...' : 'Jalankan Generator Jadwal'}
            </button>

            {genResult && (
              <div style={{
                marginTop: '24px',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: genResult.success ? 'var(--success-light)' : 'var(--danger-light)',
                color: genResult.success ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${genResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                <h3 style={{ marginBottom: '8px' }}>
                  {genResult.success ? 'Penyusunan Jadwal Selesai' : 'Generator Gagal'}
                </h3>
                {genResult.success ? (
                  <div>
                    <p>Proses integrasi penjadwalan berhasil diselesaikan:</p>
                    <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                      <li>Total Terjadwal: <strong>{genResult.summary.totalScheduled} kelas</strong></li>
                      <li>Kelas Gagal Terjadwal: <strong>{genResult.summary.totalUnscheduled}</strong></li>
                      <li>Total Konflik Terdeteksi: <strong>{genResult.summary.totalConflicts}</strong></li>
                    </ul>
                    <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                      *Jadwal saat ini disimpan sebagai <strong>DRAFT</strong>. Klik tab &quot;Laporan Bentrok&quot; jika ada kelas yang gagal dijadwalkan untuk melakukan revisi manual.
                    </p>
                  </div>
                ) : (
                  <p>Error: {genResult.error}</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Kelola Data Master */}
        {activeTab === 'master' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Manajemen Data Master Akademik</h2>
            
            {/* Master sub tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {['lecturers', 'students', 'courses', 'rooms', 'classes'].map(tab => (
                <button 
                  key={tab}
                  className={`btn ${masterTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                  onClick={() => { setMasterTab(tab); setMasterForm({}); }}
                >
                  {tab === 'lecturers' && 'Dosen'}
                  {tab === 'students' && 'Mahasiswa/Asdos'}
                  {tab === 'courses' && 'Mata Kuliah'}
                  {tab === 'rooms' && 'Ruangan'}
                  {tab === 'classes' && 'Kelas'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
              {/* Form Input */}
              <form onSubmit={handleAddMaster} className="glass-panel" style={{ padding: '20px', backgroundColor: 'var(--bg-primary)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Tambah Record Baru</h3>

                {masterTab === 'lecturers' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">NIDN</label>
                      <input type="text" className="form-control" placeholder="00xxxxxxxx" required onChange={e => setMasterForm({...masterForm, nidn: e.target.value})} value={masterForm.nidn || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nama Dosen</label>
                      <input type="text" className="form-control" placeholder="Nama Lengkap & Gelar" required onChange={e => setMasterForm({...masterForm, name: e.target.value})} value={masterForm.name || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" placeholder="dosen@uin-alauddin.ac.id" required onChange={e => setMasterForm({...masterForm, email: e.target.value})} value={masterForm.email || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Telepon</label>
                      <input type="text" className="form-control" placeholder="08xxxxxxxx" onChange={e => setMasterForm({...masterForm, phone: e.target.value})} value={masterForm.phone || ''} />
                    </div>
                  </>
                )}

                {masterTab === 'students' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">NIM</label>
                      <input type="text" className="form-control" placeholder="609001xxxxxx" required onChange={e => setMasterForm({...masterForm, nim: e.target.value})} value={masterForm.nim || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nama Lengkap</label>
                      <input type="text" className="form-control" placeholder="Nama Mahasiswa" required onChange={e => setMasterForm({...masterForm, name: e.target.value})} value={masterForm.name || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kelas Asal</label>
                      <select className="form-control form-select" required onChange={e => setMasterForm({...masterForm, classId: e.target.value})} value={masterForm.classId || ''}>
                        <option value="">Pilih Kelas...</option>
                        {data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Semester</label>
                      <input type="number" className="form-control" min="1" max="8" required onChange={e => setMasterForm({...masterForm, semester: e.target.value})} value={masterForm.semester || ''} />
                    </div>
                  </>
                )}

                {masterTab === 'courses' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Kode MK</label>
                      <input type="text" className="form-control" placeholder="SI-xxx" required onChange={e => setMasterForm({...masterForm, code: e.target.value})} value={masterForm.code || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nama Mata Kuliah</label>
                      <input type="text" className="form-control" placeholder="Nama MK" required onChange={e => setMasterForm({...masterForm, name: e.target.value})} value={masterForm.name || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">SKS</label>
                      <input type="number" className="form-control" min="1" max="4" required onChange={e => setMasterForm({...masterForm, credits: e.target.value})} value={masterForm.credits || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipe MK</label>
                      <select className="form-control form-select" required onChange={e => setMasterForm({...masterForm, type: e.target.value, needsLab: e.target.value === 'PRACTICAL'})} value={masterForm.type || ''}>
                        <option value="">Pilih Tipe...</option>
                        <option value="THEORY">Teori</option>
                        <option value="PRACTICAL">Praktikum</option>
                      </select>
                    </div>
                  </>
                )}

                {masterTab === 'rooms' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Kode Ruangan</label>
                      <input type="text" className="form-control" placeholder="Contoh: 101 atau 202" required onChange={e => setMasterForm({...masterForm, code: e.target.value})} value={masterForm.code || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lantai</label>
                      <input type="number" className="form-control" min="1" max="4" required onChange={e => setMasterForm({...masterForm, floor: e.target.value})} value={masterForm.floor || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kapasitas</label>
                      <input type="number" className="form-control" min="1" required onChange={e => setMasterForm({...masterForm, capacity: e.target.value})} value={masterForm.capacity || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipe Ruangan</label>
                      <select className="form-control form-select" required onChange={e => setMasterForm({...masterForm, type: e.target.value})} value={masterForm.type || ''}>
                        <option value="">Pilih Tipe...</option>
                        <option value="REGULAR">Kelas Reguler</option>
                        <option value="LAB">Laboratorium Komputer</option>
                      </select>
                    </div>
                  </>
                )}

                {masterTab === 'classes' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nama Kelas</label>
                      <input type="text" className="form-control" placeholder="Contoh: SI-1A" required onChange={e => setMasterForm({...masterForm, name: e.target.value})} value={masterForm.name || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Semester</label>
                      <input type="number" className="form-control" min="1" max="8" required onChange={e => setMasterForm({...masterForm, semester: e.target.value})} value={masterForm.semester || ''} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kapasitas</label>
                      <input type="number" className="form-control" min="1" required onChange={e => setMasterForm({...masterForm, capacity: e.target.value})} value={masterForm.capacity || ''} />
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={masterLoading}>
                  {masterLoading ? 'Menyimpan...' : 'Tambah Record'}
                </button>
              </form>

              {/* Data List View */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1rem' }}>Daftar Record Aktif</h3>
                <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table className="table-premium" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        {masterTab === 'lecturers' && <><th>NIDN</th><th>Nama Dosen</th><th>Email</th></>}
                        {masterTab === 'students' && <><th>NIM</th><th>Nama</th><th>Smt</th></>}
                        {masterTab === 'courses' && <><th>Kode</th><th>Nama MK</th><th>SKS</th><th>Tipe</th></>}
                        {masterTab === 'rooms' && <><th>Kode</th><th>Lantai</th><th>Kapasitas</th><th>Tipe</th></>}
                        {masterTab === 'classes' && <><th>Nama Kelas</th><th>Smt</th><th>Kapasitas</th></>}
                      </tr>
                    </thead>
                    <tbody>
                      {masterTab === 'lecturers' && data.lecturers.map(item => (
                        <tr key={item.id}><td>{item.nidn}</td><td>{item.name}</td><td>{item.email}</td></tr>
                      ))}
                      {masterTab === 'students' && data.students.map(item => (
                        <tr key={item.id}><td>{item.nim}</td><td>{item.name}</td><td>Sem. {item.semester}</td></tr>
                      ))}
                      {masterTab === 'courses' && data.courses.map(item => (
                        <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.credits}</td><td>{item.type}</td></tr>
                      ))}
                      {masterTab === 'rooms' && data.rooms.map(item => (
                        <tr key={item.id}><td>{item.code}</td><td>{item.floor}</td><td>{item.capacity} mhs</td><td>{item.type}</td></tr>
                      ))}
                      {masterTab === 'classes' && data.classes.map(item => (
                        <tr key={item.id}><td>{item.name}</td><td>{item.semester}</td><td>{item.capacity} mhs</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Conflicts Report */}
        {activeTab === 'konflik' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Laporan Bentrok Jadwal</h2>
            {data.conflicts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--accent)' }}>
                <h3>Tidak Ada Bentrok Jadwal!</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Semua mata kuliah dan kelas berhasil ditempatkan tanpa tabrakan.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.conflicts.map(conf => (
                  <div 
                    key={conf.id}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--danger-light)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--danger)',
                      fontSize: '0.9rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>Konflik Hard Constraint:</strong>
                      <p style={{ color: 'var(--text-primary)', marginTop: '4px' }}>{conf.description}</p>
                    </div>
                    <span className="badge badge-danger">Unresolved</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Revisions History */}
        {activeTab === 'revisi' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Riwayat Revisi Manual</h2>
            {data.revisions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>Belum ada riwayat revisi jadwal manual yang tercatat.</p>
            ) : (
              <div className="table-container">
                <table className="table-premium" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Tanggal & Waktu</th>
                      <th>Direvisi Oleh</th>
                      <th>Alasan Revisi</th>
                      <th>Detail Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revisions.map(rev => (
                      <tr key={rev.id}>
                        <td>{new Date(rev.createdAt).toLocaleString('id-ID')}</td>
                        <td><strong>{rev.revisedBy}</strong></td>
                        <td>{rev.reason}</td>
                        <td>
                          {rev.oldData && rev.newData && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Ruang/Slot: {data.rooms.find(r => r.id === rev.oldData.roomId)?.code || 'Lama'} ➡️ {data.rooms.find(r => r.id === rev.newData.roomId)?.code || 'Baru'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'students-sks' && (
          <section className="glass-panel animate-fade" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Pengaturan Batas Maksimal SKS Mahasiswa</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '24px', color: 'var(--text-muted)' }}>
              Tentukan batas SKS maksimum yang dapat diambil oleh setiap mahasiswa dalam pengisian Kartu Rencana Studi (KRS) mereka.
            </p>
            
            <div className="table-container">
              <table className="table-premium" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>NIM</th>
                    <th>Nama Mahasiswa</th>
                    <th>Kelas</th>
                    <th>Semester</th>
                    <th>Batas SKS Maksimum</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map(std => (
                    <StudentSksRow key={std.id} student={std} onSave={fetchData} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Revision Modal Dialog */}
      {selectedSchedule && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem' }}>Revisi Manual Jadwal Perkuliahan</h3>
              <button onClick={() => setSelectedSchedule(null)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Detail Kelas:</p>
                <h3 style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                  {selectedSchedule.course?.name} ({selectedSchedule.class?.name})
                </h3>
                <p style={{ fontSize: '0.9rem' }}>Dosen: {selectedSchedule.lecturer?.name}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Pilih Ruangan</label>
                <select 
                  className="form-control form-select"
                  value={revisedRoom}
                  onChange={e => setRevisedRoom(e.target.value)}
                >
                  {data.rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      Ruangan {room.code} ({room.type === 'LAB' ? 'LAB' : 'REGULER'} - Kapasitas {room.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pilih Slot Waktu</label>
                <select 
                  className="form-control form-select"
                  value={revisedSlot}
                  onChange={e => setRevisedSlot(e.target.value)}
                >
                  {data.timeSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.day}: {slot.startTime} - {slot.endTime}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Alasan Revisi</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Misal: Penyesuaian preferensi dosen / bentrok ruangan"
                  value={revisionReason}
                  onChange={e => setRevisionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => setSelectedSchedule(null)}
                className="btn btn-secondary"
                disabled={revising}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveRevision}
                className="btn btn-primary"
                disabled={revising}
              >
                {revising ? 'Menyimpan...' : 'Simpan Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StudentSksRow({ student, onSave }) {
  const [maxSks, setMaxSks] = useState(student.maxSks || 24);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/student/max-sks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, maxSks })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengubah SKS');
      }
      alert(`Batas SKS untuk ${student.name} berhasil diubah menjadi ${maxSks} SKS!`);
      if (onSave) onSave();
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <tr>
      <td><strong>{student.nim}</strong></td>
      <td>{student.name}</td>
      <td>{student.classId}</td>
      <td>Semester {student.semester}</td>
      <td>
        <input 
          type="number" 
          className="form-control" 
          value={maxSks} 
          onChange={e => setMaxSks(parseInt(e.target.value))} 
          min="1" 
          max="24"
          style={{ width: '80px', padding: '6px 12px', display: 'inline-block' }} 
        /> SKS
      </td>
      <td>
        <button 
          onClick={handleUpdate} 
          className="btn btn-primary" 
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          disabled={updating}
        >
          {updating ? 'Menyimpan...' : 'Simpan'}
        </button>
      </td>
    </tr>
  );
}
