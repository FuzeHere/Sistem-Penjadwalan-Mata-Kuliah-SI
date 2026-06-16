import { NextResponse } from 'next/server';
import { updateStudentMaxSks } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { studentId, maxSks } = body;

    if (!studentId || maxSks === undefined) {
      return NextResponse.json(
        { error: 'studentId dan maxSks wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await updateStudentMaxSks(studentId, maxSks);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Batas SKS mahasiswa berhasil diperbarui.',
        student: res.student || res.updated
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal memperbarui batas SKS.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error updating student maxSks:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
