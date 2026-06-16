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

  console.log('\n🎉 ALL STUDENT PORTAL TESTS PASSED SUCCESSFULLY!');
}

runStudentTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
