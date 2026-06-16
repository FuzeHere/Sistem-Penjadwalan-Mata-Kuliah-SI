import { NextResponse } from 'next/server';
import { saveLecturerPreference } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { lecturerId, preferences } = body;

    if (!lecturerId || !preferences) {
      return NextResponse.json(
        { error: 'Parameter lecturerId dan preferences diperlukan.' },
        { status: 400 }
      );
    }

    const result = await saveLecturerPreference(lecturerId, preferences);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error saving lecturer preferences:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan preferensi.' },
      { status: 500 }
    );
  }
}
