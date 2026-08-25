const fs = require('fs');

let content = fs.readFileSync('README.md', 'utf8');

const eDoc = `
#### E. Fetch Attendance Subjects
Retrieves the daily subjects for which the logged-in staff member needs to mark student attendance:
- **Endpoint**: \`GET /api/faculty/attendance-subjects\` (or \`/api/staff/attendance-subjects\`)

\`\`\`bash
curl -s -H "Authorization: Bearer $API_TOKEN" \\
  "https://ims-api.sidharthprabhu.co.in/api/faculty/attendance-subjects"
\`\`\`
**Example Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "regularSubjects": [
      {
        "serialNo": 1,
        "allotedPeriod": "3",
        "subject": "AI Powered Chat Bot (DS23007 )",
        "className": "M. Tech (D S)/3/A",
        "params": {
          "subjectId": 994,
          "periods": ["3"],
          "classes": ["1411"],
          "date": "2026-08-25",
          "subjectName": "AI Powered Chat Bot (DS23007 )",
          "regularSub": 1,
          "specialSub": 0,
          "staffId": 6429
        }
      }
    ],
    "assignedSubjects": []
  }
}
\`\`\`

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
  '        "subjectCode": "AL23531"\n      }\n    ]\n  }\n}\n```\n\n---',
  '        "subjectCode": "AL23531"\n      }\n    ]\n  }\n}\n```\n\n' + eDoc + '\n\n---'
);

fs.writeFileSync('README.md', content);
