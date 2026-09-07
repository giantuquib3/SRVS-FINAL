const fs = require('fs');
const path = require('path');

function inspectFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  console.log('\n=== ' + filePath + ' ===');
  
  // Search params
  const spRegex = /searchParams\.get\((['"`])([^'"`]+)\1\)/g;
  const searchParams = [];
  let m;
  while ((m = spRegex.exec(code)) !== null) {
    searchParams.push(m[2]);
  }
  if (searchParams.length) console.log('  searchParams:', [...new Set(searchParams)].join(', '));
  
  // JSON body parsing
  const jsonRegex = /(?:const|let)\s+\{([^}]+)\}\s*=\s*(?:await\s+)?(?:req|request)\.json\(\)/g;
  while ((m = jsonRegex.exec(code)) !== null) {
    console.log('  body destructure:', m[1].replace(/\s+/g, ' '));
  }
  const bodyVarRegex = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:req|request)\.json\(\)/g;
  while ((m = bodyVarRegex.exec(code)) !== null) {
    console.log('  body assigned to variable:', m[1]);
  }

  // FormData parsing
  const fdRegex = /formData\.get\((['"`])([^'"`]+)\1\)/g;
  const formData = [];
  while ((m = fdRegex.exec(code)) !== null) {
    formData.push(m[2]);
  }
  if (formData.length) console.log('  formData:', [...new Set(formData)].join(', '));
}

const files = [
  'src/app/api/announcements/route.ts',
  'src/app/api/audit-logs/route.ts',
  'src/app/api/auth/forgot-password/route.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/me/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/courses/route.ts',
  'src/app/api/dashboard/stats/route.ts',
  'src/app/api/departments/route.ts',
  'src/app/api/enrollments/route.ts',
  'src/app/api/notifications/route.ts',
  'src/app/api/students/route.ts',
  'src/app/api/subjects/route.ts',
  'src/app/api/syllabi/route.ts',
  'src/app/api/syllabi/upload/route.ts',
  'src/app/api/syllabi/[id]/restore/route.ts',
  'src/app/api/syllabi/[id]/review/route.ts',
  'src/app/api/syllabi/[id]/route.ts',
  'src/app/api/syllabi/[id]/submit/route.ts',
  'src/app/api/syllabi/[id]/versions/route.ts',
  'src/app/api/syllabi/[id]/versions/[version]/submit/route.ts',
  'src/app/api/syllabus-approvals/route.ts',
  'src/app/api/syllabus-approvals/[id]/approve/route.ts',
  'src/app/api/syllabus-approvals/[id]/reject/route.ts',
  'src/app/api/syllabus-approvals/[id]/route.ts',
  'src/app/api/system/db-status/route.ts',
  'src/app/api/users/route.ts',
];

files.forEach(f => inspectFile(f));
