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

    const validTables = ['lecturers', 'students', 'courses', 'rooms', 'classes'];
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
