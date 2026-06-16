import { NextResponse } from 'next/server';
import { updateSchedule } from '@/utils/dbHelper';

export async function POST(request) {
  try {
    const body = await request.json();
    const { scheduleId, updateData, revisedBy, reason } = body;

    if (!scheduleId || !updateData || !revisedBy || !reason) {
      return NextResponse.json(
        { error: 'Parameter scheduleId, updateData, revisedBy, dan reason diperlukan.' },
        { status: 400 }
      );
    }

    const result = await updateSchedule(scheduleId, updateData, revisedBy, reason);
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: result.error || 'Gagal mengubah jadwal.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error updating schedule:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal.' },
      { status: 500 }
    );
  }
}
