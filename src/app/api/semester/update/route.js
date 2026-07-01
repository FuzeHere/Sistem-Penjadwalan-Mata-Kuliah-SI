import { NextResponse } from 'next/server';
import { updateSemester } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { semesterId, isActive } = body;

    if (!semesterId || isActive === undefined) {
      return NextResponse.json(
        { error: 'semesterId dan isActive wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await updateSemester(semesterId, isActive);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Semester berhasil diperbarui.',
        semester: res.semester || res.updated
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal memperbarui semester.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error updating semester:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
