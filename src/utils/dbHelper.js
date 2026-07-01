import fs from 'fs';
import path from 'path';

let prisma;
let usePrisma = false;

async function initPrisma() {
  if (prisma) return;
  if (!process.env.DATABASE_URL) return;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    usePrisma = true;
  } catch (e) {
    usePrisma = false;
  }
}

const mockDbPath = path.join(process.cwd(), 'src/utils/mockDb.json');

// Read mock DB helper
function readMockDb() {
  try {
    const data = fs.readFileSync(mockDbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading mock DB:', err);
    return {};
  }
}

// Write mock DB helper
function writeMockDb(data) {
  try {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing mock DB:', err);
  }
}

/**
 * Gets all academic scheduling data
 */
export async function getDbData() {
  await initPrisma();
  if (usePrisma) {
    try {
      // Test database connection
      const users = await prisma.user.findMany();
      const lecturers = await prisma.lecturer.findMany();
      const students = await prisma.student.findMany();
      const courses = await prisma.course.findMany();
      const classes = await prisma.class.findMany();
      const rooms = await prisma.room.findMany();
      const timeSlots = await prisma.timeSlot.findMany();
      const lecturerPreferences = await prisma.lecturerPreference.findMany();
      const courseEnrollments = await prisma.courseEnrollment.findMany();
      const semesters = await prisma.semester.findMany();
      const courseLecturers = await prisma.courseLecturer.findMany({
        include: { course: true, lecturer: true }
      });
      const swapRequests = await prisma.swapRequest.findMany({
        include: {
          requester: true,
          requesterSchedule: { include: { course: true, class: true, timeSlot: true, room: true } },
          target: true,
          targetSchedule: { include: { course: true, class: true, timeSlot: true, room: true } }
        }
      });
      
      const schedulesRaw = await prisma.schedule.findMany({
        include: {
          class: true,
          course: true,
          lecturer: true,
          assistant: true,
          room: true,
          timeSlot: true
        }
      });

      const roomMap = new Map(rooms.map(r => [r.id, r]));
      const slotMap = new Map(timeSlots.map(t => [t.id, t]));

      // Format schedules like the mock DB
      const schedules = schedulesRaw.map(s => ({
        id: s.id,
        classId: s.classId,
        courseId: s.courseId,
        lecturerId: s.lecturerId,
        assistantId: s.assistantId,
        roomId: s.roomId,
        timeSlotId: s.timeSlotId,
        tempRoomId: s.tempRoomId,
        tempTimeSlotId: s.tempTimeSlotId,
        academicYear: s.academicYear,
        status: s.status,
        class: s.class,
        course: s.course,
        lecturer: s.lecturer,
        assistant: s.assistant,
        room: s.room,
        timeSlot: s.timeSlot,
        tempRoom: s.tempRoomId ? roomMap.get(s.tempRoomId) : null,
        tempTimeSlot: s.tempTimeSlotId ? slotMap.get(s.tempTimeSlotId) : null
      }));

      const conflicts = await prisma.scheduleConflict.findMany();
      const revisions = await prisma.revision.findMany();

      return {
        users,
        lecturers,
        students,
        courses,
        classes,
        rooms,
        timeSlots,
        lecturerPreferences,
        courseEnrollments,
        semesters,
        courseLecturers,
        swapRequests,
        schedules,
        conflicts,
        revisions,
        isMock: false
      };
    } catch (err) {
      console.warn('Prisma query failed, falling back to Mock DB:', err.message);
    }
  }

  // Fallback to Mock DB
  const db = readMockDb();
  
  // Attach relational data to schedules in mock mode
  const courseMap = new Map(db.courses.map(c => [c.id, c]));
  const classMap = new Map(db.classes.map(c => [c.id, c]));
  const lecturerMap = new Map(db.lecturers.map(l => [l.id, l]));
  const studentMap = new Map(db.students.map(s => [s.id, s]));
  const roomMap = new Map(db.rooms.map(r => [r.id, r]));
  const slotMap = new Map(db.timeSlots.map(t => [t.id, t]));

  const enrichedSchedules = db.schedules.map(s => ({
    ...s,
    course: courseMap.get(s.courseId),
    class: classMap.get(s.classId),
    lecturer: lecturerMap.get(s.lecturerId),
    assistant: s.assistantId ? studentMap.get(s.assistantId) : null,
    room: roomMap.get(s.roomId),
    timeSlot: slotMap.get(s.timeSlotId),
    tempRoom: s.tempRoomId ? roomMap.get(s.tempRoomId) : null,
    tempTimeSlot: s.tempTimeSlotId ? slotMap.get(s.tempTimeSlotId) : null
  }));

  // Enrich courseLecturers with relations
  const enrichedCourseLecturers = (db.courseLecturers || []).map(cl => ({
    ...cl,
    course: courseMap.get(cl.courseId),
    lecturer: lecturerMap.get(cl.lecturerId)
  }));

  // Enrich swap requests with relations
  const scheduleMap = new Map(enrichedSchedules.map(s => [s.id, s]));
  const enrichedSwapRequests = (db.swapRequests || []).map(sr => ({
    ...sr,
    requester: lecturerMap.get(sr.requesterId),
    requesterSchedule: scheduleMap.get(sr.requesterScheduleId),
    target: lecturerMap.get(sr.targetId),
    targetSchedule: scheduleMap.get(sr.targetScheduleId)
  }));

  return {
    ...db,
    schedules: enrichedSchedules,
    courseLecturers: enrichedCourseLecturers,
    swapRequests: enrichedSwapRequests,
    semesters: db.semesters || [],
    courseEnrollments: db.courseEnrollments || [],
    isMock: true
  };
}

/**
 * Saves a list of generated schedules
 */
export async function saveSchedules(newSchedules, conflicts = []) {
  await initPrisma();
  if (usePrisma) {
    try {
      // Clear ALL existing schedules and related tables to start completely fresh
      await prisma.swapRequest.deleteMany({});
      await prisma.revision.deleteMany({});
      await prisma.scheduleConflict.deleteMany({});
      await prisma.schedule.deleteMany({});

      // Save new schedules
      for (const s of newSchedules) {
        await prisma.schedule.create({
          data: {
            classId: s.classId,
            courseId: s.courseId,
            lecturerId: s.lecturerId,
            assistantId: s.assistantId || null,
            roomId: s.roomId,
            timeSlotId: s.timeSlotId,
            tempRoomId: null,
            tempTimeSlotId: null,
            academicYear: s.academicYear,
            status: s.status || 'DRAFT'
          }
        });
      }

      // Save conflicts
      for (const c of conflicts) {
        // Find matching schedule id
        const sch = await prisma.schedule.findFirst({
          where: {
            classId: c.classId,
            courseId: c.courseId,
            lecturerId: c.lecturerId
          }
        });

        if (sch) {
          await prisma.scheduleConflict.create({
            data: {
              scheduleId: sch.id,
              conflictType: c.conflictType,
              description: c.description,
              status: 'UNRESOLVED'
            }
          });
        }
      }
      return { success: true };
    } catch (err) {
      console.warn('Prisma save schedules failed, using Mock DB:', err.message);
    }
  }

  // Fallback to Mock DB
  const db = readMockDb();
  // Clear ALL existing schedules and related data
  db.schedules = [];
  db.swapRequests = [];
  db.conflicts = [];
  db.revisions = [];
  
  // Format schedules without relations for file storage
  const cleanSchedules = newSchedules.map(s => ({
    id: s.id || Math.random().toString(36).substring(2, 9),
    classId: s.classId,
    courseId: s.courseId,
    lecturerId: s.lecturerId,
    assistantId: s.assistantId || null,
    roomId: s.roomId,
    timeSlotId: s.timeSlotId,
    tempRoomId: null,
    tempTimeSlotId: null,
    academicYear: s.academicYear,
    status: s.status || 'DRAFT'
  }));

  db.schedules = cleanSchedules;
  
  // Add conflicts
  db.conflicts = conflicts.map((c, i) => ({
    id: `conf-${i}`,
    scheduleId: `temp-${i}`,
    conflictType: c.conflictType,
    description: c.description,
    status: 'UNRESOLVED'
  }));

  writeMockDb(db);
  return { success: true };
}

/**
 * Updates a schedule (for manual revision)
 */
export async function updateSchedule(scheduleId, updateData, revisedBy, reason) {
  await initPrisma();
  if (usePrisma) {
    try {
      const oldSchedule = await prisma.schedule.findUnique({
        where: { id: scheduleId }
      });

      if (oldSchedule) {
        const updated = await prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            roomId: updateData.roomId,
            timeSlotId: updateData.timeSlotId,
            lecturerId: updateData.lecturerId,
            assistantId: updateData.assistantId || null
          }
        });

        // Add revision record
        await prisma.revision.create({
          data: {
            scheduleId,
            revisedBy,
            reason,
            oldData: { roomId: oldSchedule.roomId, timeSlotId: oldSchedule.timeSlotId },
            newData: { roomId: updateData.roomId, timeSlotId: updateData.timeSlotId }
          }
        });

        return { success: true, updated };
      }
    } catch (err) {
      console.warn('Prisma update schedule failed, using Mock DB:', err.message);
    }
  }

  // Fallback to Mock DB
  const db = readMockDb();
  const index = db.schedules.findIndex(s => s.id === scheduleId);
  if (index !== -1) {
    const old = db.schedules[index];
    const updated = {
      ...old,
      roomId: updateData.roomId,
      timeSlotId: updateData.timeSlotId,
      lecturerId: updateData.lecturerId,
      assistantId: updateData.assistantId || null
    };

    db.schedules[index] = updated;

    db.revisions.push({
      id: `rev-${Math.random().toString(36).substring(2, 9)}`,
      scheduleId,
      revisedBy,
      reason,
      oldData: { roomId: old.roomId, timeSlotId: old.timeSlotId },
      newData: { roomId: updateData.roomId, timeSlotId: updateData.timeSlotId },
      createdAt: new Date().toISOString()
    });

    writeMockDb(db);
    return { success: true, updated };
  }

  return { success: false, error: 'Schedule not found' };
}

/**
 * Publishes draft schedules
 */
export async function publishSchedules() {
  await initPrisma();
  if (usePrisma) {
    try {
      await prisma.schedule.updateMany({
        where: { status: 'DRAFT' },
        data: { status: 'PUBLISHED' }
      });
      return { success: true };
    } catch (err) {
      console.warn('Prisma publish schedules failed:', err.message);
    }
  }

  const db = readMockDb();
  db.schedules = db.schedules.map(s => ({
    ...s,
    status: 'PUBLISHED'
  }));
  writeMockDb(db);
  return { success: true };
}

/**
 * Adds or updates lecturer preference (day-based)
 */
export async function saveLecturerPreference(lecturerId, preferredDays) {
  await initPrisma();
  if (usePrisma) {
    try {
      // Clear old preferences first
      await prisma.lecturerPreference.deleteMany({
        where: { lecturerId }
      });

      // Insert new day preferences
      for (const day of preferredDays) {
        await prisma.lecturerPreference.create({
          data: {
            lecturerId,
            preferredDay: day
          }
        });
      }
      return { success: true };
    } catch (err) {
      console.warn('Prisma save preferences failed:', err.message);
    }
  }

  const db = readMockDb();
  // Filter out old preferences
  db.lecturerPreferences = db.lecturerPreferences.filter(p => p.lecturerId !== lecturerId);
  
  // Add new day preferences
  preferredDays.forEach((day, index) => {
    db.lecturerPreferences.push({
      id: `pref-${lecturerId}-${index}`,
      lecturerId,
      preferredDay: day,
      notes: ''
    });
  });

  writeMockDb(db);
  return { success: true };
}

/**
 * Helper CRUD additions for Admin Management
 */
export async function addMasterRecord(table, record) {
  await initPrisma();
  if (usePrisma) {
    try {
      let created;
      if (table === 'lecturers') {
        // First create User
        const user = await prisma.user.create({
          data: {
            name: record.name,
            email: record.email,
            password: '$2a$10$hashedPasswordPlaceholder', // Default pass
            role: 'LECTURER'
          }
        });
        created = await prisma.lecturer.create({
          data: {
            userId: user.id,
            nidn: record.nidn,
            name: record.name,
            email: record.email,
            phone: record.phone,
            status: true
          }
        });
      } else if (table === 'students') {
        created = await prisma.student.create({
          data: {
            nim: record.nim,
            name: record.name,
            classId: record.classId,
            semester: parseInt(record.semester)
          }
        });
      } else if (table === 'courses') {
        created = await prisma.course.create({
          data: {
            code: record.code,
            name: record.name,
            credits: parseInt(record.credits),
            type: record.type,
            needsLab: record.needsLab,
            semester: parseInt(record.semester || 1),
            isActive: record.isActive !== undefined ? !!record.isActive : true
          }
        });
      } else if (table === 'rooms') {
        created = await prisma.room.create({
          data: {
            code: record.code,
            floor: parseInt(record.floor),
            capacity: parseInt(record.capacity),
            type: record.type
          }
        });
      } else if (table === 'classes') {
        created = await prisma.class.create({
          data: {
            name: record.name,
            semester: parseInt(record.semester),
            capacity: parseInt(record.capacity)
          }
        });
      } else if (table === 'semesters') {
        if (record.isActive) {
          const activeSemester = await prisma.semester.findFirst({
            where: { isActive: true }
          });
          if (activeSemester) {
            return { success: false, error: 'Hanya boleh ada 1 semester yang aktif. Nonaktifkan semester lain terlebih dahulu.' };
          }
        }
        created = await prisma.semester.create({
          data: {
            year: record.year,
            type: record.type,
            isActive: !!record.isActive
          }
        });
      } else if (table === 'courseLecturers') {
        const course = await prisma.course.findUnique({
          where: { id: record.courseId }
        });
        if (!course || !course.isActive) {
          return { success: false, error: 'Mata kuliah tidak aktif atau tidak ditemukan, sehingga tidak bisa ditugaskan.' };
        }
        created = await prisma.courseLecturer.create({
          data: {
            courseId: record.courseId,
            lecturerId: record.lecturerId
          }
        });
      }
      return { success: true, created };
    } catch (err) {
      console.warn('Prisma add master record failed:', err.message);
    }
  }

  const db = readMockDb();

  if (table === 'semesters') {
    if (record.isActive) {
      const activeSemester = db.semesters?.find(s => s.isActive);
      if (activeSemester) {
        return { success: false, error: 'Hanya boleh ada 1 semester yang aktif. Nonaktifkan semester lain terlebih dahulu.' };
      }
    }
  }

  if (table === 'courseLecturers') {
    const course = db.courses?.find(c => c.id === record.courseId);
    if (!course || !course.isActive) {
      return { success: false, error: 'Mata kuliah tidak aktif atau tidak ditemukan, sehingga tidak bisa ditugaskan.' };
    }
  }

  const id = `${table.substring(0, 2)}-${Math.random().toString(36).substring(2, 9)}`;
  const newRecord = { id, ...record };
  
  if (table === 'lecturers') {
    // Add user as well
    const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
    db.users.push({
      id: userId,
      name: record.name,
      email: record.email,
      password: '$2a$10$hashedPasswordPlaceholder',
      role: 'LECTURER'
    });
    newRecord.userId = userId;
  }

  // Conversions for types
  if (newRecord.credits) newRecord.credits = parseInt(newRecord.credits);
  if (newRecord.semester) newRecord.semester = parseInt(newRecord.semester);
  if (newRecord.capacity) newRecord.capacity = parseInt(newRecord.capacity);
  if (newRecord.floor) newRecord.floor = parseInt(newRecord.floor);
  if (newRecord.needsLab !== undefined) newRecord.needsLab = !!newRecord.needsLab;
  if (newRecord.isActive !== undefined) newRecord.isActive = !!newRecord.isActive;

  // Initialize array if missing
  if (!db[table]) db[table] = [];
  db[table].push(newRecord);
  writeMockDb(db);
  return { success: true, created: newRecord };
}

/**
 * Saves course enrollments for a student
 */
export async function saveStudentEnrollments(studentId, courseIds) {
  await initPrisma();
  if (usePrisma) {
    try {
      // Clear old enrollments
      await prisma.courseEnrollment.deleteMany({
        where: { studentId }
      });
      // Add new enrollments
      for (const courseId of courseIds) {
        await prisma.courseEnrollment.create({
          data: { studentId, courseId }
        });
      }
      return { success: true };
    } catch (err) {
      console.warn('Prisma save enrollments failed:', err.message);
    }
  }

  const db = readMockDb();
  if (!db.courseEnrollments) db.courseEnrollments = [];
  // Clear old enrollments for this student
  db.courseEnrollments = db.courseEnrollments.filter(e => e.studentId !== studentId);
  // Add new
  courseIds.forEach(courseId => {
    db.courseEnrollments.push({
      id: `enr-${studentId}-${courseId}-${Math.random().toString(36).substring(2, 5)}`,
      studentId,
      courseId,
      createdAt: new Date().toISOString()
    });
  });
  writeMockDb(db);
  return { success: true };
}

/**
 * Updates student maxSks (Admin setting)
 */
export async function updateStudentMaxSks(studentId, maxSks) {
  await initPrisma();
  const parsedMaxSks = parseInt(maxSks);
  if (usePrisma) {
    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: { maxSks: parsedMaxSks }
      });
      return { success: true, updated };
    } catch (err) {
      console.warn('Prisma update maxSks failed:', err.message);
    }
  }

  const db = readMockDb();
  const student = db.students.find(s => s.id === studentId);
  if (student) {
    student.maxSks = parsedMaxSks;
    writeMockDb(db);
    return { success: true, student };
  }
  return { success: false, error: 'Student not found' };
}

/**
 * Updates course semester and status (Admin setting)
 */
export async function updateCourse(courseId, semester, isActive) {
  await initPrisma();
  const parsedSemester = parseInt(semester);
  const activeBool = !!isActive;
  if (usePrisma) {
    try {
      const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
          semester: parsedSemester,
          isActive: activeBool
        }
      });
      return { success: true, updated };
    } catch (err) {
      console.warn('Prisma update course failed:', err.message);
    }
  }

  const db = readMockDb();
  const course = db.courses.find(c => c.id === courseId);
  if (course) {
    course.semester = parsedSemester;
    course.isActive = activeBool;
    writeMockDb(db);
    return { success: true, course };
  }
  return { success: false, error: 'Course not found' };
}


/**
 * Creates a swap request between two lecturers
 */
export async function createSwapRequest({ requesterId, requesterScheduleId, targetId, targetScheduleId, reason }) {
  await initPrisma();
  if (usePrisma) {
    try {
      const created = await prisma.swapRequest.create({
        data: {
          requesterId,
          requesterScheduleId,
          targetId,
          targetScheduleId,
          reason,
          status: 'PENDING'
        }
      });
      return { success: true, created };
    } catch (err) {
      console.warn('Prisma create swap request failed:', err.message);
    }
  }

  const db = readMockDb();
  if (!db.swapRequests) db.swapRequests = [];
  const newReq = {
    id: `swap-${Math.random().toString(36).substring(2, 9)}`,
    requesterId,
    requesterScheduleId,
    targetId,
    targetScheduleId,
    reason,
    status: 'PENDING',
    adminNote: null,
    createdAt: new Date().toISOString()
  };
  db.swapRequests.push(newReq);
  writeMockDb(db);
  return { success: true, created: newReq };
}

/**
 * Updates swap request status (Admin approve/reject)
 */
export async function updateSwapRequest(swapId, status, adminNote) {
  await initPrisma();
  if (usePrisma) {
    try {
      const updated = await prisma.swapRequest.update({
        where: { id: swapId },
        data: { status, adminNote }
      });

      // If approved, execute the swap temporarily
      if (status === 'APPROVED') {
        const swap = await prisma.swapRequest.findUnique({
          where: { id: swapId },
          include: { requesterSchedule: true, targetSchedule: true }
        });
        if (swap) {
          const reqActiveSlot = swap.requesterSchedule.tempTimeSlotId || swap.requesterSchedule.timeSlotId;
          const reqActiveRoom = swap.requesterSchedule.tempRoomId || swap.requesterSchedule.roomId;
          const tgtActiveSlot = swap.targetSchedule.tempTimeSlotId || swap.targetSchedule.timeSlotId;
          const tgtActiveRoom = swap.targetSchedule.tempRoomId || swap.targetSchedule.roomId;

          await prisma.schedule.update({
            where: { id: swap.requesterScheduleId },
            data: {
              tempTimeSlotId: tgtActiveSlot,
              tempRoomId: tgtActiveRoom
            }
          });
          await prisma.schedule.update({
            where: { id: swap.targetScheduleId },
            data: {
              tempTimeSlotId: reqActiveSlot,
              tempRoomId: reqActiveRoom
            }
          });
        }
      }

      return { success: true, updated };
    } catch (err) {
      console.warn('Prisma update swap request failed:', err.message);
    }
  }

  const db = readMockDb();
  if (!db.swapRequests) db.swapRequests = [];
  const swapIndex = db.swapRequests.findIndex(s => s.id === swapId);
  if (swapIndex === -1) return { success: false, error: 'Swap request not found' };

  db.swapRequests[swapIndex].status = status;
  db.swapRequests[swapIndex].adminNote = adminNote || null;

  // If approved, execute the swap temporarily in mock DB
  if (status === 'APPROVED') {
    const swap = db.swapRequests[swapIndex];
    const reqScheduleIdx = db.schedules.findIndex(s => s.id === swap.requesterScheduleId);
    const tgtScheduleIdx = db.schedules.findIndex(s => s.id === swap.targetScheduleId);

    if (reqScheduleIdx !== -1 && tgtScheduleIdx !== -1) {
      const s1 = db.schedules[reqScheduleIdx];
      const s2 = db.schedules[tgtScheduleIdx];
      const reqActiveSlot = s1.tempTimeSlotId || s1.timeSlotId;
      const reqActiveRoom = s1.tempRoomId || s1.roomId;
      const tgtActiveSlot = s2.tempTimeSlotId || s2.timeSlotId;
      const tgtActiveRoom = s2.tempRoomId || s2.roomId;

      s1.tempTimeSlotId = tgtActiveSlot;
      s1.tempRoomId = tgtActiveRoom;
      s2.tempTimeSlotId = reqActiveSlot;
      s2.tempRoomId = reqActiveRoom;
    }
  }

  writeMockDb(db);
  return { success: true };
}

// Helpers for schedule collision checking in rescheduling
function getDurationMinutes(startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

function isTimeOverlap(slotA, slotB) {
  if (!slotA || !slotB) return false;
  if (slotA.day !== slotB.day) return false;
  
  const startA = slotA.startTime.split(':').map(Number);
  const endA = slotA.endTime.split(':').map(Number);
  const startB = slotB.startTime.split(':').map(Number);
  const endB = slotB.endTime.split(':').map(Number);

  const startAMins = startA[0] * 60 + startA[1];
  const endAMins = endA[0] * 60 + endA[1];
  const startBMins = startB[0] * 60 + startB[1];
  const endBMins = endB[0] * 60 + endB[1];

  return startAMins < endBMins && startBMins < endAMins;
}

/**
 * Gets all time slots that are free for a class and lecturer in a schedule
 */
export async function getAvailableTimeSlotsForSchedule(scheduleId) {
  await initPrisma();
  const data = await getDbData();
  const sch = data.schedules.find(s => s.id === scheduleId);
  if (!sch) {
    return { success: false, error: 'Jadwal tidak ditemukan.' };
  }

  const course = data.courses.find(c => c.id === sch.courseId);
  const cls = data.classes.find(c => c.id === sch.classId);
  const lecturer = data.lecturers.find(l => l.id === sch.lecturerId);
  if (!course || !cls || !lecturer) {
    return { success: false, error: 'Data pendukung tidak ditemukan.' };
  }

  const courseDuration = course.credits * 40;
  const availableSlots = [];

  for (const slot of data.timeSlots) {
    // Skip current active slot of this schedule
    const activeSlotId = sch.tempTimeSlotId || sch.timeSlotId;
    if (slot.id === activeSlotId) continue;

    // Check duration
    const slotDuration = getDurationMinutes(slot.startTime, slot.endTime);
    if (slotDuration < courseDuration) continue;

    // Check class conflict
    const classConflict = data.schedules.some(s => 
      s.id !== scheduleId && 
      s.classId === sch.classId && 
      isTimeOverlap(slot, data.timeSlots.find(ts => ts.id === (s.tempTimeSlotId || s.timeSlotId)))
    );
    if (classConflict) continue;

    // Check lecturer conflict
    const lecturerConflict = data.schedules.some(s => 
      s.id !== scheduleId && 
      s.lecturerId === sch.lecturerId && 
      isTimeOverlap(slot, data.timeSlots.find(ts => ts.id === (s.tempTimeSlotId || s.timeSlotId)))
    );
    if (lecturerConflict) continue;

    // Check assistant conflict (if applicable)
    let assistantConflict = false;
    if (sch.assistantId) {
      assistantConflict = data.schedules.some(s => 
        s.id !== scheduleId && 
        (s.assistantId === sch.assistantId || s.lecturerId === sch.assistantId) && 
        isTimeOverlap(slot, data.timeSlots.find(ts => ts.id === (s.tempTimeSlotId || s.timeSlotId)))
      );
    }
    if (assistantConflict) continue;

    // Check assistant busy studying conflict
    let assistantBusyStudying = false;
    if (sch.assistantId) {
      const assistant = data.students.find(std => std.id === sch.assistantId);
      if (assistant) {
        const assistantEnrollments = (data.courseEnrollments || [])
          .filter(e => e.studentId === assistant.id)
          .map(e => e.courseId);
        
        assistantBusyStudying = data.schedules.some(s => {
          if (s.id === scheduleId) return false;
          const sSlot = data.timeSlots.find(ts => ts.id === (s.tempTimeSlotId || s.timeSlotId));
          if (!isTimeOverlap(slot, sSlot)) return false;
          
          const isClassSchedule = s.classId === assistant.classId;
          const hasEnrollments = assistantEnrollments.length > 0;
          
          return hasEnrollments 
            ? (isClassSchedule && assistantEnrollments.includes(s.courseId))
            : isClassSchedule;
        });
      }
    }
    if (assistantBusyStudying) continue;

    // Find available rooms
    const availableRooms = data.rooms.filter(room => {
      if (room.capacity < cls.capacity) return false;
      const isLabCourse = course.type === 'PRACTICAL' || course.needsLab;
      if (isLabCourse && room.type !== 'LAB') return false;

      // Check if room is occupied
      const roomOccupied = data.schedules.some(s => 
        s.id !== scheduleId && 
        (s.tempRoomId || s.roomId) === room.id && 
        isTimeOverlap(slot, data.timeSlots.find(ts => ts.id === (s.tempTimeSlotId || s.timeSlotId)))
      );
      return !roomOccupied;
    });

    if (availableRooms.length > 0) {
      availableSlots.push({
        timeSlotId: slot.id,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomId: availableRooms[0].id,
        roomCode: availableRooms[0].code
      });
    }
  }

  return { success: true, slots: availableSlots };
}

/**
 * Directly reschedules a schedule to a target empty slot and room (temporary for this week)
 */
export async function rescheduleToEmptySlot(scheduleId, timeSlotId, roomId) {
  await initPrisma();
  if (usePrisma) {
    try {
      const updated = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          tempTimeSlotId: timeSlotId,
          tempRoomId: roomId
        }
      });
      return { success: true, updated };
    } catch (err) {
      console.warn('Prisma reschedule failed:', err.message);
    }
  }

  const db = readMockDb();
  const scheduleIndex = db.schedules.findIndex(s => s.id === scheduleId);
  if (scheduleIndex === -1) return { success: false, error: 'Jadwal tidak ditemukan' };

  db.schedules[scheduleIndex].tempTimeSlotId = timeSlotId;
  db.schedules[scheduleIndex].tempRoomId = roomId;

  writeMockDb(db);
  return { success: true };
}

/**
 * Updates a student's master data (semester and classId)
 */
export async function updateStudentMaster(studentId, semester, classId) {
  await initPrisma();
  if (usePrisma) {
    try {
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: {
          semester: parseInt(semester),
          classId: classId
        }
      });
      return { success: true, student: updated };
    } catch (err) {
      console.warn('Prisma updateStudentMaster failed:', err.message);
    }
  }

  const db = readMockDb();
  const idx = db.students.findIndex(s => s.id === studentId);
  if (idx === -1) return { success: false, error: 'Mahasiswa tidak ditemukan' };

  db.students[idx].semester = parseInt(semester);
  db.students[idx].classId = classId;

  writeMockDb(db);
  return { success: true, student: db.students[idx] };
}

/**
 * Deletes a record from a master table
 */
export async function deleteMasterRecord(table, id) {
  await initPrisma();
  if (usePrisma) {
    try {
      if (table === 'courses') {
        const deleted = await prisma.course.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'semesters') {
        const deleted = await prisma.semester.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'courseLecturers') {
        const deleted = await prisma.courseLecturer.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'lecturers') {
        const deleted = await prisma.lecturer.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'students') {
        const deleted = await prisma.student.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'rooms') {
        const deleted = await prisma.room.delete({
          where: { id }
        });
        return { success: true, deleted };
      } else if (table === 'classes') {
        const deleted = await prisma.class.delete({
          where: { id }
        });
        return { success: true, deleted };
      }
    } catch (err) {
      console.warn('Prisma delete master record failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  const db = readMockDb();
  if (!db[table]) return { success: false, error: `Table "${table}" tidak ditemukan.` };

  const index = db[table].findIndex(item => item.id === id);
  if (index === -1) return { success: false, error: 'Record tidak ditemukan.' };

  // Cascade delete for classes in Mock DB
  if (table === 'classes') {
    const studentIds = (db.students || []).filter(s => s.classId === id).map(s => s.id);
    db.students = (db.students || []).filter(s => s.classId !== id);
    db.schedules = (db.schedules || []).filter(sch => sch.classId !== id);
    db.courseEnrollments = (db.courseEnrollments || []).filter(e => !studentIds.includes(e.studentId));
  }

  const deleted = db[table].splice(index, 1)[0];
  writeMockDb(db);
  return { success: true, deleted };
}

/**
 * Updates a semester's isActive status
 */
export async function updateSemester(semesterId, isActive) {
  await initPrisma();
  const activeBool = !!isActive;

  if (activeBool) {
    if (usePrisma) {
      try {
        const activeSemester = await prisma.semester.findFirst({
          where: { isActive: true, id: { not: semesterId } }
        });
        if (activeSemester) {
          return { success: false, error: 'Hanya boleh ada 1 semester yang aktif. Nonaktifkan semester lain terlebih dahulu.' };
        }
      } catch (err) {
        console.warn('Prisma active check failed:', err.message);
      }
    } else {
      const db = readMockDb();
      const activeSemester = db.semesters?.find(s => s.isActive && s.id !== semesterId);
      if (activeSemester) {
        return { success: false, error: 'Hanya boleh ada 1 semester yang aktif. Nonaktifkan semester lain terlebih dahulu.' };
      }
    }
  }

  if (usePrisma) {
    try {
      const updated = await prisma.semester.update({
        where: { id: semesterId },
        data: { isActive: activeBool }
      });
      return { success: true, updated };
    } catch (err) {
      console.warn('Prisma update semester failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  const db = readMockDb();
  const semester = db.semesters.find(s => s.id === semesterId);
  if (semester) {
    semester.isActive = activeBool;
    writeMockDb(db);
    return { success: true, semester };
  }
  return { success: false, error: 'Semester tidak ditemukan.' };
}
