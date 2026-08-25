const { parse } = require("node-html-parser");
const fs = require("fs");

const html = fs.readFileSync("sample.html", "utf8");
const doc = parse(html);

const parseTable = (tbodyId) => {
  const tbody = doc.querySelector(tbodyId);
  if (!tbody) return [];
  const rows = tbody.querySelectorAll("tr");
  const result = [];
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 5) {
      const serialNo = cells[0].textContent.trim();
      if (serialNo === "No Date Available" || serialNo === "No Data Available...") continue;
      
      const allotedPeriod = cells[1].textContent.trim();
      const subject = cells[2].textContent.trim();
      const className = cells[3].textContent.trim();
      
      const actionHtml = cells[4].innerHTML;
      
      let params = {};
      const match = actionHtml.match(/openModal\([^,]+,\s*"Take Attendance",\s*([^,]+),\s*(\[[^\]]+\]),\s*(\[[^\]]+\]),\s*"([^"]+)",\s*"([^"]+)",\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
      if (match) {
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

console.log(JSON.stringify({
  regularSubjects: parseTable("#regularSubjects"),
  assignedSubjects: parseTable("#assignedSubjects")
}, null, 2));
