/**
 * Scheduler Engine - Constraint-based Greedy Heuristic Scheduling
 */

/**
 * Calculates duration between two time strings in format "HH:MM" in minutes.
 */
function getDurationMinutes(startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

/**
 * Checks if two time slots overlap on the same day.
 * Standard implementation assuming slots are fixed blocks. 
 * If they are custom times, we check if they overlap.
 */
function isTimeOverlap(slotA, slotB) {
  if (slotA.day !== slotB.day) return false;
  
  const startA = slotA.startTime.split(':').map(Number);
  const endA = slotA.endTime.split(':').map(Number);
  const startB = slotB.startTime.split(':').map(Number);
  const endB = slotB.endTime.split(':').map(Number);

  const startAMins = startA[0] * 60 + startA[1];
  const endAMins = endA[0] * 60 + endA[1];
  const startBMins = startB[0] * 60 + startB[1];
  const endBMins = endB[0] * 60 + endB[1];

  // Overlap condition: startA < endB && startB < endA
  return startAMins < endBMins && startBMins < endAMins;
}

/**
 * Core scheduling function
 * @param {Object} data - Input data containing:
 *   - offerings: Array of { classId, courseId, lecturerId, assistantId (optional), academicYear }
 *   - courses: Map or Array of courses
 *   - classes: Map or Array of classes
 *   - lecturers: Map or Array of lecturers
 *   - rooms: Array of rooms
 *   - timeSlots: Array of time slots
 *   - lecturerPreferences: Array of lecturer preferences
 *   - students: Array of students (with classId)
 * @returns {Object} { scheduled: [], unscheduled: [], conflicts: [] }
 */
export function generateSchedule({
  offerings,
  courses,
  classes,
  lecturers,
  rooms,
  timeSlots,
  lecturerPreferences = [],
  students = [],
  courseEnrollments = []
}) {
  // Convert arrays to helper maps for faster lookup
  const courseMap = new Map(courses.map(c => [c.id, c]));
  const classMap = new Map(classes.map(c => [c.id, c]));
  const lecturerMap = new Map(lecturers.map(l => [l.id, l]));
  const studentMap = new Map(students.map(s => [s.id, s]));
  const timeSlotMap = new Map(timeSlots.map(t => [t.id, t]));
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // Index lecturer preferences: lecturerId -> Set of preferredDay (e.g. "Senin", "Rabu")
  const prefMap = new Map();
  lecturerPreferences.forEach(p => {
    if (!prefMap.has(p.lecturerId)) {
      prefMap.set(p.lecturerId, new Set());
    }
    prefMap.get(p.lecturerId).add(p.preferredDay);
  });

  // Sort offerings: Prioritize PRACTICAL courses, then courses with higher credits, then larger classes
  const sortedOfferings = [...offerings].sort((a, b) => {
    const courseA = courseMap.get(a.courseId);
    const courseB = courseMap.get(b.courseId);
    
    if (!courseA || !courseB) return 0;
    
    // 1. Practical courses first (needs lab, which is a limited resource)
    const typeA = courseA.type === 'PRACTICAL' || courseA.needsLab ? 1 : 0;
    const typeB = courseB.type === 'PRACTICAL' || courseB.needsLab ? 1 : 0;
    if (typeB !== typeA) return typeB - typeA;
    
    // 2. Higher credits (longer classes) first
    if (courseB.credits !== courseA.credits) return courseB.credits - courseA.credits;
    
    // 3. Larger classes first
    const classSizeA = classMap.get(a.classId)?.capacity || 0;
    const classSizeB = classMap.get(b.classId)?.capacity || 0;
    return classSizeB - classSizeA;
  });

  const scheduled = [];
  const unscheduled = [];
  const conflictsReport = [];

  // Loop through sorted offerings and place them using greedy selection
  for (const offering of sortedOfferings) {
    const course = courseMap.get(offering.courseId);
    const cls = classMap.get(offering.classId);
    const lecturer = lecturerMap.get(offering.lecturerId);
    const assistant = offering.assistantId ? studentMap.get(offering.assistantId) : null;
    
    if (!course || !cls || !lecturer) {
      unscheduled.push({
        ...offering,
        reason: 'Data master (Mata Kuliah / Kelas / Dosen) tidak ditemukan.'
      });
      continue;
    }

    const courseDuration = course.credits * 40; // 1 SKS = 40 minutes

    // Find all valid (Room, TimeSlot) candidates
    const candidates = [];

    for (const slot of timeSlots) {
      const slotDuration = getDurationMinutes(slot.startTime, slot.endTime);
      
      // Credit fit check (Hard Constraint)
      if (slotDuration < courseDuration) continue;

      for (const room of rooms) {
        // Room capacity check (Hard Constraint)
        if (room.capacity < cls.capacity) continue;

        // Room type check (Hard Constraint)
        // Lab course must go to Lab room. Regular course should go to Regular room if possible, but can go to Lab if necessary.
        const isLabCourse = course.type === 'PRACTICAL' || course.needsLab;
        if (isLabCourse && room.type !== 'LAB') continue;
        if (!isLabCourse && room.type === 'LAB') {
          // Let's penalize putting a theory course in a lab, or skip if possible.
          // For now, we allow it but give lower score.
        }

        // Hard Constraints Checks with currently scheduled items
        let isConflict = false;
        let conflictDesc = '';

        for (const s of scheduled) {
          const sSlot = timeSlotMap.get(s.timeSlotId);
          
          // Check if time slots overlap
          if (isTimeOverlap(slot, sSlot)) {
            // 1. Room conflict
            if (s.roomId === room.id) {
              isConflict = true;
              conflictDesc = `Ruangan ${room.code} sudah digunakan oleh kelas lain.`;
              break;
            }
            // 2. Class conflict
            if (s.classId === cls.id) {
              isConflict = true;
              conflictDesc = `Kelas ${cls.name} sudah memiliki perkuliahan lain di jam ini.`;
              break;
            }
            // 3. Lecturer conflict
            if (s.lecturerId === lecturer.id) {
              isConflict = true;
              conflictDesc = `Dosen ${lecturer.name} sedang mengajar kelas lain di jam ini.`;
              break;
            }
            // 4. Assistant lecturer conflict (if this offering has an assistant)
            if (assistant) {
              // Case 4.1: Assistant is teaching another lab
              if (s.assistantId === assistant.id) {
                isConflict = true;
                conflictDesc = `Asisten Dosen ${assistant.name} sedang mengajar praktikum lain di jam ini.`;
                break;
              }
              // Case 4.2: Assistant is also the main lecturer in another class (rare but check)
              if (s.lecturerId === assistant.id) {
                isConflict = true;
                conflictDesc = `Asisten Dosen ${assistant.name} sedang mengajar kelas lain di jam ini.`;
                break;
              }
            }

            // 5. If another scheduled class is the assistant's own class, and they are enrolled in it
            if (assistant) {
              const assistantEnrollments = (courseEnrollments || [])
                .filter(e => e.studentId === assistant.id)
                .map(e => e.courseId);
              
              const hasEnrollments = assistantEnrollments.length > 0;
              const isClassSchedule = s.classId === assistant.classId;
              
              const isBusyStudying = hasEnrollments 
                ? (isClassSchedule && assistantEnrollments.includes(s.courseId))
                : isClassSchedule;

              if (isBusyStudying) {
                isConflict = true;
                conflictDesc = `Asisten Dosen ${assistant.name} sedang memiliki jadwal kuliah kelasnya sendiri (${classMap.get(assistant.classId)?.name || ''}) untuk mata kuliah ${s.course?.name || ''}.`;
                break;
              }
            }

            // 6. If a student in this class is busy assisting another class in this slot
            const classStudents = students.filter(std => std.classId === cls.id);
            const busyStudent = classStudents.find(std => s.assistantId === std.id);
            if (busyStudent) {
              isConflict = true;
              conflictDesc = `Mahasiswa ${busyStudent.name} dari kelas ini sedang bertugas sebagai Asisten Dosen di kelas ${classMap.get(s.classId)?.name || ''}.`;
              break;
            }
          }
        }

        // Also check if assistant (who is a student) is scheduled to be an assistant here,
        // but there is another offering we already scheduled where they are a student, or vice versa
        // Wait, the "s.classId === assistant.classId" condition covers if their class has a scheduled session. This is correct!

        if (isConflict) continue;

        // Scoring for Soft Constraints
        let score = 100;

        // Soft Constraint 1: Lecturer Preference (day-based)
        const lecturerPrefs = prefMap.get(lecturer.id);
        if (lecturerPrefs && lecturerPrefs.has(slot.day)) {
          score += 50; // High bonus for lecturer's preferred day
        }

        // Soft Constraint 2: Prefer Regular room for Theory, Lab room for Lab
        const isLab = room.type === 'LAB';
        if (isLabCourse && isLab) score += 20;
        if (!isLabCourse && !isLab) score += 20;
        if (!isLabCourse && isLab) score -= 30; // Penalty for theory in lab room

        // Soft Constraint 3: Avoid scheduling classes too late (e.g., after 17:00)
        const [endH] = slot.endTime.split(':').map(Number);
        if (endH >= 17) score -= 15;

        // Soft Constraint 4: Avoid scheduling classes too early (e.g., 07:30) if lecturer prefers later, or vice versa
        // For simplicity, we just use the scoring
        
        candidates.push({
          room,
          slot,
          score
        });
      }
    }

    if (candidates.length > 0) {
      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      scheduled.push({
        id: Math.random().toString(36).substring(2, 9), // temp id, will be saved in DB
        classId: cls.id,
        courseId: course.id,
        lecturerId: lecturer.id,
        assistantId: assistant ? assistant.id : null,
        roomId: best.room.id,
        timeSlotId: best.slot.id,
        academicYear: offering.academicYear,
        status: 'DRAFT'
      });
    } else {
      unscheduled.push({
        ...offering,
        reason: 'Tidak ada slot waktu atau ruangan yang memenuhi semua batasan (Hard Constraints).'
      });
      conflictsReport.push({
        classId: cls.id,
        courseId: course.id,
        lecturerId: lecturer.id,
        assistantId: assistant ? assistant.id : null,
        conflictType: 'HARD',
        description: `Gagal menjadwalkan ${course.name} (${cls.name}): Bentrok jadwal dengan dosen, ruangan, atau jadwal kuliah asisten dosen.`
      });
    }
  }

  return {
    scheduled,
    unscheduled,
    conflicts: conflictsReport
  };
}
