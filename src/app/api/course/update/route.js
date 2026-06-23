import { NextResponse } from 'next/server';
import { updateCourse } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { courseId, semester, isActive } = body;

    if (!courseId || semester === undefined || isActive === undefined) {
      return NextResponse.json(
        { error: 'courseId, semester, dan isActive wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await updateCourse(courseId, semester, isActive);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Mata kuliah berhasil diperbarui.',
        course: res.course || res.updated
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal memperbarui mata kuliah.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error updating course:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
