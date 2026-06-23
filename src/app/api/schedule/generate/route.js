import { NextResponse } from 'next/server';
import { getDbData, saveSchedules, saveStudentEnrollments } from '@/utils/dbHelper';
import { generateSchedule } from '@/utils/scheduler';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { semesterType } = body;

    let data = await getDbData();

    // Auto-fill KRS for students who have not filled it yet
    let dbUpdated = false;
    for (const student of data.students) {
      const hasEnrolled = (data.courseEnrollments || []).some(e => e.studentId === student.id);
      if (!hasEnrolled) {
        // Find recommended active courses for this student's semester
        const recommendedCourses = data.courses.filter(c => c.isActive && c.semester === student.semester);
        
        // Select courses that fit within maxSks
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
          dbUpdated = true;
        }
      }
    }

    if (dbUpdated) {
      data = await getDbData();
    }

    const { classes, courses, lecturers, rooms, timeSlots, lecturerPreferences, students, courseLecturers, semesters, courseEnrollments } = data;

    // 1. Determine active semester for academic year
    const activeSemester = semesters.find(s => s.isActive);
    if (!activeSemester && !semesterType) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada semester aktif. Silakan atur semester aktif terlebih dahulu di Data Master atau pilih semester generator.' },
        { status: 400 }
      );
    }

    const selectedType = semesterType || (activeSemester ? activeSemester.type : 'GANJIL');
    const isGanjilSelected = selectedType === 'GANJIL';
    const academicYear = `${activeSemester ? activeSemester.year : '2025/2026'}-${isGanjilSelected ? 'Ganjil' : 'Genap'}`;

    // 2. Generate offerings based on CourseLecturer assignments (data master penugasan dosen)
    const offerings = [];
    
    // Find senior students (semester >= 5) to act as potential assistant lecturers (asdos)
    const seniorStudents = students.filter(s => s.semester >= 5);
    let assistantIndex = 0;

    // Build a map: courseId -> array of assigned lecturerIds
    const courseLecturerMap = new Map();
    for (const cl of (courseLecturers || [])) {
      const courseId = cl.courseId;
      if (!courseLecturerMap.has(courseId)) {
        courseLecturerMap.set(courseId, []);
      }
      courseLecturerMap.get(courseId).push(cl.lecturerId);
    }

    // Filter classes matching the selected semester type (Odd vs Even)
    const targetClasses = classes.filter(cls => {
      const clsIsGanjil = cls.semester % 2 !== 0;
      return isGanjilSelected ? clsIsGanjil : !clsIsGanjil;
    });

    for (const cls of targetClasses) {
      // Find students in this class
      const classStudents = students.filter(s => s.classId === cls.id);
      const classStudentIds = classStudents.map(s => s.id);
      
      // Find course IDs enrolled by students of this class
      const enrolledCourseIds = (courseEnrollments || [])
        .filter(e => classStudentIds.includes(e.studentId))
        .map(e => e.courseId);

      // Unique list of enrolled course IDs
      const uniqueEnrolledIds = Array.from(new Set(enrolledCourseIds));

      // Find courses for this class that are active and match the semester level rules
      let matchingCourses = courses.filter(c => {
        if (!c.isActive) return false;
        if (c.semester === cls.semester) return true;
        if (cls.semester % 2 !== 0 && c.semester === cls.semester + 1) return true;
        if (cls.semester % 2 === 0 && c.semester === cls.semester - 1) return true;
        return false;
      });

      // If students in this class have actually selected courses via KRS, filter by those selections!
      if (uniqueEnrolledIds.length > 0) {
        matchingCourses = matchingCourses.filter(c => uniqueEnrolledIds.includes(c.id));
      }

      for (const course of matchingCourses) {
        // Get assigned lecturers from CourseLecturer data master
        const assignedLecturerIds = courseLecturerMap.get(course.id) || [];

        if (assignedLecturerIds.length === 0) {
          // Skip courses without lecturer assignments
          continue;
        }

        // Determine which lecturer to assign for this class
        // Strategy: distribute lecturers among parallel classes of the same course
        // Get all classes in same semester that also need this course
        const parallelClasses = classes.filter(c => c.semester === cls.semester);
        const classIndex = parallelClasses.findIndex(c => c.id === cls.id);
        const lecturerIdx = classIndex % assignedLecturerIds.length;
        const assignedLecturerId = assignedLecturerIds[lecturerIdx];

        // Assign assistant lecturer if it is a practical class
        let assistantId = null;
        if ((course.type === 'PRACTICAL' || course.needsLab) && seniorStudents.length > 0) {
          const asdos = seniorStudents[assistantIndex % seniorStudents.length];
          assistantId = asdos.id;
          assistantIndex++;
        }

        offerings.push({
          classId: cls.id,
          courseId: course.id,
          lecturerId: assignedLecturerId,
          assistantId,
          academicYear
        });
      }
    }

    if (offerings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada penugasan dosen-mata kuliah yang cocok. Pastikan data Penugasan Dosen dan Mata Kuliah sudah diisi.' },
        { status: 400 }
      );
    }

    // 3. Run the scheduler engine
    const { scheduled, unscheduled, conflicts } = generateSchedule({
      offerings,
      courses,
      classes,
      lecturers,
      rooms,
      timeSlots,
      lecturerPreferences,
      students
    });

    // 4. Save schedules and conflicts
    await saveSchedules(scheduled, conflicts);

    return NextResponse.json({
      success: true,
      summary: {
        totalScheduled: scheduled.length,
        totalUnscheduled: unscheduled.length,
        totalConflicts: conflicts.length,
        academicYear
      },
      scheduled,
      unscheduled,
      conflicts
    });
  } catch (err) {
    console.error('Error generating schedule:', err);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan internal server.' },
      { status: 500 }
    );
  }
}
