import { generateSchedule } from './src/utils/scheduler.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// Mock Data Builders
const baseCourses = [
  { id: 'co1', code: 'SI-101', name: 'Pengantar SI', credits: 2, type: 'THEORY', needsLab: false },
  { id: 'co2', code: 'SI-102P', name: 'Praktikum Web', credits: 2, type: 'PRACTICAL', needsLab: true }
];

const baseClasses = [
  { id: 'c1', name: 'SI-1A', semester: 1, capacity: 25 },
  { id: 'c2', name: 'SI-1B', semester: 1, capacity: 30 } // larger class
];

const baseLecturers = [
  { id: 'l1', name: 'Dosen A', status: true },
  { id: 'l2', name: 'Dosen B', status: true }
];

const baseRooms = [
  { id: 'r1', code: '101', floor: 1, capacity: 25, type: 'REGULAR' },
  { id: 'r2', code: 'Lab 1', floor: 2, capacity: 30, type: 'LAB' }
];

const baseTimeSlots = [
  { id: 't1', day: 'Senin', startTime: '07:30', endTime: '09:10' }, // 100 minutes (enough for 2 SKS = 80 mins)
  { id: 't2', day: 'Senin', startTime: '09:20', endTime: '11:00' }
];

const baseStudents = [
  { id: 's1', name: 'Asdos Senior', nim: '609001', classId: 'c1', semester: 5 }, // Senior student in class c1
  { id: 's2', name: 'Asdos Junior', nim: '609002', classId: 'c2', semester: 3 }
];

function testBasicScheduling() {
  console.log('Running testBasicScheduling...');
  const offerings = [
    { classId: 'c1', courseId: 'co1', lecturerId: 'l1', assistantId: null, academicYear: '2025' }
  ];

  const result = generateSchedule({
    offerings,
    courses: baseCourses,
    classes: baseClasses,
    lecturers: baseLecturers,
    rooms: baseRooms,
    timeSlots: baseTimeSlots,
    lecturerPreferences: [],
    students: baseStudents
  });

  assert(result.scheduled.length === 1, 'Should schedule 1 offering');
  assert(result.unscheduled.length === 0, 'Should have 0 unscheduled');
  assert(result.conflicts.length === 0, 'Should have 0 conflicts');
  console.log('✅ testBasicScheduling passed.');
}

function testLecturerConflict() {
  console.log('Running testLecturerConflict...');
  // Same lecturer assigned to two different classes. With only 1 timeslot available, one must fail.
  const offerings = [
    { classId: 'c1', courseId: 'co1', lecturerId: 'l1', assistantId: null, academicYear: '2025' },
    { classId: 'c2', courseId: 'co1', lecturerId: 'l1', assistantId: null, academicYear: '2025' }
  ];

  const singleTimeSlot = [baseTimeSlots[0]]; // Only 1 timeslot

  const result = generateSchedule({
    offerings,
    courses: baseCourses,
    classes: baseClasses,
    lecturers: baseLecturers,
    rooms: baseRooms,
    timeSlots: singleTimeSlot,
    lecturerPreferences: [],
    students: baseStudents
  });

  assert(result.scheduled.length === 1, 'Should schedule only 1 offering due to lecturer clash');
  assert(result.unscheduled.length === 1, 'Should have 1 unscheduled offering');
  assert(result.conflicts.length === 1, 'Should report 1 conflict');
  assert(result.conflicts[0].description.includes('Bentrok'), 'Conflict description should mention clash');
  console.log('✅ testLecturerConflict passed.');
}

function testRoomCapacityConflict() {
  console.log('Running testRoomCapacityConflict...');
  // Class capacity (c2 = 30) exceeds Regular room capacity (r1 = 25)
  // Lab room (r2 = 30) is LAB, but course is THEORY, so it should not ideally schedule there, or if only r1 is available it fails
  const offerings = [
    { classId: 'c2', courseId: 'co1', lecturerId: 'l1', assistantId: null, academicYear: '2025' }
  ];

  const onlySmallRoom = [baseRooms[0]]; // Only r1 (capacity 25)

  const result = generateSchedule({
    offerings,
    courses: baseCourses,
    classes: baseClasses,
    lecturers: baseLecturers,
    rooms: onlySmallRoom,
    timeSlots: baseTimeSlots,
    lecturerPreferences: [],
    students: baseStudents
  });

  assert(result.scheduled.length === 0, 'Should not schedule since room capacity is too small');
  assert(result.unscheduled.length === 1, 'Should have 1 unscheduled');
  console.log('✅ testRoomCapacityConflict passed.');
}

function testRoomTypeMatch() {
  console.log('Running testRoomTypeMatch...');
  // Practical course co2 needs Lab.
  // We have r1 (REGULAR) and r2 (LAB).
  // If we only have r1 (REGULAR), it should fail.
  const offerings = [
    { classId: 'c1', courseId: 'co2', lecturerId: 'l1', assistantId: null, academicYear: '2025' }
  ];

  const onlyRegularRoom = [baseRooms[0]]; // Only r1 (REGULAR)

  const result = generateSchedule({
    offerings,
    courses: baseCourses,
    classes: baseClasses,
    lecturers: baseLecturers,
    rooms: onlyRegularRoom,
    timeSlots: baseTimeSlots,
    lecturerPreferences: [],
    students: baseStudents
  });

  assert(result.scheduled.length === 0, 'Practical class should not be scheduled in regular room');
  assert(result.unscheduled.length === 1, 'Should have 1 unscheduled');
  console.log('✅ testRoomTypeMatch passed.');
}

function testAssistantLecturerStudyingConflict() {
  console.log('Running testAssistantLecturerStudyingConflict...');
  // Student s1 is in class c1.
  // We have:
  // 1. A schedule for class c1 at time t1 (e.g. s1 is attending class)
  // 2. An offering where s1 is assigned as assistant for class c2 at time t1
  // The assistant should not be scheduled at t1 because they are attending their own class c1.
  
  const offerings = [
    // 1. Regular class for c1 (student s1's class)
    { classId: 'c1', courseId: 'co1', lecturerId: 'l1', assistantId: null, academicYear: '2025' },
    // 2. Practical class for c2, where s1 is assistant
    { classId: 'c2', courseId: 'co2', lecturerId: 'l2', assistantId: 's1', academicYear: '2025' }
  ];

  const result = generateSchedule({
    offerings,
    courses: baseCourses,
    classes: baseClasses,
    lecturers: baseLecturers,
    rooms: baseRooms,
    timeSlots: [baseTimeSlots[0]], // Only slot t1
    lecturerPreferences: [],
    students: baseStudents
  });

  // Since c1 takes slot t1, s1 (student of c1) is busy.
  // Therefore, the second offering (c2 with assistant s1) cannot be scheduled at t1.
  // Because only t1 is available, the second offering must fail.
  assert(result.scheduled.length === 1, 'Should only schedule 1 class');
  assert(result.unscheduled.length === 1, 'Should leave c2 unscheduled');
  assert(result.conflicts.length === 1, 'Should have 1 conflict report');
  assert(result.conflicts[0].description.includes('jadwal kuliah'), 'Conflict description should explain that assistant is attending class');
  console.log('✅ testAssistantLecturerStudyingConflict passed.');
}

// Run all tests
try {
  testBasicScheduling();
  testLecturerConflict();
  testRoomCapacityConflict();
  testRoomTypeMatch();
  testAssistantLecturerStudyingConflict();
  console.log('\n🎉 ALL SCHEDULER TESTS PASSED SUCCESSFULLY! (TDD Verified)');
} catch (err) {
  console.error('\n❌ TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
}
