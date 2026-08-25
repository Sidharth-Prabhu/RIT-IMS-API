const fs = require('fs');

const codeToInsert = `
  // 7.1.4. Faculty/Staff Attendance Subjects Endpoint
  if ((path === "/api/faculty/attendance-subjects" || path === "/api/staff/attendance-subjects") && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/student-period-attendance/index");
    if (error) return error;

    const doc = parse(html);
    
    const parseTable = (tbodyId: string) => {
      const tbody = doc.querySelector(tbodyId);
      if (!tbody) return [];
      const rows = tbody.querySelectorAll("tr");
      const result: any[] = [];
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 5) {
          const serialNo = cells[0].textContent?.trim() || "";
          if (serialNo === "No Date Available" || serialNo === "No Data Available...") continue;
          
          const allotedPeriod = cells[1].textContent?.trim() || "";
          const subject = cells[2].textContent?.trim() || "";
          const className = cells[3].textContent?.trim() || "";
          
          const actionHtml = cells[4].innerHTML;
          
          let params = {};
          const match = actionHtml.match(/openModal\\([^,]+,\\s*"Take Attendance",\\s*([^,]+),\\s*(\\[[^\\]]+\\]),\\s*(\\[[^\\]]+\\]),\\s*"([^"]+)",\\s*"([^"]+)",\\s*([^,]+),\\s*([^,]+),\\s*([^)]+)\\)/);
          if (match) {
            try {
              params = {
                subjectId: JSON.parse(match[1]),
                periods: JSON.parse(match[2]),
                classes: JSON.parse(match[3]),
                date: match[4],
                subjectName: match[5],
                regularSub: JSON.parse(match[6]),
                specialSub: JSON.parse(match[7]),
                staffId: JSON.parse(match[8])
              };
            } catch(e) {}
          }
    
          result.push({
            serialNo: parseInt(serialNo, 10),
            allotedPeriod,
            subject,
            className,
            params
          });
        }
      }
      return result;
    };

    return jsonResponse({
      success: true,
      data: {
        regularSubjects: parseTable("#regularSubjects"),
        assignedSubjects: parseTable("#assignedSubjects")
      }
    }, 200, corsHeaders);
  }
`;

let content = fs.readFileSync('netlify/edge-functions/ims-api.ts', 'utf8');
content = content.replace('// 7.1.5. Faculty/Staff Subjects Endpoint', codeToInsert + '\n  // 7.1.5. Faculty/Staff Subjects Endpoint');
fs.writeFileSync('netlify/edge-functions/ims-api.ts', content);
