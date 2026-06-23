import { NextResponse } from 'next/server';
import { getAvailableTimeSlotsForSchedule, rescheduleToEmptySlot } from '@/utils/dbHelper';

/**
 * GET /api/schedule/reschedule-empty?scheduleId=xxx
 * Returns the list of empty, non-conflicting time slots for a schedule's class and lecturer.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Parameter scheduleId wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await getAvailableTimeSlotsForSchedule(scheduleId);
    if (res.success) {
      return NextResponse.json({ success: true, slots: res.slots });
    } else {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
  } catch (err) {
    console.error('Error fetching empty slots:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedule/reschedule-empty
 * Directly reschedules a schedule to an empty slot.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { scheduleId, timeSlotId, roomId } = body;

    if (!scheduleId || !timeSlotId || !roomId) {
      return NextResponse.json(
        { error: 'scheduleId, timeSlotId, dan roomId wajib dikirim.' },
        { status: 400 }
      );
    }

    const res = await rescheduleToEmptySlot(scheduleId, timeSlotId, roomId);
    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Jadwal berhasil dipindahkan ke slot kosong.'
      });
    } else {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
  } catch (err) {
    console.error('Error rescheduling to empty slot:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
