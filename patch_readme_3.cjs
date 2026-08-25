const fs = require('fs');

let content = fs.readFileSync('README.md', 'utf8');

const docsToInsert = `

#### F. Mark Student Attendance (List Students)
Retrieves the list of students for a specific subject/period to mark their attendance.
- **Endpoint**: \`POST /api/faculty/attendance/list\`

\`\`\`bash
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/faculty/attendance/list" \\
  -H "Authorization: Bearer $API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "2026-08-25",
    "period": ["3"],
    "subject": 994,
    "staff": 6429,
    "classes": ["1411"],
    "special": 0,
    "regular": 1,
    "batch": ""
  }'
\`\`\`

#### G. Mark Student Attendance (Save)
Submits the marked attendance for the students to the upstream portal.
- **Endpoint**: \`POST /api/faculty/attendance/take_periods\` (or whichever action endpoint is used)

\`\`\`bash
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/faculty/attendance/take_periods" \\
  -H "Authorization: Bearer $API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "2026-08-25",
    "period": ["3"],
    "subject": 994,
    "students": [{"id": 101, "status": "present"}, {"id": 102, "status": "absent"}]
  }'
\`\`\`
`;

content = content.replace(
  '    "assignedSubjects": []\n  }\n}\n```\n\n---',
  '    "assignedSubjects": []\n  }\n}\n```\n' + docsToInsert + '\n---'
);

fs.writeFileSync('README.md', content);
