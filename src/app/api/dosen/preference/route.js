import { NextResponse } from 'next/server';
import { saveLecturerPreference } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { lecturerId, preferredDays } = body;

    if (!lecturerId || !preferredDays) {
      return NextResponse.json(
        { error: 'Parameter lecturerId dan preferredDays diperlukan.' },
        { status: 400 }
      );
    }

    // Validate days
    const validDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const invalidDays = preferredDays.filter(d => !validDays.includes(d));
    if (invalidDays.length > 0) {
      return NextResponse.json(
        { error: `Hari tidak valid: ${invalidDays.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await saveLecturerPreference(lecturerId, preferredDays);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error saving lecturer preferences:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan preferensi.' },
      { status: 500 }
    );
  }
}
