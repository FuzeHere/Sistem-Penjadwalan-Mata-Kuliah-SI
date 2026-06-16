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

      // Format schedules like the mock DB
      const schedules = schedulesRaw.map(s => ({
        id: s.id,
        classId: s.classId,
        courseId: s.courseId,
        lecturerId: s.lecturerId,
        assistantId: s.assistantId,
        roomId: s.roomId,
        timeSlotId: s.timeSlotId,
        academicYear: s.academicYear,
        status: s.status,
        class: s.class,
        course: s.course,
        lecturer: s.lecturer,
        assistant: s.assistant,
        room: s.room,
        timeSlot: s.timeSlot
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
    timeSlot: slotMap.get(s.timeSlotId)
  }));

  return {
    ...db,
    schedules: enrichedSchedules,
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
      // Clear existing draft schedules first
      await prisma.schedule.deleteMany({
        where: { status: 'DRAFT' }
      });

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
            academicYear: s.academicYear,
            status: s.status || 'DRAFT'
          }
        });
      }

      // Save conflicts
      await prisma.scheduleConflict.deleteMany({
        where: { status: 'UNRESOLVED' }
      });

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
  // Filter out draft schedules
  db.schedules = db.schedules.filter(s => s.status !== 'DRAFT');
  
  // Format schedules without relations for file storage
  const cleanSchedules = newSchedules.map(s => ({
    id: s.id || Math.random().toString(36).substring(2, 9),
    classId: s.classId,
    courseId: s.courseId,
    lecturerId: s.lecturerId,
    assistantId: s.assistantId || null,
    roomId: s.roomId,
    timeSlotId: s.timeSlotId,
    academicYear: s.academicYear,
    status: s.status || 'DRAFT'
  }));

  db.schedules = [...db.schedules, ...cleanSchedules];
  
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
 * Adds or updates lecturer preference
 */
export async function saveLecturerPreference(lecturerId, preferences) {
  await initPrisma();
  if (usePrisma) {
    try {
      // Clear old preferences first
      await prisma.lecturerPreference.deleteMany({
        where: { lecturerId }
      });

      // Insert new preferences
      for (const slotId of preferences) {
        await prisma.lecturerPreference.create({
          data: {
            lecturerId,
            timeSlotId: slotId
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
  
  // Add new
  preferences.forEach((slotId, index) => {
    db.lecturerPreferences.push({
      id: `pref-${lecturerId}-${index}`,
      lecturerId,
      timeSlotId: slotId,
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
            needsLab: record.needsLab
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
      }
      return { success: true, created };
    } catch (err) {
      console.warn('Prisma add master record failed:', err.message);
    }
  }

  const db = readMockDb();
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
