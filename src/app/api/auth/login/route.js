import { NextResponse } from 'next/server';
import { getDbData } from '@/utils/dbHelper';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan Password wajib diisi.' },
        { status: 400 }
      );
    }

    const data = await getDbData();
    const user = data.users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 }
      );
    }

    // Verify password against stored bcrypt hash in database
    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 }
      );
    }

    // Find lecturer id if role is LECTURER
    let lecturerId = null;
    if (user.role === 'LECTURER') {
      const lec = data.lecturers.find(l => l.userId === user.id);
      if (lec) lecturerId = lec.id;
    }

    // Find student id if role is STUDENT
    let studentId = null;
    if (user.role === 'STUDENT') {
      const std = data.students.find(s => s.userId === user.id);
      if (std) studentId = std.id;
    }

    // Return session data
    return NextResponse.json({
      success: true,
      token: `mock-jwt-token-for-${user.id}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        lecturerId,
        studentId
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server internal.' },
      { status: 500 }
    );
  }
}
