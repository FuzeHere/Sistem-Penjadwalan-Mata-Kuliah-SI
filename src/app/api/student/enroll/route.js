import { NextResponse } from 'next/server';
import { getDbData, saveStudentEnrollments } from '@/utils/dbHelper';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId wajib disertakan.' },
        { status: 400 }
      );
    }

    const data = await getDbData();
    const student = data.students.find(s => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: 'Data mahasiswa tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Filter enrollments for this student
    const studentEnrollments = data.courseEnrollments.filter(e => e.studentId === studentId);
    
    // Filter courses that are active and match the student's semester or adjacent semester level
    const studentClass = data.classes.find(c => c.id === student.classId);
    const studentClassSemester = studentClass ? studentClass.semester : student.semester;

    const availableCourses = data.courses.filter(c => {
      if (!c.isActive) return false;
      if (c.semester === studentClassSemester) return true;
      if (studentClassSemester % 2 !== 0 && c.semester === studentClassSemester + 1) return true;
      if (studentClassSemester % 2 === 0 && c.semester === studentClassSemester - 1) return true;
      return false;
    });

    // Send list of enrollments, student details, and all courses
    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        nim: student.nim,
        semester: student.semester,
        maxSks: student.maxSks || 24,
        classId: student.classId
      },
      enrollments: studentEnrollments,
      courses: availableCourses
    });
  } catch (err) {
    console.error('Error fetching student enrollments:', err);
    return NextResponse.json(
      { error: 'Gagal mengambil data pengisian KRS.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { studentId, courseIds } = body;

    if (!studentId || !Array.isArray(courseIds)) {
      return NextResponse.json(
        { error: 'studentId dan daftar courseIds (array) wajib dikirim.' },
        { status: 400 }
      );
    }

    const data = await getDbData();
    const student = data.students.find(s => s.id === studentId);

    if (!student) {
      return NextResponse.json(
        { error: 'Data mahasiswa tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Calculate total SKS of selected courses
    const selectedCourses = data.courses.filter(c => courseIds.includes(c.id));
    const totalSks = selectedCourses.reduce((sum, c) => sum + c.credits, 0);
    const maxSksAllowed = student.maxSks || 24;

    if (totalSks > maxSksAllowed) {
      return NextResponse.json(
        { error: `Batas SKS terlampaui! Anda memilih ${totalSks} SKS, maksimal batas yang ditentukan Admin adalah ${maxSksAllowed} SKS.` },
        { status: 400 }
      );
    }

    // Save
    const res = await saveStudentEnrollments(studentId, courseIds);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'KRS berhasil disimpan.',
        totalSks
      });
    } else {
      throw new Error(res.error || 'Failed to save');
    }
  } catch (err) {
    console.error('Error saving enrollments:', err);
    return NextResponse.json(
      { error: 'Gagal menyimpan rencana studi.' },
      { status: 500 }
    );
  }
}
