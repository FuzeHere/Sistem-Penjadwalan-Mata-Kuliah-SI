import { NextResponse } from 'next/server';
import { getDbData, addMasterRecord } from '@/utils/dbHelper';

export async function GET() {
  try {
    const data = await getDbData();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching database data:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { table, record } = body;

    if (!table || !record) {
      return NextResponse.json(
        { error: 'Parameter "table" dan "record" diperlukan.' },
        { status: 400 }
      );
    }

    const validTables = ['lecturers', 'students', 'courses', 'rooms', 'classes', 'semesters', 'courseLecturers'];
    if (!validTables.includes(table)) {
      return NextResponse.json(
        { error: `Nama tabel "${table}" tidak valid.` },
        { status: 400 }
      );
    }

    const result = await addMasterRecord(table, record);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error adding master record:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan data.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const id = searchParams.get('id');

    if (!table || !id) {
      return NextResponse.json(
        { error: 'Parameter "table" dan "id" diperlukan.' },
        { status: 400 }
      );
    }

    const validTables = ['lecturers', 'students', 'courses', 'rooms', 'classes', 'semesters', 'courseLecturers'];
    if (!validTables.includes(table)) {
      return NextResponse.json(
        { error: `Nama tabel "${table}" tidak valid.` },
        { status: 400 }
      );
    }

    const { deleteMasterRecord } = await import('@/utils/dbHelper');
    const res = await deleteMasterRecord(table, id);
    if (res.success) {
      return NextResponse.json({
        success: true,
        message: 'Record berhasil dihapus.',
        deleted: res.deleted
      });
    } else {
      return NextResponse.json(
        { error: res.error || 'Gagal menghapus record.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error deleting record:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus data.' },
      { status: 500 }
    );
  }
}
