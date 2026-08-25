const fs = require('fs');

const codeToInsert = `
  // 7.1.5. Faculty/Staff Attendance Action Proxy (List, Save, etc.)
  if (path.startsWith("/api/faculty/attendance/") || path.startsWith("/api/staff/attendance/")) {
    const action = path.split("/").pop(); // e.g., "list", "take_periods", "save"
    if (request.method === "POST" && action) {
      let bodyData = {};
      try {
        bodyData = await request.json();
      } catch (_e) {
        return errorResponse("INVALID_REQUEST", "Invalid JSON payload.", 400);
      }

      // Map action to upstream endpoints (e.g. 'list' -> '/admin/student-period-attendance/list')
      // If the client calls /api/faculty/attendance/take_periods, it hits /admin/student-period-attendance/take_periods
      const upstreamEndpoint = \`/admin/student-period-attendance/\${action}\`;
      const { html, error, res } = await fetchUpstream(upstreamEndpoint, "POST", bodyData);
      
      if (error) return error;

      try {
        // Many of these endpoints return JSON. If it fails, fallback to returning the raw HTML/text.
        const rawJson = JSON.parse(html);
        return jsonResponse({ success: true, data: rawJson }, 200, corsHeaders);
      } catch (_e) {
        return jsonResponse({ success: true, data: html }, 200, corsHeaders);
      }
    }
  }
`;

let content = fs.readFileSync('netlify/edge-functions/ims-api.ts', 'utf8');
content = content.replace('// 7.1.5. Faculty/Staff Subjects Endpoint', codeToInsert + '\n  // 7.1.5. Faculty/Staff Subjects Endpoint');
fs.writeFileSync('netlify/edge-functions/ims-api.ts', content);
