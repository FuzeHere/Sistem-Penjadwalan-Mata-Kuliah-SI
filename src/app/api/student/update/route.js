import { NextResponse } from 'next/server';
import { updateStudentMaster } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { studentId, semester, classId } = body;

    if (!studentId || semester === undefined || !classId) {
      return NextResponse.json(
        { error: 'studentId, semester, dan classId wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await updateStudentMaster(studentId, semester, classId);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Data master mahasiswa berhasil diperbarui.',
        student: res.student
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal memperbarui data master mahasiswa.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error updating student master:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
