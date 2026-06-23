import { getDbData, saveStudentEnrollments, rescheduleToEmptySlot, getAvailableTimeSlotsForSchedule } from './src/utils/dbHelper.js';
import { generateSchedule } from './src/utils/scheduler.js';
import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runNewFeatureTests() {
  console.log('Running New Features (KRS Pre-generation & Lecturer Rescheduling) Tests...');

  const mockDbPath = path.join(process.cwd(), 'src/utils/mockDb.json');
  const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));

  // Backup original db state
  const originalSchedules = [...db.schedules];
  const originalEnrollments = [...(db.courseEnrollments || [])];

  try {
    // ----------------------------------------------------
    // TEST 1: KRS Pre-generation filtering in scheduler
    // ----------------------------------------------------
    console.log('Testing KRS Pre-generation schedule filtering...');
    
    // Clear schedules and set up specific course enrollments
    // Ahmad Dani (s1, class c1) only enrolls in co1 (Pengantar Sistem Informasi)
    // There are other active courses for semester 1 (co2, co3), but student didn't choose them.
    db.schedules = [];
    db.courseEnrollments = [
      {
        id: 'env-test-1',
        studentId: 's1',
        courseId: 'co1',
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');

    // Trigger schedule generation via API-like data preparation
    const data = await getDbData();
    const { classes, courses, lecturers, rooms, timeSlots, lecturerPreferences, students, courseLecturers, semesters, courseEnrollments } = data;

    // Simulate API generate matchingCourses filtering:
    const cls = classes.find(c => c.id === 'c1');
    const classStudents = students.filter(s => s.classId === cls.id);
    const classStudentIds = classStudents.map(s => s.id);
    const enrolledCourseIds = (courseEnrollments || [])
      .filter(e => classStudentIds.includes(e.studentId))
      .map(e => e.courseId);
    
    const uniqueEnrolledIds = Array.from(new Set(enrolledCourseIds));

    let matchingCourses = courses.filter(c => {
      if (!c.isActive) return false;
      if (c.semester === cls.semester) return true;
      return false;
    });

    if (uniqueEnrolledIds.length > 0) {
      matchingCourses = matchingCourses.filter(c => uniqueEnrolledIds.includes(c.id));
    }

    // Verify only co1 is scheduled, not co2 or co3!
    assert(matchingCourses.length === 1, 'Expected only 1 matching course due to KRS enrollment');
    assert(matchingCourses[0].id === 'co1', 'Expected matching course to be co1');
    console.log('✅ KRS Pre-generation schedule filtering passed.');

    // ----------------------------------------------------
    // TEST 2: Empty Slots Lookup for Lecturer Rescheduling
    // ----------------------------------------------------
    console.log('Testing lookup of empty slots for lecturer...');
    
    // Set up a single schedule
    db.schedules = [
      {
        id: 'sch-res-1',
        classId: 'c1',
        courseId: 'co1',
        lecturerId: 'l1',
        roomId: 'r1',
        timeSlotId: 't1',
        academicYear: '2025/2026-Ganjil',
        status: 'PUBLISHED'
      }
    ];
    fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');

    const lookupRes = await getAvailableTimeSlotsForSchedule('sch-res-1');
    assert(lookupRes.success === true, 'Failed to fetch empty slots');
    assert(Array.isArray(lookupRes.slots), 'Slots should be an array');
    assert(lookupRes.slots.length > 0, 'Should find at least one empty slot');

    // The current slot t1 should not be in the empty slots options (since it's their own slot, or check if it filters out)
    const hasCurrentSlot = lookupRes.slots.some(s => s.timeSlotId === 't1');
    assert(!hasCurrentSlot, 'Available empty slots should not contain the current slot');
    console.log('✅ Empty slot lookup passed.');

    // ----------------------------------------------------
    // TEST 3: Reschedule to Empty Slot execution
    // ----------------------------------------------------
    console.log('Testing reschedule execution to empty slot...');
    
    const targetSlot = lookupRes.slots[0];
    const execRes = await rescheduleToEmptySlot('sch-res-1', targetSlot.timeSlotId, targetSlot.roomId);
    assert(execRes.success === true, 'Reschedule execution failed');

    const dbAfterResched = await getDbData();
    const updatedSch = dbAfterResched.schedules.find(s => s.id === 'sch-res-1');
    assert(updatedSch.tempTimeSlotId === targetSlot.timeSlotId, 'Temporary time slot ID was not updated');
    assert(updatedSch.tempRoomId === targetSlot.roomId, 'Temporary room ID was not updated');
    console.log('✅ Reschedule execution passed.');

    // ----------------------------------------------------
    // TEST 4: Auto-fill KRS on Generation Simulation
    // ----------------------------------------------------
    console.log('Testing auto-fill KRS on schedule generation...');
    
    // Set student s1 (Ahmad Dani) to have 0 enrollments
    db.courseEnrollments = [];
    fs.writeFileSync(mockDbPath, JSON.stringify(db, null, 2), 'utf8');

    // Run the exact auto-fill logic block
    const preGenerateData = await getDbData();
    let testDbUpdated = false;
    for (const student of preGenerateData.students) {
      const hasEnrolled = (preGenerateData.courseEnrollments || []).some(e => e.studentId === student.id);
      if (!hasEnrolled) {
        const recommendedCourses = preGenerateData.courses.filter(c => c.isActive && c.semester === student.semester);
        let totalSks = 0;
        const coursesToEnroll = [];
        for (const course of recommendedCourses) {
          if (totalSks + course.credits <= student.maxSks) {
            coursesToEnroll.push(course.id);
            totalSks += course.credits;
          }
        }
        if (coursesToEnroll.length > 0) {
          await saveStudentEnrollments(student.id, coursesToEnroll);
          testDbUpdated = true;
        }
      }
    }

    assert(testDbUpdated === true, 'Expected testDbUpdated to be true since students had empty enrollments');
    const dataAfterAutoFill = await getDbData();
    const s1Enrollments = dataAfterAutoFill.courseEnrollments.filter(e => e.studentId === 's1');
    assert(s1Enrollments.length > 0, 'Expected s1 to be auto-enrolled in recommended courses');
    console.log('✅ Auto-fill KRS on generation passed.');

  } finally {
    // Restore original state
    const currentDb = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    currentDb.schedules = originalSchedules;
    currentDb.courseEnrollments = originalEnrollments;
    fs.writeFileSync(mockDbPath, JSON.stringify(currentDb, null, 2), 'utf8');
  }

  console.log('\n🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!');
}

runNewFeatureTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
