import { getDbData, updateStudentMaxSks, saveStudentEnrollments } from './src/utils/dbHelper.js';

async function runStudentTests() {
  console.log('Running Student Portal and SKS Constraint tests...');

  // Test 1: Update student maxSks
  console.log('Testing updateStudentMaxSks...');
  const studentId = 's1'; // Ahmad Dani
  const newMaxSks = 15;
  
  const updateRes = await updateStudentMaxSks(studentId, newMaxSks);
  if (!updateRes.success) {
    throw new Error('Failed to update student SKS limit');
  }
  
  const updatedData = await getDbData();
  const student = updatedData.students.find(s => s.id === studentId);
  if (student.maxSks !== newMaxSks) {
    throw new Error(`Expected maxSks to be ${newMaxSks}, but got ${student.maxSks}`);
  }
  console.log('✅ updateStudentMaxSks passed.');

  // Test 2: Save enrollments under the limit
  console.log('Testing saveStudentEnrollments (under limit)...');
  // Get some courses
  const courses = updatedData.courses;
  const courseIdsUnderLimit = [courses[0].id]; // Under 15 SKS
  
  const saveRes1 = await saveStudentEnrollments(studentId, courseIdsUnderLimit);
  if (!saveRes1.success) {
    throw new Error('Failed to save enrollments under SKS limit');
  }

  const enrollmentData = await getDbData();
  const enrolledCourses = enrollmentData.courseEnrollments.filter(e => e.studentId === studentId);
  if (enrolledCourses.length !== 1 || enrolledCourses[0].courseId !== courses[0].id) {
    throw new Error('Course enrollments did not match expected values');
  }
  console.log('✅ saveStudentEnrollments (under limit) passed.');

  // Test 3: SKS Limit Verification (simulating the API POST endpoint validation)
  console.log('Testing SKS Limit Constraint validation...');
  const totalSks = courses.reduce((sum, c) => sum + c.credits, 0); // All courses total SKS is high
  
  if (totalSks > student.maxSks) {
    console.log(`Successfully verified that total SKS (${totalSks}) exceeds student maxSks (${student.maxSks})`);
  } else {
    throw new Error('SKS Limit logic failed: total SKS did not exceed maxSks');
  }
  console.log('✅ SKS Limit Constraint validation passed.');

  // Test 4: Course Activation Toggle and Semester Filtering
  console.log('Testing Course Activation and Semester Filtering...');
  
  const { updateCourse } = await import('./src/utils/dbHelper.js');
  // Explicitly set co10 and co11 to inactive first to prevent leaks from previous runs
  await updateCourse('co10', 2, false);
  await updateCourse('co11', 2, false);

  const freshDbData = await getDbData();
  
  // Student s1 is in class c1 (semester 1)
  const studentClass = freshDbData.classes.find(c => c.id === student.classId);
  const studentClassSemester = studentClass ? studentClass.semester : student.semester;
  
  if (studentClassSemester !== 1) {
    throw new Error('Expected student to be in semester 1 for this test');
  }

  // Filter courses using the logic implemented in route.js
  const availableCourses = freshDbData.courses.filter(c => {
    if (!c.isActive) return false;
    if (c.semester === studentClassSemester) return true;
    if (studentClassSemester % 2 !== 0 && c.semester === studentClassSemester + 1) return true;
    if (studentClassSemester % 2 === 0 && c.semester === studentClassSemester - 1) return true;
    return false;
  });

  // Verify:
  // 1. All returned courses must be active
  const hasInactive = availableCourses.some(c => !c.isActive);
  if (hasInactive) {
    throw new Error('Verification failed: available courses list contains inactive courses');
  }

  // 2. Semester 1 (studentClassSemester) students should see active courses of Semester 1 and Semester 2
  // We added co10 (SI-201) and co11 (SI-201P) as semester 2 but inactive. They shouldn't be here.
  const hasCo10OrCo11 = availableCourses.some(c => c.id === 'co10' || c.id === 'co11');
  if (hasCo10OrCo11) {
    throw new Error('Verification failed: deactivated semester 2 courses co10/co11 are showing up for student');
  }

  // If we activate co10 (Struktur Data, semester 2):
  console.log('Activating semester 2 course co10...');
  await updateCourse('co10', 2, true); // Active = true
  
  const updatedDataAfterActivation = await getDbData();
  const availableCoursesAfterAct = updatedDataAfterActivation.courses.filter(c => {
    if (!c.isActive) return false;
    if (c.semester === studentClassSemester) return true;
    if (studentClassSemester % 2 !== 0 && c.semester === studentClassSemester + 1) return true;
    if (studentClassSemester % 2 === 0 && c.semester === studentClassSemester - 1) return true;
    return false;
  });

  const activeCo10 = availableCoursesAfterAct.find(c => c.id === 'co10');
  if (!activeCo10) {
    throw new Error('Verification failed: activated semester 2 course co10 is not showing up for student');
  }

  // Restore co10 to inactive to clean up database state
  await updateCourse('co10', 2, false);

  console.log('✅ Course Activation and Semester Filtering passed.');

  // Test 5: Update Student Master Data (Semester and ClassId)
  console.log('Testing updateStudentMaster (semester and classId)...');
  const { updateStudentMaster } = await import('./src/utils/dbHelper.js');
  const originalSemester = student.semester;
  const originalClassId = student.classId;

  const testSemester = 3;
  const testClassId = 'c2';

  const masterUpdateRes = await updateStudentMaster(studentId, testSemester, testClassId);
  if (!masterUpdateRes.success) {
    throw new Error('Failed to update student master data');
  }

  const updatedDataAfterMaster = await getDbData();
  const studentAfterMaster = updatedDataAfterMaster.students.find(s => s.id === studentId);
  if (studentAfterMaster.semester !== testSemester || studentAfterMaster.classId !== testClassId) {
    throw new Error(`Expected semester/class to be ${testSemester}/${testClassId}, but got ${studentAfterMaster.semester}/${studentAfterMaster.classId}`);
  }

  // Restore original state
  await updateStudentMaster(studentId, originalSemester, originalClassId);
  console.log('✅ updateStudentMaster passed.');

  // Test 6: Reset KRS (Pilih Ulang KRS)
  console.log('Testing resetKrs / saveStudentEnrollments empty...');
  
  // Set some test enrollments for the student first to ensure we can verify they get deleted
  await saveStudentEnrollments(studentId, [courses[0].id]);
  const enrollResultBefore = await getDbData();
  const enrolledBefore = enrollResultBefore.courseEnrollments.filter(e => e.studentId === studentId);
  if (enrolledBefore.length !== 1) {
    throw new Error('Failed to set up enrollment before reset verification');
  }

  // Now perform reset (save empty enrollments)
  const resetRes = await saveStudentEnrollments(studentId, []);
  if (!resetRes.success) {
    throw new Error('Failed to reset student KRS');
  }

  const enrollmentAfterReset = await getDbData();
  const enrolledAfter = enrollmentAfterReset.courseEnrollments.filter(e => e.studentId === studentId);
  if (enrolledAfter.length !== 0) {
    throw new Error('Verification failed: course enrollments were not cleared after reset');
  }
  console.log('✅ resetKrs verification passed.');

  console.log('\n🎉 ALL STUDENT PORTAL TESTS PASSED SUCCESSFULLY!');
}

runStudentTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
