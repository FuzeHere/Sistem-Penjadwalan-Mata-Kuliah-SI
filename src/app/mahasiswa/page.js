'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { exportScheduleToPDF } from '@/utils/pdfGenerator';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data master
  const [courses, setCourses] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  
  // KRS selection state
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [isKrsSubmitted, setIsKrsSubmitted] = useState(false);
  const [savingKrs, setSavingKrs] = useState(false);
  const [krsMessage, setKrsMessage] = useState({ type: '', text: '' });
  const [scheduleWeek, setScheduleWeek] = useState('current'); // 'current' or 'next'

  const fetchStudentData = async (studentId) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch KRS data & available courses
      const enrollRes = await fetch(`/api/student/enroll?studentId=${studentId}`);
      if (!enrollRes.ok) throw new Error('Gagal mengambil data rencana studi.');
      const enrollResult = await enrollRes.json();

      setStudentDetails(enrollResult.student);
      setCourses(enrollResult.courses || []);
      
      const enrolledIds = (enrollResult.enrollments || []).map(e => e.courseId);
      setSelectedCourseIds(enrolledIds);
      setIsKrsSubmitted(enrolledIds.length > 0);

      // 2. Fetch all published schedules to construct personalized timetable
      const dataRes = await fetch('/api/data');
      if (!dataRes.ok) throw new Error('Gagal mengambil data jadwal.');
      const dataResult = await dataRes.json();
      
      // Filter only published schedules
      const published = (dataResult.schedules || []).filter(s => s.status === 'PUBLISHED');
      setAllSchedules(published);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'STUDENT') {
        router.push(parsedUser.role === 'ADMIN' ? '/admin' : '/dosen');
        return;
      }
      setTimeout(() => {
        setUser(parsedUser);
        fetchStudentData(parsedUser.studentId);
      }, 0);
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/login');
    router.refresh();
  };

  const handleCheckboxChange = (courseId) => {
    setSelectedCourseIds(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  const handleSaveKrs = async () => {
    setSavingKrs(true);
    setKrsMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentDetails.id,
          courseIds: selectedCourseIds
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menyimpan KRS.');

      setKrsMessage({ type: 'success', text: 'Rencana Studi (KRS) berhasil disimpan!' });
      setIsKrsSubmitted(true);
      // Re-fetch data to sync
      fetchStudentData(studentDetails.id);
    } catch (err) {
      setKrsMessage({ type: 'danger', text: err.message });
    } finally {
      setSavingKrs(false);
    }
  };

  // Calculations
  const selectedCourses = courses.filter(c => selectedCourseIds.includes(c.id));
  const currentTotalSks = selectedCourses.reduce((sum, c) => sum + c.credits, 0);
  const maxSksAllowed = studentDetails?.maxSks || 24;
  const isOverLimit = currentTotalSks > maxSksAllowed;

  // Filter schedules to only show selected courses
  const getPersonalSchedules = () => {
    return allSchedules.filter(s => 
      (selectedCourseIds.includes(s.courseId) && s.classId === studentDetails?.classId) ||
      (s.assistantId === studentDetails?.id)
    );
  };

  const personalSchedules = getPersonalSchedules();

  const handleExportPDF = () => {
    const mappedSchedules = scheduleWeek === 'current' ? personalSchedules.map(s => ({
      ...s,
      timeSlot: s.tempTimeSlot || s.timeSlot,
      room: s.tempRoom || s.room
    })) : personalSchedules;

    exportScheduleToPDF({
      schedules: mappedSchedules,
      title: `KARTU RENCANA STUDI & JADWAL KULIAH MAHASISWA - ${scheduleWeek === 'current' ? 'MINGGU INI (SEMENTARA)' : 'JADWAL TETAP'}`,
      subtitle: `Nama: ${studentDetails.name} | NIM: ${studentDetails.nim} | Batas SKS: ${studentDetails.maxSks} | Total SKS KRS: ${currentTotalSks} SKS`,
      fileName: `krs-jadwal-${studentDetails.nim}`
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-color)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ fontWeight: '600' }}>Memuat Portal Rencana Studi Mahasiswa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
        <h2>Error: {error}</h2>
        <p>Silakan muat ulang halaman atau periksa koneksi.</p>
        <button className="btn btn-primary" onClick={() => router.push('/login')} style={{ marginTop: '16px' }}>Kembali Login</button>
      </div>
    );
  }

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <>
      <Navbar />

      <main className="layout-container">
        {/* Banner Mahasiswa */}
        <section className="header-banner animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span className="badge badge-accent" style={{ marginBottom: '12px' }}>Portal Mahasiswa</span>
            <h1>Selamat Datang, {studentDetails?.name}</h1>
            <p style={{ color: '#e2e8f0' }}>NIM: {studentDetails?.nim} | Kelas: {studentDetails?.classId} | Semester {studentDetails?.semester}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            Keluar Portal
          </button>
        </section>

        {isKrsSubmitted ? (
          <div style={{ marginTop: '32px' }}>
            {/* Personal Timetable Card (Full Width for Submitted/Locked KRS) */}
            <section className="glass-panel animate-fade" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--text-primary)' }}>Jadwal Kuliah Saya (KRS Terkunci)</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Rencana Studi (KRS) Anda telah tersimpan. Silakan cetak atau unduh jadwal perkuliahan Anda di bawah ini.
                  </p>
                </div>
                <button 
                  onClick={handleExportPDF} 
                  className="btn btn-accent" 
                  style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                  disabled={personalSchedules.length === 0}
                >
                  Cetak Rencana Studi & Jadwal
                </button>
              </div>

              {krsMessage.text && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--success-light)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  marginBottom: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  {krsMessage.text}
                </div>
              )}

              {personalSchedules.length === 0 ? (
                <div style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--primary)' }}>KRS Terkunci (Jadwal Belum Rilis)</h4>
                    <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-muted)' }}>
                      Pilihan mata kuliah Anda telah disimpan. Jadwal perkuliahan belum digenerate/dirilis oleh Admin Jurusan.
                    </p>
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <h5 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Daftar Mata Kuliah Terpilih:</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {courses.filter(c => selectedCourseIds.includes(c.id)).map(course => (
                        <div key={course.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{course.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Kode: {course.code}</span>
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)' }}>{course.credits} SKS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className={`btn ${scheduleWeek === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      onClick={() => setScheduleWeek('current')}
                    >
                      Minggu Ini (Sementara)
                    </button>
                    <button 
                      className={`btn ${scheduleWeek === 'next' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      onClick={() => setScheduleWeek('next')}
                    >
                      Minggu Depan / Tetap
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                    {days.map(day => {
                      const daySchedules = personalSchedules.filter(s => {
                        const slot = scheduleWeek === 'current' ? (s.tempTimeSlot || s.timeSlot) : s.timeSlot;
                        return slot?.day === day;
                      });
                      return (
                        <div key={day} style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <h4 style={{ color: 'var(--primary)', margin: '0 0 8px', fontSize: '1.05rem', borderBottom: '2px solid var(--primary)', paddingBottom: '6px' }}>
                            {day}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
                            {daySchedules.length === 0 ? (
                              <div style={{ 
                                textAlign: 'center', 
                                padding: '24px 12px', 
                                color: 'var(--text-muted)', 
                                fontSize: '0.8rem', 
                                fontStyle: 'italic', 
                                border: '1px dashed var(--border-color)', 
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                minHeight: '80px'
                              }}>
                                Tidak ada kuliah
                              </div>
                            ) : (
                              daySchedules.map(sch => {
                                const slot = scheduleWeek === 'current' ? (sch.tempTimeSlot || sch.timeSlot) : sch.timeSlot;
                                const room = scheduleWeek === 'current' ? (sch.tempRoom || sch.room) : sch.room;
                                const isTemp = scheduleWeek === 'current' && (sch.tempTimeSlotId || sch.tempRoomId);

                                return (
                                  <div 
                                    key={sch.id}
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--bg-primary)',
                                      borderLeft: `4px solid ${sch.course?.type === 'PRACTICAL' ? 'var(--accent)' : 'var(--primary)'}`,
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                        {slot?.startTime} - {slot?.endTime}
                                      </span>
                                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Ruang {room?.code}
                                        {isTemp && (
                                          <span className="badge badge-warning" style={{ fontSize: '0.55rem', padding: '2px 4px' }}>Sementara</span>
                                        )}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '800', display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>{sch.course?.name}</span>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <span>Dosen: {sch.lecturer?.name}</span>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {sch.assistantId === studentDetails?.id && (
                                          <span className="badge badge-accent" style={{ fontSize: '0.65rem', fontWeight: '700' }}>ASDOS</span>
                                        )}
                                        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{sch.course?.credits} SKS</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginTop: '32px' }}>
            
            {/* KRS Selection Card */}
            <section className="glass-panel animate-fade" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Kartu Rencana Studi (KRS)</h2>
                <span className={`badge ${isOverLimit ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  {currentTotalSks} / {maxSksAllowed} SKS
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Silakan centang mata kuliah yang ingin Anda ambil untuk semester ini. Pilihan KRS hanya dapat disimpan **1x saja**. Setelah disimpan, pilihan Anda akan dikunci.
              </p>

              {krsMessage.text && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: krsMessage.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                  color: krsMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  marginBottom: '20px',
                  border: `1px solid ${krsMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                  {krsMessage.text}
                </div>
              )}

              {/* Course List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', paddingRight: '4px' }}>
                {courses.map(course => {
                  const isSelected = selectedCourseIds.includes(course.id);
                  return (
                    <label 
                      key={course.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-secondary)',
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleCheckboxChange(course.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--primary)',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', display: 'block' }}>{course.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kode: {course.code} | Tipe: {course.type}</span>
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--primary)' }}>{course.credits} SKS</span>
                    </label>
                  );
                })}
              </div>

              <button 
                onClick={handleSaveKrs}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontWeight: '700' }}
                disabled={savingKrs || isOverLimit}
              >
                {savingKrs ? 'Menyimpan KRS...' : 'Simpan Rencana Studi (KRS)'}
              </button>
              
              {isOverLimit && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', textAlign: 'center', marginTop: '8px', fontWeight: '600' }}>
                  Batas SKS terlampaui! Anda harus membatalkan beberapa pilihan mata kuliah.
                </p>
              )}
            </section>

            {/* Preview Timetable Card */}
            <section className="glass-panel animate-fade" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Pratinjau Jadwal Kuliah</h2>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Pratinjau jadwal kuliah Anda berdasarkan mata kuliah yang dicentang di sebelah kiri.
              </p>

              {personalSchedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h4 style={{ margin: '0 0 8px' }}>Belum Ada Pratinjau</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    Silakan centang mata kuliah di panel sebelah kiri untuk melihat pratinjau jadwal perkuliahan.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                  {days.map(day => {
                    const daySchedules = personalSchedules.filter(s => s.timeSlot?.day === day);
                    if (daySchedules.length === 0) return null;

                    return (
                      <div key={day} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                        <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '0.95rem' }}>{day}</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {daySchedules.map(sch => (
                            <div 
                              key={sch.id}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-secondary)',
                                borderLeft: `3px solid ${sch.course?.type === 'PRACTICAL' ? 'var(--accent)' : 'var(--primary)'}`
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
                                  {sch.timeSlot?.startTime} - {sch.timeSlot?.endTime}
                                </span>
                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                                  Ruang {sch.room?.code}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700', display: 'block' }}>{sch.course?.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dosen: {sch.lecturer?.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
