import { NextResponse } from 'next/server';
import { getDbData, createSwapRequest, updateSwapRequest } from '@/utils/dbHelper';

/**
 * POST: Create a swap request (from Dosen)
 * Body: { requesterId, requesterScheduleId, targetScheduleId, reason }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { requesterId, requesterScheduleId, targetScheduleId, reason } = body;

    if (!requesterId || !requesterScheduleId || !targetScheduleId || !reason) {
      return NextResponse.json(
        { error: 'Semua field (requesterId, requesterScheduleId, targetScheduleId, reason) diperlukan.' },
        { status: 400 }
      );
    }

    // Get full data to validate
    const data = await getDbData();

    // Validate schedules exist
    const reqSchedule = data.schedules.find(s => s.id === requesterScheduleId);
    const tgtSchedule = data.schedules.find(s => s.id === targetScheduleId);

    if (!reqSchedule) {
      return NextResponse.json({ error: 'Jadwal pengaju tidak ditemukan.' }, { status: 404 });
    }
    if (!tgtSchedule) {
      return NextResponse.json({ error: 'Jadwal tujuan tukar tidak ditemukan.' }, { status: 404 });
    }

    // Verify the requester owns their schedule
    if (reqSchedule.lecturerId !== requesterId) {
      return NextResponse.json({ error: 'Anda hanya bisa mengajukan tukar untuk jadwal mengajar Anda sendiri.' }, { status: 403 });
    }

    const targetId = tgtSchedule.lecturerId;

    // Check that the swap won't create conflicts
    // After swap: requester gets tgtSchedule's slot, target gets reqSchedule's slot
    const reqSlot = data.timeSlots.find(t => t.id === (reqSchedule.tempTimeSlotId || reqSchedule.timeSlotId));
    const tgtSlot = data.timeSlots.find(t => t.id === (tgtSchedule.tempTimeSlotId || tgtSchedule.timeSlotId));

    if (!reqSlot || !tgtSlot) {
      return NextResponse.json({ error: 'Slot waktu tidak ditemukan.' }, { status: 400 });
    }

    // Check requester's other schedules won't conflict with tgtSlot
    const requesterOtherSchedules = data.schedules.filter(s => s.lecturerId === requesterId && s.id !== requesterScheduleId);
    for (const s of requesterOtherSchedules) {
      const sSlot = data.timeSlots.find(t => t.id === (s.tempTimeSlotId || s.timeSlotId));
      if (sSlot && sSlot.day === tgtSlot.day && sSlot.startTime === tgtSlot.startTime) {
        return NextResponse.json({
          error: `Tukar jadwal gagal: Anda sudah memiliki jadwal di ${tgtSlot.day} ${tgtSlot.startTime}-${tgtSlot.endTime}.`
        }, { status: 400 });
      }
    }

    // Check target's other schedules won't conflict with reqSlot
    const targetOtherSchedules = data.schedules.filter(s => s.lecturerId === targetId && s.id !== targetScheduleId);
    for (const s of targetOtherSchedules) {
      const sSlot = data.timeSlots.find(t => t.id === (s.tempTimeSlotId || s.timeSlotId));
      if (sSlot && sSlot.day === reqSlot.day && sSlot.startTime === reqSlot.startTime) {
        return NextResponse.json({
          error: `Tukar jadwal gagal: Dosen tujuan sudah memiliki jadwal di ${reqSlot.day} ${reqSlot.startTime}-${reqSlot.endTime}.`
        }, { status: 400 });
      }
    }

    const result = await createSwapRequest({
      requesterId,
      requesterScheduleId,
      targetId,
      targetScheduleId,
      reason
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error creating swap request:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat permintaan tukar.' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Approve or reject a swap request (Admin only)
 * Body: { swapId, status: 'APPROVED'|'REJECTED', adminNote }
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { swapId, status, adminNote } = body;

    if (!swapId || !status) {
      return NextResponse.json(
        { error: 'Parameter swapId dan status diperlukan.' },
        { status: 400 }
      );
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Status harus APPROVED atau REJECTED.' },
        { status: 400 }
      );
    }

    const result = await updateSwapRequest(swapId, status, adminNote || '');
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error updating swap request:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memperbarui permintaan tukar.' },
      { status: 500 }
    );
  }
}
