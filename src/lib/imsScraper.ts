import type { StudentInfo, Subject, Semester, CatMark, AttendanceEntry, Timetable, TimetableEntry, StudentProfile, ProfileSection, ProfileField, LeaveEntry, AssignmentMark, AcademicFeeData, FeeYearItem, ExamFeeData } from './processData';

// ─── Credit Estimation ───────────────────────────────────────────────────────

function estimateCredits(code: string, title: string): number {
  const codeClean = code.toUpperCase().trim();
  const titleClean = title.toLowerCase().trim();
  if (titleClean.includes('laboratory') || titleClean.includes('lab') || codeClean.endsWith('21') || codeClean.endsWith('22')) {
    return 1.5;
  }
  if (codeClean.startsWith('MA')) return 4;
  if (titleClean.includes('project') || titleClean.includes('seminar')) return 3;
  return 3;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutIms(): Promise<void> {
  try {
    const loginPageRes = await fetch('/ims/login', { credentials: 'same-origin' });
    if (!loginPageRes.ok) return;
    const html = await loginPageRes.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    if (csrfToken) {
      await fetch('/ims/admin/logout-rit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({ _token: csrfToken }),
      });
      console.log('Cleared active session cookie on IMS backend.');
    }
  } catch (err) {
    console.error('Backend session logout failed:', err);
  }
}

// ─── Login (returns studentInfo + csrfToken, fetches NO grade data) ───────────

export async function loginIms(username: string, password: string): Promise<{ studentInfo: StudentInfo; csrfToken: string }> {
  await logoutIms();

  // Step 1: Get CSRF token
  let csrfToken = '';
  let res: Response | null = null;
  let html = '';
  try {
    res = await fetch('/ims/login', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching login page`);
    html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    csrfToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    if (!csrfToken) {
      csrfToken = doc.querySelector('input[name="_token"]')?.getAttribute('value') || '';
    }
  } catch (err: any) {
    throw new Error(`Connection initializer failed: ${err.message}`);
  }

  if (!csrfToken) {
    throw new Error(`Could not retrieve CSRF token. Server response code: ${res ? res.status : 'None'}. Preview: ${html ? html.slice(0, 200).replace(/[\r\n]+/g, ' ') : 'Empty response'}`);
  }

  // Step 2: Login
  try {
    const loginRes = await fetch('/ims/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-TOKEN': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ _token: csrfToken, email: username, password }),
    });
    if (loginRes.url.includes('/login') || loginRes.status === 422) {
      throw new Error('Invalid Register Number or Password.');
    }
  } catch (err: any) {
    throw new Error(err.message || 'Authentication with RIT IMS failed.');
  }

  // Step 3: Fetch student name/dept from report page
  let studentName = 'RIT Student';
  let department = '';
  let batch = '';

  try {
    const reportRes = await fetch('/ims/admin/grade/student/mark/report', { credentials: 'same-origin' });
    if (reportRes.ok) {
      const html = await reportRes.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const reportCsrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (reportCsrf) csrfToken = reportCsrf;

      const nameEl = doc.querySelector('.nav_prof_label span');
      if (nameEl?.textContent) studentName = nameEl.textContent.trim();

      const profileLinkEl = doc.querySelector('a[href*="Profile-view"]');
      const profileUrl = profileLinkEl?.getAttribute('href');
      if (profileUrl) {
        let target = profileUrl;
        if (target.startsWith('https://ims.ritchennai.edu.in')) {
          target = target.replace('https://ims.ritchennai.edu.in', '/ims');
        } else if (target.startsWith('/')) {
          target = '/ims' + target;
        } else if (!target.startsWith('http')) {
          target = '/ims/admin/students/' + target;
        }
        try {
          const profileRes = await fetch(target, { credentials: 'same-origin' });
          if (profileRes.ok) {
            const profileHtml = await profileRes.text();
            const profileDoc = new DOMParser().parseFromString(profileHtml, 'text/html');
            const rawFields: Record<string, string> = {};
            const addField = (label: string, val: string) => {
              const cleanLabel = label.replace(/:/g, '').replace(/\*/g, '').trim().toLowerCase();
              const cleanVal = val.trim();
              if (cleanLabel && cleanVal && cleanLabel !== '_token') {
                rawFields[cleanLabel] = cleanVal;
              }
            };

            const rows = Array.from(profileDoc.querySelectorAll('tr, .row, .profile-info-row'));
            rows.forEach(row => {
              const ths = Array.from(row.querySelectorAll('th'));
              const tds = Array.from(row.querySelectorAll('td'));
              if (ths.length > 0 && tds.length > 0 && ths.length === tds.length) {
                for (let i = 0; i < ths.length; i++) {
                  addField(ths[i].textContent || '', tds[i].textContent || '');
                }
              } else if (tds.length >= 2) {
                for (let i = 0; i < tds.length - 1; i += 2) {
                  addField(tds[i].textContent || '', tds[i + 1].textContent || '');
                }
              }
            });

            const findField = (...keys: string[]): string => {
              for (const k of keys) {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                for (const [rk, rv] of Object.entries(rawFields)) {
                  const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (cleanRk.includes(cleanK)) {
                    return rv;
                  }
                }
              }
              return '';
            };

            const parsedName = findField('name', 'fullname');
            if (parsedName) studentName = parsedName;
            
            const parsedDept = findField('department', 'branch', 'course');
            if (parsedDept) department = parsedDept;

            const parsedBatch = findField('batch', 'academicyear');
            if (parsedBatch) batch = parsedBatch;
          }
        } catch {
          // profile fetch failed, use fallback
        }
      }

      // Fallback: scan report page text nodes for department
      if (!department) {
        const nodes = Array.from(doc.querySelectorAll('td, th, span, div, p, label, strong, h1, h2, h3, li'));
        nodes.forEach(node => {
          const text = node.textContent || '';
          if ((text.includes('Branch') || text.includes('Department') || text.includes('Course')) && text.includes(':')) {
            const parts = text.split(':');
            if (parts[1]?.trim()) department = parts[1].trim();
          }
        });
      }
    }
  } catch {
    // proceed with defaults
  }

  let dashboardStats = { cgpa: 'N/A', arrears: 'N/A', attendance: 'N/A', pendingFees: 'N/A' };
  try {
    const adminRes = await fetch('/ims/admin', { credentials: 'same-origin' });
    if (adminRes.ok) {
      const adminHtml = await adminRes.text();
      const adminDoc = new DOMParser().parseFromString(adminHtml, 'text/html');
      
      const extractMetric = (labelRegex: RegExp, valueRegex: RegExp): string => {
        const elements = Array.from(adminDoc.querySelectorAll('p, span, h3, h4, h1, td, th, b, strong, li, div'));
        for (const el of elements) {
          const text = (el.textContent || '').trim();
          if (labelRegex.test(text) && text.length < 50) {
            // Check immediate siblings
            let sibling = el.nextElementSibling;
            while (sibling) {
              const sibText = (sibling.textContent || '').trim();
              const match = sibText.match(valueRegex);
              if (match) return match[1] || match[0];
              sibling = sibling.nextElementSibling;
            }
            sibling = el.previousElementSibling;
            while (sibling) {
              const sibText = (sibling.textContent || '').trim();
              const match = sibText.match(valueRegex);
              if (match) return match[1] || match[0];
              sibling = sibling.previousElementSibling;
            }
            
            // Check direct parent wrapper
            const parent = el.parentElement;
            if (parent) {
              const parentText = (parent.textContent || '').trim();
              const cleanParentText = parentText.replace(text, '');
              const match = cleanParentText.match(valueRegex);
              if (match) return match[1] || match[0];
            }
          }
        }
        return 'N/A';
      };

      dashboardStats.cgpa = extractMetric(/\bCGPA\b/i, /(\d+\.\d+)/);
      dashboardStats.arrears = extractMetric(/\barrears?\b/i, /\b(\d+)\b/);
      dashboardStats.attendance = extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?\s*%)/) || extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?)/);
      dashboardStats.pendingFees = extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /(?:Rs\.?|₹)\s*([\d,]+)/) || 
                                   extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /\b([\d,]+)\b/);
    }
  } catch {
    // proceed
  }

  const studentInfo: StudentInfo = {
    name: studentName,
    regNo: username,
    department,
    college: 'Rajalakshmi Institute of Technology',
    isLateralEntry: false,
    batch: batch || undefined,
    dashboardStats,
  };

  return { studentInfo, csrfToken };
}

// ─── Fetch a single semester on demand ───────────────────────────────────────

export async function fetchSemesterGrades(csrfToken: string, semNum: number): Promise<Semester | null> {
  try {
    console.log(`Fetching marks for Semester ${semNum}...`);
    const apiRes = await fetch('/ims/admin/grade/student/mark/get_marks', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-TOKEN': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ semester: String(semNum) }),
    });

    if (!apiRes.ok) {
      console.warn(`Semester ${semNum} request returned status ${apiRes.status}`);
      return null;
    }

    const raw = await apiRes.json();
    const items = raw.data || [];
    if (!Array.isArray(items) || items.length === 0) return null;

    const subjects: Subject[] = items.map((item: any) => {
      const code = item.subject_code || item.get_subject?.subject_code || 'SUBJ';
      const title = item.subject_name || item.get_subject?.name || 'Course Title';
      const grade = (item.grade_letter || item.get_grade?.grade_letter || 'U').trim().toUpperCase();
      const gp = item.get_grade?.grade_point !== undefined
        ? parseFloat(item.get_grade.grade_point)
        : (grade === 'S' || grade === 'O' ? 10 : grade === 'A+' ? 9 : grade === 'A' ? 8 : grade === 'B+' ? 7 : grade === 'B' ? 6 : grade === 'C' ? 5 : 0);
      return { code, title, credits: estimateCredits(code, title), grade, gradePoints: gp };
    });

    let totalQP = 0, totalCr = 0;
    subjects.forEach(s => { totalQP += s.gradePoints * s.credits; totalCr += s.credits; });

    return { semester: semNum, gpa: totalCr > 0 ? totalQP / totalCr : 0, subjects };
  } catch (err: any) {
    console.error(`Failed to fetch Semester ${semNum}:`, err.message);
    return null;
  }
}

// ─── Fetch CAT Marks on demand ────────────────────────────────────────────────

export async function fetchCatMarks(_csrfToken: string): Promise<CatMark[]> {
  const catMarks: CatMark[] = [];
  try {
    const res = await fetch('/ims/admin/student-cat-mark/report', { credentials: 'same-origin' });
    if (!res.ok) return catMarks;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return catMarks;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 6) {
        const code = cells[0].textContent?.trim() || '';
        const title = cells[1].textContent?.trim() || '';
        const faculty = cells[2].textContent?.trim() || '';
        const co1 = cells[3]?.textContent?.trim() || '';
        const co2 = cells[4]?.textContent?.trim() || '';
        const total = cells[5]?.textContent?.trim() || '';
        const weightage = cells[6]?.textContent?.trim() || '';
        if (code && title) catMarks.push({ code, title, faculty, co1, co2, total, weightage });
      }
    });
  } catch (err) {
    console.warn('Failed to fetch CAT marks:', err);
  }
  return catMarks;
}

// ─── Fetch Attendance on demand ───────────────────────────────────────────────

export async function fetchAttendance(_csrfToken: string): Promise<AttendanceEntry[]> {
  const attendance: AttendanceEntry[] = [];
  try {
    const res = await fetch('/ims/admin/student-personal-attendance/report', { credentials: 'same-origin' });
    if (!res.ok) return attendance;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#studentAttendence') || doc.querySelector('table');
    if (!table) return attendance;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 8) {
        const code = cells[2].textContent?.trim() || '';
        const title = cells[3].textContent?.trim() || '';
        const faculty = cells[4].textContent?.trim() || '';
        const attended = parseInt(cells[5].textContent?.trim() || '0', 10);
        const total = parseInt(cells[6].textContent?.trim() || '0', 10);
        const percentage = parseFloat(cells[7].textContent?.trim() || '0');
        if (code && title) attendance.push({ code, title, faculty, attended, total, percentage });
      }
    });
  } catch (err) {
    console.warn('Failed to fetch attendance:', err);
  }
  return attendance;
}

// ─── Fetch Timetable on demand ────────────────────────────────────────────────

export async function fetchTimetable(_csrfToken: string): Promise<Timetable | null> {
  try {
    let targetUrl = '/ims/admin/student-time-table';

    try {
      const navRes = await fetch('/ims/admin/grade/student/mark/report', { credentials: 'same-origin' });
      if (navRes.ok) {
        const navHtml = await navRes.text();
        const navDoc = new DOMParser().parseFromString(navHtml, 'text/html');
        const ttLink = navDoc.querySelector('a[href*="student-time-table"]')?.getAttribute('href');
        if (ttLink) {
          if (ttLink.startsWith('https://ims.ritchennai.edu.in')) {
            targetUrl = ttLink.replace('https://ims.ritchennai.edu.in', '/ims');
          } else if (ttLink.startsWith('/')) {
            targetUrl = '/ims' + ttLink;
          } else {
            targetUrl = ttLink;
          }
        }
      }
    } catch {
      // fallback to default targetUrl
    }

    console.log(`Fetching Timetable from ${targetUrl}...`);
    const res = await fetch(targetUrl, { credentials: 'same-origin' });
    if (!res.ok) {
      console.warn(`Timetable request returned HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Extract Class Name
    let className = '';
    const classBtn = doc.querySelector('.manual_bn');
    if (classBtn?.textContent) {
      className = classBtn.textContent.replace(/^Class\s*:\s*/i, '').trim();
    } else {
      const classInput = doc.querySelector('#class_name') as HTMLInputElement | null;
      if (classInput?.value) className = classInput.value;
    }

    // Extract Schedule
    const schedule: Timetable['schedule'] = {
      monday: {},
      tuesday: {},
      wednesday: {},
      thursday: {},
      friday: {},
      saturday: {},
    };

    const forms = Array.from(doc.querySelectorAll('.period_form'));

    if (forms.length > 0) {
      forms.forEach(form => {
        const dayInput = form.querySelector('input[name="day"]') as HTMLInputElement | null;
        const periodInput = form.querySelector('input[name="period"]') as HTMLInputElement | null;
        const idInput = form.querySelector('input[name="id"]') as HTMLInputElement | null;
        const subjectIdInput = form.querySelector('input[name="subject_id"]') as HTMLInputElement | null;
        const userNameIdInput = form.querySelector('input[name="user_name_id"]') as HTMLInputElement | null;

        const day = (dayInput?.value || '').toLowerCase().trim();
        const period = parseInt(periodInput?.value || '0', 10);
        if (!day || !period || isNaN(period)) return;

        let rawSubject = '';
        let rawStaff = '';

        const primaries = Array.from(form.querySelectorAll('.text-primary'));
        if (primaries.length >= 1) rawSubject = primaries[0].textContent?.trim() || '';
        if (primaries.length >= 2) rawStaff = primaries[1].textContent?.trim() || '';

        if (!rawSubject || !rawStaff) {
          const bTags = Array.from(form.querySelectorAll('b'));
          bTags.forEach((b, idx) => {
            const txt = b.textContent?.trim().toLowerCase() || '';
            if (txt === 'subject' && bTags[idx + 1]) rawSubject = bTags[idx + 1].textContent?.trim() || '';
            if (txt === 'staff' && bTags[idx + 1]) rawStaff = bTags[idx + 1].textContent?.trim() || '';
          });
        }

        rawSubject = rawSubject.replace(/\s+/g, ' ').trim();
        rawStaff = rawStaff.replace(/\s+/g, ' ').trim();

        let subjectName = rawSubject;
        let subjectCode = '';
        const subMatch = rawSubject.match(/^(.*?)\s*\(([^)]+)\)$/s);
        if (subMatch) {
          subjectName = subMatch[1].trim();
          subjectCode = subMatch[2].trim();
        }

        let staffName = rawStaff;
        let staffCode = '';
        const staffMatch = rawStaff.match(/^(.*?)\s*\(([^)]+)\)$/s);
        if (staffMatch) {
          staffName = staffMatch[1].trim();
          staffCode = staffMatch[2].trim();
        }

        const entry: TimetableEntry = {
          subjectName,
          subjectCode,
          staffName,
          staffCode,
          id: idInput?.value || undefined,
          subjectId: subjectIdInput?.value || undefined,
          userNameId: userNameIdInput?.value || undefined,
        };

        if (!schedule[day]) schedule[day] = {};
        if (!schedule[day][period]) schedule[day][period] = [];

        const isDup = schedule[day][period].some(
          e => e.subjectCode === entry.subjectCode && e.staffName === entry.staffName && e.id === entry.id
        );
        if (!isDup) {
          schedule[day][period].push(entry);
        }
      });
    }

    const urlParts = targetUrl.split('/');
    const possibleId = urlParts[urlParts.length - 1];
    const studentId = /^\d+$/.test(possibleId) ? possibleId : undefined;

    return {
      className: className || 'B.Tech Timetable',
      studentId,
      schedule,
    };
  } catch (err) {
    console.error('Failed to fetch timetable:', err);
    return null;
  }
}

// ─── Fetch Student Profile on demand ──────────────────────────────────────────

export async function fetchStudentProfile(_csrfToken: string): Promise<StudentProfile | null> {
  try {
    let profileUrl = '';

    try {
      const reportRes = await fetch('/ims/admin/grade/student/mark/report', { credentials: 'same-origin' });
      if (reportRes.ok) {
        const reportHtml = await reportRes.text();
        const doc = new DOMParser().parseFromString(reportHtml, 'text/html');
        const link = doc.querySelector('a[href*="/Profile-view"]');
        if (link) {
          const href = link.getAttribute('href') || '';
          if (href.startsWith('https://ims.ritchennai.edu.in')) {
            profileUrl = href.replace('https://ims.ritchennai.edu.in', '/ims');
          } else if (href.startsWith('/')) {
            profileUrl = '/ims' + href;
          } else {
            profileUrl = '/ims/admin/students/' + href;
          }
        }
      }
    } catch {
      // fallback
    }

    if (!profileUrl) {
      console.warn('Could not discover Profile-view URL from portal menu.');
      return null;
    }

    console.log(`Fetching Student Profile from ${profileUrl}...`);
    const res = await fetch(profileUrl, { credentials: 'same-origin' });
    if (!res.ok) {
      console.warn(`Profile request failed with status ${res.status}`);
      return null;
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const rawFields: Record<string, string> = {};
    const fieldMapBySection: Record<string, ProfileField[]> = {};

    const avatarEl = doc.querySelector('.profile-user-img, img[src*="student"], img[src*="profile"], .user-header img, img.img-circle') as HTMLImageElement | null;
    let avatarUrl = avatarEl?.getAttribute('src') || undefined;
    if (avatarUrl && avatarUrl.startsWith('/')) {
      avatarUrl = '/ims' + avatarUrl;
    }

    const formatLabel = (str: string): string => {
      return str
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
    };

    const addField = (sectionName: string, label: string, val: string) => {
      const cleanLabel = formatLabel(label);
      const cleanVal = val.trim();
      if (!cleanLabel || !cleanVal || cleanLabel.toLowerCase() === '_token') return;

      rawFields[cleanLabel] = cleanVal;

      const secKey = sectionName || 'General Information';
      if (!fieldMapBySection[secKey]) fieldMapBySection[secKey] = [];

      const exists = fieldMapBySection[secKey].some(f => f.label.toLowerCase() === cleanLabel.toLowerCase());
      if (!exists) {
        fieldMapBySection[secKey].push({ label: cleanLabel, value: cleanVal });
      }
    };

    // Parse form controls (inputs, selects, textareas)
    const formElements = Array.from(doc.querySelectorAll('input, select, textarea'));
    formElements.forEach(el => {
      const nameAttr = el.getAttribute('name') || el.getAttribute('id') || '';
      if (!nameAttr || nameAttr === '_token' || nameAttr === '_method') return;

      let value = '';
      if (el.tagName === 'SELECT') {
        const select = el as HTMLSelectElement;
        const selectedOpt = select.options[select.selectedIndex];
        value = selectedOpt ? selectedOpt.text.trim() : select.value;
      } else {
        value = (el as HTMLInputElement).value || el.getAttribute('value') || '';
      }

      if (!value) return;

      const container = el.closest('.card, .box, .tab-pane, fieldset, form');
      const sectionTitle = container?.querySelector('.card-title, .box-title, h3, h4, legend')?.textContent?.trim() || 'Personal Information';

      let labelText = '';
      const labelEl = el.closest('.form-group, .col-md-6, .col-md-4, tr')?.querySelector('label, th, b, strong');
      if (labelEl && labelEl.textContent) {
        labelText = labelEl.textContent.replace('*', '').replace(':', '').trim();
      }
      if (!labelText) labelText = nameAttr;

      addField(sectionTitle, labelText, value);
    });

    // Parse table rows and info pairs
    const rows = Array.from(doc.querySelectorAll('tr, dl, .profile-info-row, .row'));
    rows.forEach(row => {
      const container = row.closest('.card, .box, .tab-pane');
      const sectionTitle = container?.querySelector('.card-title, .box-title, h3, h4')?.textContent?.trim() || 'Profile Information';

      const ths = Array.from(row.querySelectorAll('th'));
      const tds = Array.from(row.querySelectorAll('td'));

      if (ths.length > 0 && tds.length > 0 && ths.length === tds.length) {
        for (let i = 0; i < ths.length; i++) {
          const l = ths[i].textContent?.replace(':', '').trim() || '';
          const v = tds[i].textContent?.trim() || '';
          if (l && v) addField(sectionTitle, l, v);
        }
      } else if (tds.length >= 2) {
        for (let i = 0; i < tds.length - 1; i += 2) {
          const l = tds[i].textContent?.replace(':', '').trim() || '';
          const v = tds[i + 1].textContent?.trim() || '';
          if (l && v && l.length < 40 && !l.includes('\n')) {
            addField(sectionTitle, l, v);
          }
        }
      }

      const text = row.textContent || '';
      if (text.includes(':') && !row.querySelector('input, select, textarea')) {
        const parts = text.split(':');
        if (parts.length === 2) {
          const l = parts[0].trim();
          const v = parts[1].trim();
          if (l && v && l.length < 35 && v.length < 150 && !l.includes('\n')) {
            addField(sectionTitle, l, v);
          }
        }
      }
    });

    const findRaw = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        for (const [rk, rv] of Object.entries(rawFields)) {
          if (rk.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return rv;
          }
        }
      }
      return undefined;
    };

    const name = findRaw('name', 'fullname', 'studentname') || 'Student Profile';
    const regNo = findRaw('register', 'regno', 'rollno', 'username') || '';
    const email = findRaw('email', 'mail') || '';
    const mobile = findRaw('mobile', 'phone', 'contact') || '';
    const dob = findRaw('dob', 'dateofbirth', 'birthdate');
    const age = findRaw('age');
    const gender = findRaw('gender', 'sex');
    const bloodGroup = findRaw('bloodgroup', 'blood');
    const community = findRaw('community', 'category');
    const religion = findRaw('religion');
    const motherTongue = findRaw('mothertongue', 'tongue');
    const caste = findRaw('caste');
    const aadharNo = findRaw('aadhar', 'adharnumber');
    const state = findRaw('state');
    const country = findRaw('country', 'nationality');
    const department = findRaw('department', 'branch', 'course');
    const classSection = findRaw('class', 'section');
    const batch = findRaw('batch', 'academicyear');
    const fatherName = findRaw('fathername', 'father');
    const fatherMobile = findRaw('fathermobile', 'fatherphone');
    const motherName = findRaw('mothername', 'mother');
    const guardianName = findRaw('guardianname', 'guardian');
    const address = findRaw('address', 'communicationaddress');
    const permanentAddress = findRaw('permanentaddress');

    // Categorize sections into standardized groups
    const categorizeSectionTitle = (rawTitle: string): string => {
      const lower = rawTitle.toLowerCase();
      if (lower.includes('parent') || lower.includes('father') || lower.includes('mother') || lower.includes('family') || lower.includes('guardian')) {
        return 'Parent & Guardian Information';
      }
      if (lower.includes('academic') || lower.includes('course') || lower.includes('college') || lower.includes('branch') || lower.includes('degree') || lower.includes('class')) {
        return 'Academic & Program Details';
      }
      if (lower.includes('address') || lower.includes('contact') || lower.includes('location') || lower.includes('communication')) {
        return 'Contact & Address Details';
      }
      if (lower.includes('personal') || lower.includes('basic') || lower.includes('general') || lower.includes('student')) {
        return 'Personal Information';
      }
      return rawTitle.replace(/\s+/g, ' ').trim() || 'General Information';
    };

    const categorizedMap: Record<string, ProfileField[]> = {};
    Object.entries(fieldMapBySection).forEach(([rawTitle, fields]) => {
      const cat = categorizeSectionTitle(rawTitle);
      if (!categorizedMap[cat]) categorizedMap[cat] = [];
      fields.forEach(f => {
        if (!categorizedMap[cat].some(ef => ef.label.toLowerCase() === f.label.toLowerCase())) {
          categorizedMap[cat].push(f);
        }
      });
    });

    const sections: ProfileSection[] = Object.entries(categorizedMap).map(([title, fields]) => ({
      title,
      fields,
    }));

    // Fetch dedicated Leave & OD history
    const leaves = await fetchLeaveHistory(_csrfToken);

    return {
      name,
      regNo,
      email,
      mobile,
      avatarUrl,
      dob,
      age,
      gender,
      bloodGroup,
      community,
      religion,
      motherTongue,
      caste,
      aadharNo,
      state,
      country,
      department,
      classSection,
      batch,
      fatherName,
      fatherMobile,
      motherName,
      guardianName,
      address,
      permanentAddress,
      leaves,
      sections: sections.length > 0 ? sections : [{ title: 'Personal Information', fields: Object.entries(rawFields).map(([label, value]) => ({ label, value })) }],
      rawFields,
    };
  } catch (err) {
    console.error('Failed to fetch student profile:', err);
    return null;
  }
}

// ─── Fetch Leave / OD History ─────────────────────────────────────────────────

export async function fetchLeaveHistory(_csrfToken: string): Promise<LeaveEntry[]> {
  const leaves: LeaveEntry[] = [];
  try {
    const res = await fetch('/ims/admin/student-request-leaves/index', { credentials: 'same-origin' });
    if (!res.ok) return leaves;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return leaves;

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 5) {
        const type = cells[1]?.textContent?.replace(/\s+/g, ' ').trim() || 'Leave';
        const fromDate = cells[2]?.textContent?.trim() || '';
        const toDate = cells[3]?.textContent?.trim() || '';
        const noOfDays = cells[4]?.textContent?.trim() || '1';
        const reason = cells[5]?.textContent?.replace(/\s+/g, ' ').trim() || type;
        const statusRaw = cells[6]?.textContent?.trim() || cells[cells.length - 1]?.textContent?.trim() || 'Approved';
        const status = statusRaw.toLowerCase().includes('approve') ? 'Approved' : statusRaw.toLowerCase().includes('reject') ? 'Rejected' : 'Pending';

        if (fromDate || toDate || type) {
          leaves.push({ type, fromDate, toDate, noOfDays, reason, status });
        }
      }
    });
  } catch (err) {
    console.warn('Failed to fetch leave history:', err);
  }
  return leaves;
}

// ─── Fetch Assignment Marks on demand ─────────────────────────────────────────

export async function fetchAssignmentMarks(_csrfToken: string): Promise<AssignmentMark[]> {
  const marksMap: Record<string, AssignmentMark> = {};
  try {
    const res = await fetch('/ims/admin/assignment/student/mark/report', { credentials: 'same-origin' });
    if (!res.ok) return [];

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length >= 4) {
        const c0 = cells[0]?.textContent?.trim() || '';
        const c1 = cells[1]?.textContent?.trim() || '';
        const faculty = cells[2]?.textContent?.trim() || '';

        let code = c1;
        let title = c0;
        if (/^[A-Z]{2,4}\d+$/i.test(c0) && !/^[A-Z]{2,4}\d+$/i.test(c1)) {
          code = c0;
          title = c1;
        }

        const a1 = cells[3]?.textContent?.trim() || '';
        const a2 = cells[4]?.textContent?.trim() || '';
        const a3 = cells[5]?.textContent?.trim() || '';
        const a4 = cells[6]?.textContent?.trim() || '';
        const a5 = cells[7]?.textContent?.trim() || '';
        const tot = cells[8]?.textContent?.trim() || cells[cells.length - 1]?.textContent?.trim() || '';

        if (!code && !title) return;

        const key = `${code}-${title}`.toLowerCase();

        if (!marksMap[key]) {
          marksMap[key] = {
            code,
            title,
            faculty,
            a1,
            a2,
            a3,
            a4,
            a5,
            total: tot,
          };
        } else {
          const existing = marksMap[key];
          if (!existing.a1 && a1) existing.a1 = a1;
          if (!existing.a2 && a2) existing.a2 = a2;
          if (!existing.a3 && a3) existing.a3 = a3;
          if (!existing.a4 && a4) existing.a4 = a4;
          if (!existing.a5 && a5) existing.a5 = a5;
          if (!existing.faculty && faculty) existing.faculty = faculty;

          const sum = [existing.a1, existing.a2, existing.a3, existing.a4, existing.a5]
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v))
            .reduce((acc, curr) => acc + curr, 0);

          existing.total = sum > 0 ? String(sum) : (tot || existing.total);
        }
      }
    });
  } catch (err) {
    console.warn('Failed to fetch assignment marks:', err);
  }
  return Object.values(marksMap);
}

// ─── Fetch Academic Fee Details ───────────────────────────────────────────────

export async function fetchAcademicFee(csrfToken: string): Promise<AcademicFeeData | null> {
  try {
    const res = await fetch('/ims/admin/fee-payment/get-data', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'X-CSRF-TOKEN': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!res.ok) {
      console.warn(`Fee API request failed with status ${res.status}`);
      return null;
    }

    const raw = await res.json();
    if (!raw.status || !raw.data) return null;

    const data = raw.data;
    const feeItemsRaw = data.feeData || [];

    let totalFeeAmount = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;

    const feeRecords: FeeYearItem[] = feeItemsRaw.map((item: any) => {
      const totalFee = parseFloat(item.total_fee) || 0;
      const paidFee = parseFloat(item.paid_fee) || 0;
      const pendingFee = Math.max(0, totalFee - paidFee);

      totalFeeAmount += totalFee;
      totalPaidAmount += paidFee;
      totalPendingAmount += pendingFee;

      return {
        academicYear: item.academic_year || 'Current Year',
        paidDate: item.paid_date || 'N/A',
        tuitionFee: Number(item.tuition_fee) || 0,
        hostelFee: Number(item.hostel_fee) || 0,
        otherFee: Number(item.other_fee) || 0,
        fine: Number(item.fine) || 0,
        breakage: Number(item.breakage) || 0,
        auFee: Number(item.au_fee) || 0,
        openingBalance: Number(item.opening_balance) || 0,
        reversalAmt: Number(item.reversal_amt) || 0,
        totalFee,
        paidFee,
        pendingFee,
        isFullyPaid: pendingFee === 0,
      };
    });

    return {
      admittedMode: data.admitted_mode || 'GENERAL',
      isFirstGraduate: data.first_graduate === '1',
      isScholarship: data.scholarship === '1',
      isHosteler: data.hosteler === '1',
      courseName: data.course?.name || 'B.Tech Program',
      courseShort: data.course?.short_form || 'B.Tech',
      feeRecords,
      totalFeeAmount,
      totalPaidAmount,
      totalPendingAmount,
    };
  } catch (err) {
    console.error('Failed to fetch academic fee:', err);
    return null;
  }
}

export async function fetchExamFeeData(csrfToken: string): Promise<ExamFeeData> {
  const feeRes = await fetch('/ims/admin/exam-fee/get-data', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-CSRF-TOKEN': csrfToken,
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  if (!feeRes.ok) throw new Error(`HTTP ${feeRes.status} fetching current exam fees`);
  const feeJson = await feeRes.json();

  const historyRes = await fetch('/ims/admin/exam-fee-details/get-history', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-CSRF-TOKEN': csrfToken,
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  if (!historyRes.ok) throw new Error(`HTTP ${historyRes.status} fetching exam fee history`);
  const historyJson = await historyRes.json();

  return {
    fees: feeJson.status && feeJson.data ? feeJson.data : [],
    history: historyJson.status && historyJson.data ? historyJson.data : {}
  };
}
