import { NextResponse } from 'next/server';
import { saveStudentEnrollments } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId wajib dikirim.' },
        { status: 400 }
      );
    }

    // saveStudentEnrollments with an empty array deletes all enrollments
    const res = await saveStudentEnrollments(studentId, []);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'KRS mahasiswa berhasil direset (pilihan dikosongkan/diulang).'
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal mereset KRS mahasiswa.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error resetting student KRS:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
