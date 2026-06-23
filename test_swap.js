import { getDbData, createSwapRequest, updateSwapRequest } from './src/utils/dbHelper.js';
import fs from 'fs';
import path from 'path';

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// Function to validate swap conflict before requesting (replicated from swap route logic)
function checkSwapConflicts(data, requesterId, requesterScheduleId, targetScheduleId) {
  const reqSchedule = data.schedules.find(s => s.id === requesterScheduleId);
  const tgtSchedule = data.schedules.find(s => s.id === targetScheduleId);

  if (!reqSchedule || !tgtSchedule) return { valid: false, error: 'Jadwal tidak ditemukan' };
  if (reqSchedule.lecturerId !== requesterId) return { valid: false, error: 'Bukan jadwal milik pengaju' };

  const targetId = tgtSchedule.lecturerId;
  const reqSlot = data.timeSlots.find(t => t.id === reqSchedule.timeSlotId);
  const tgtSlot = data.timeSlots.find(t => t.id === tgtSchedule.timeSlotId);

  if (!reqSlot || !tgtSlot) return { valid: false, error: 'Slot waktu tidak ditemukan' };

  // Check requester's other schedules won't conflict with tgtSlot
  const requesterOtherSchedules = data.schedules.filter(s => s.lecturerId === requesterId && s.id !== requesterScheduleId);
  for (const s of requesterOtherSchedules) {
    const sSlot = data.timeSlots.find(t => t.id === s.timeSlotId);
    if (sSlot && sSlot.day === tgtSlot.day && sSlot.startTime === tgtSlot.startTime) {
      return { valid: false, error: `Pengaju bentrok di ${tgtSlot.day}` };
    }
  }

  // Check target's other schedules won't conflict with reqSlot
  const targetOtherSchedules = data.schedules.filter(s => s.lecturerId === targetId && s.id !== targetScheduleId);
  for (const s of targetOtherSchedules) {
    const sSlot = data.timeSlots.find(t => t.id === s.timeSlotId);
    if (sSlot && sSlot.day === reqSlot.day && sSlot.startTime === reqSlot.startTime) {
      return { valid: false, error: `Dosen tujuan bentrok di ${reqSlot.day}` };
    }
  }

  return { valid: true };
}

async function runSwapTests() {
  console.log('Running Swap Request logic tests...');

  // Setup test environment - mock data state
  const data = await getDbData();
  
  // Make sure we have at least 2 schedules to swap
  // Let's add two temp schedules to the mockDb if they don't exist, or just use existing ones if generated
  // Since we cleared schedules in mockDb.json, let's create a couple of test schedules.
  const baseSchedules = [
    {
      id: 'sch-test-1',
      classId: 'c1',
      courseId: 'co1',
      lecturerId: 'l1',
      roomId: 'r1',
      timeSlotId: 't1', // Senin 07:30
      academicYear: '2025/2026-Ganjil',
      status: 'PUBLISHED'
    },
    {
      id: 'sch-test-2',
      classId: 'c2',
      courseId: 'co2',
      lecturerId: 'l2',
      roomId: 'r2',
      timeSlotId: 't2', // Senin 09:20
      academicYear: '2025/2026-Ganjil',
      status: 'PUBLISHED'
    }
  ];

  // Helper to directly inject/save these test schedules
  const mockDbPath = path.join(process.cwd(), 'src/utils/mockDb.json');
  const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
  
  // Save original schedules
  const originalSchedules = [...db.schedules];
  const originalSwapRequests = [...(db.swapRequests || [])];
  
  db.schedules = baseSchedules;
  db.swapRequests = [];
  fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');

  try {
    const freshData = await getDbData();

    // Test 1: Validation - Successful Swap Check (no conflicts)
    console.log('Testing swap check (valid swap)...');
    const check1 = checkSwapConflicts(freshData, 'l1', 'sch-test-1', 'sch-test-2');
    assert(check1.valid === true, `Expected swap to be valid, but got: ${check1.error}`);
    console.log('✅ Valid swap check passed.');

    // Test 2: Validation - Conflict Check (Requester has another course at target slot)
    console.log('Testing swap check (requester conflict)...');
    const conflictedData = {
      ...freshData,
      schedules: [
        ...freshData.schedules,
        {
          id: 'sch-test-3',
          classId: 'c1',
          courseId: 'co3',
          lecturerId: 'l1',
          roomId: 'r1',
          timeSlotId: 't2', // Same slot as sch-test-2
          academicYear: '2025/2026-Ganjil',
          status: 'PUBLISHED'
        }
      ]
    };
    const check2 = checkSwapConflicts(conflictedData, 'l1', 'sch-test-1', 'sch-test-2');
    assert(check2.valid === false, 'Expected swap validation to fail due to requester conflict');
    assert(check2.error.includes('Pengaju bentrok'), 'Expected error description for requester conflict');
    console.log('✅ Requester conflict swap check passed.');

    // Test 3: Validation - Owner Check (Requester tries to swap schedule they do not own)
    console.log('Testing swap check (ownership validation)...');
    const check3 = checkSwapConflicts(freshData, 'l3', 'sch-test-1', 'sch-test-2');
    assert(check3.valid === false, 'Expected swap validation to fail since requester does not own schedule');
    assert(check3.error.includes('Bukan jadwal milik pengaju'), 'Expected ownership error message');
    console.log('✅ Ownership validation check passed.');

    // Test 4: Execution - Creating Swap Request
    console.log('Testing createSwapRequest...');
    const createRes = await createSwapRequest({
      requesterId: 'l1',
      requesterScheduleId: 'sch-test-1',
      targetId: 'l2',
      targetScheduleId: 'sch-test-2',
      reason: 'Sakit / Perlu Izin'
    });
    assert(createRes.success === true, 'Failed to create swap request');
    
    const dbAfterRequest = await getDbData();
    const swapReq = dbAfterRequest.swapRequests.find(s => s.requesterScheduleId === 'sch-test-1');
    assert(swapReq !== undefined, 'Swap request not found in database');
    assert(swapReq.status === 'PENDING', 'Swap request status should be PENDING initially');
    console.log('✅ createSwapRequest passed.');

    // Test 5: Execution - Reject Swap Request
    console.log('Testing reject swap request...');
    const rejectRes = await updateSwapRequest(swapReq.id, 'REJECTED', 'Ditolak karena tidak sesuai regulasi');
    assert(rejectRes.success === true, 'Failed to reject swap request');

    const dbAfterReject = await getDbData();
    const rejectedReq = dbAfterReject.swapRequests.find(s => s.id === swapReq.id);
    assert(rejectedReq.status === 'REJECTED', 'Swap request status should be REJECTED');
    
    // Schedules should remain unchanged
    const sch1AfterReject = dbAfterReject.schedules.find(s => s.id === 'sch-test-1');
    const sch2AfterReject = dbAfterReject.schedules.find(s => s.id === 'sch-test-2');
    assert(sch1AfterReject.timeSlotId === 't1', 'Schedule 1 slot should not change on rejection');
    assert(sch2AfterReject.timeSlotId === 't2', 'Schedule 2 slot should not change on rejection');
    console.log('✅ Reject swap request passed.');

    // Test 6: Execution - Approve Swap Request (Must swap slot & room details)
    console.log('Testing approve swap request...');
    // Create another request
    const createRes2 = await createSwapRequest({
      requesterId: 'l1',
      requesterScheduleId: 'sch-test-1',
      targetId: 'l2',
      targetScheduleId: 'sch-test-2',
      reason: 'Kebutuhan Mendesak'
    });
    const dbAfterRequest2 = await getDbData();
    const pendingSwap2 = dbAfterRequest2.swapRequests.find(s => s.status === 'PENDING');
    
    const approveRes = await updateSwapRequest(pendingSwap2.id, 'APPROVED', 'Disetujui');
    assert(approveRes.success === true, 'Failed to approve swap request');

    const dbAfterApprove = await getDbData();
    const sch1AfterApprove = dbAfterApprove.schedules.find(s => s.id === 'sch-test-1');
    const sch2AfterApprove = dbAfterApprove.schedules.find(s => s.id === 'sch-test-2');

    // Temporary Slot IDs must be swapped
    assert(sch1AfterApprove.tempTimeSlotId === 't2', 'Schedule 1 tempTimeSlotId should have changed to t2');
    assert(sch2AfterApprove.tempTimeSlotId === 't1', 'Schedule 2 tempTimeSlotId should have changed to t1');
    
    // Temporary Rooms must also be swapped
    assert(sch1AfterApprove.tempRoomId === 'r2', 'Schedule 1 tempRoomId should have changed to r2');
    assert(sch2AfterApprove.tempRoomId === 'r1', 'Schedule 2 tempRoomId should have changed to r1');
    console.log('✅ Approve swap request (with execution) passed.');

  } finally {
    // Restore original schedules
    const currentDb = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    currentDb.schedules = originalSchedules;
    currentDb.swapRequests = originalSwapRequests;
    fs.writeFileSync(mockDbPath, JSON.stringify(currentDb, null, 2), 'utf8');
  }

  console.log('\n🎉 ALL SWAP AND CONFLICT VALIDATION TESTS PASSED SUCCESSFULLY!');
}

runSwapTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
