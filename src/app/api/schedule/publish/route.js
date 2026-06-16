import { NextResponse } from 'next/server';
import { publishSchedules } from '@/utils/dbHelper';

export async function POST() {
  try {
    const result = await publishSchedules();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error publishing schedules:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mempublikasikan jadwal.' },
      { status: 500 }
    );
  }
}
