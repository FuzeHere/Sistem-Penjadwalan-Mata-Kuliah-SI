import { NextResponse } from 'next/server';
import { getDbData, saveSchedules } from '@/utils/dbHelper';
import { generateSchedule } from '@/utils/scheduler';

export async function POST(request) {
  try {
    const data = await getDbData();
    const { classes, courses, lecturers, rooms, timeSlots, lecturerPreferences, students } = data;

    // 1. Generate offerings automatically based on course codes & semesters to make the generator self-contained
    const offerings = [];
    
    // Distribute lecturers to make it look realistic
    let lecturerIndex = 0;
    
    // Find senior students (semester >= 5) to act as potential assistant lecturers (asdos)
    const seniorStudents = students.filter(s => s.semester >= 5);
    let assistantIndex = 0;

    for (const cls of classes) {
      // Find courses for this class based on semester level
      // E.g. Class semester 1 matches courses with code starting with "SI-1"
      // Class semester 3 matches courses with code starting with "SI-3"
      // Class semester 5 matches courses with code starting with "SI-5"
      const semPrefix = `SI-${cls.semester}`;
      const matchingCourses = courses.filter(c => c.code.startsWith(semPrefix));

      for (const course of matchingCourses) {
        // Assign a lecturer round-robin
        const lecturer = lecturers[lecturerIndex % lecturers.length];
        lecturerIndex++;

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
          lecturerId: lecturer.id,
          assistantId,
          academicYear: '2025/2026-Ganjil'
        });
      }
    }

    if (offerings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada mata kuliah yang cocok dengan semester kelas.' },
        { status: 400 }
      );
    }

    // 2. Run the scheduler engine
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

    // 3. Save schedules and conflicts
    await saveSchedules(scheduled, conflicts);

    return NextResponse.json({
      success: true,
      summary: {
        totalScheduled: scheduled.length,
        totalUnscheduled: unscheduled.length,
        totalConflicts: conflicts.length
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
