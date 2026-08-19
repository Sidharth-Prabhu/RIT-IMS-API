import type { Context, Config } from "@netlify/edge-functions";
import { parse } from "https://esm.sh/node-html-parser@9.0.1";

export const config: Config = {
  path: "/api/*",
};

// ─── Cryptography Helper for Opaque Stateless Sessions ────────────────────────

const SESSION_SECRET = Deno.env.get("SESSION_SECRET") || "default-session-crypt-secret-key-32-chars-long";

async function getCryptoKey(): Promise<CryptoKey> {
  const rawKey = new TextEncoder().encode(SESSION_SECRET.padEnd(32, "0").slice(0, 32));
  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptSession(data: any): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function decryptSession(token: string): Promise<any | null> {
  try {
    const key = await getCryptoKey();
    const binaryStr = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (_err) {
    return null;
  }
}

// ─── Cookie Utilities ─────────────────────────────────────────────────────────

function parseSetCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const parts = header.split(";")[0].split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      cookies[key] = val;
    }
  }
  return cookies;
}

function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, val]) => `${key}=${val}`)
    .join("; ");
}

// ─── Header Helper ────────────────────────────────────────────────────────────

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getUpstreamHeaders(cookies: Record<string, string>, csrfToken?: string): Headers {
  const headers = new Headers();
  headers.set("User-Agent", USER_AGENT);
  headers.set("Accept", "application/json, text/html, */*");
  headers.set("Cookie", serializeCookies(cookies));
  if (csrfToken) {
    headers.set("X-CSRF-TOKEN", csrfToken);
  }
  return headers;
}

// ─── JSON Response Helpers ────────────────────────────────────────────────────

function jsonResponse(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({
    success: false,
    error: code,
    message,
  }, status);
}

// ─── API Request Handler ──────────────────────────────────────────────────────

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Enable CORS
  const origin = request.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: new Headers(corsHeaders) });
  }

  // 1. Unauthenticated Health Endpoints
  if (path === "/api/health") {
    return jsonResponse({ success: true, status: "ok" }, 200, corsHeaders);
  }

  if (path === "/api/health/upstream") {
    try {
      const upRes = await fetch("https://ims.ritchennai.edu.in/login", { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
      return jsonResponse({
        success: true,
        api: "ok",
        upstream_ims: upRes.ok ? "reachable" : "error_status_" + upRes.status
      }, 200, corsHeaders);
    } catch (_err) {
      return jsonResponse({ success: true, api: "ok", upstream_ims: "unreachable" }, 200, corsHeaders);
    }
  }

  // 2. Login Endpoint
  if (path === "/api/auth/login" && request.method === "POST") {
    try {
      const { username, password } = await request.json();
      if (!username || !password) {
        return errorResponse("INVALID_REQUEST", "Username and password are required.", 400);
      }

      // Step A: Fetch login page & get CSRF
      const getLoginRes = await fetch("https://ims.ritchennai.edu.in/login", {
        headers: { "User-Agent": USER_AGENT }
      });
      if (!getLoginRes.ok) {
        return errorResponse("UPSTREAM_UNAVAILABLE", "RIT IMS Portal is currently down.", 502);
      }

      const getCookies = parseSetCookies(getLoginRes.headers.getSetCookie?.() || []);
      const loginHtml = await getLoginRes.text();
      const doc = parse(loginHtml);
      const initCsrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ||
                       doc.querySelector('input[name="_token"]')?.getAttribute("value") || "";

      if (!initCsrf) {
        return errorResponse("UPSTREAM_ERROR", "Failed to initialize session. CSRF token missing.", 502);
      }

      // Step B: Post credentials
      const loginHeaders = getUpstreamHeaders(getCookies, initCsrf);
      loginHeaders.set("Content-Type", "application/x-www-form-urlencoded");
      loginHeaders.set("X-Requested-With", "XMLHttpRequest");

      const authRes = await fetch("https://ims.ritchennai.edu.in/login", {
        method: "POST",
        headers: loginHeaders,
        body: new URLSearchParams({ _token: initCsrf, email: username, password }),
        redirect: "manual"
      });

      // Parse fresh cookies from authentication response
      const authCookies = { ...getCookies, ...parseSetCookies(authRes.headers.getSetCookie?.() || []) };

      // Step C: Request dashboard to retrieve the authenticated CSRF token & verify access
      const reportHeaders = getUpstreamHeaders(authCookies);
      const reportRes = await fetch("https://ims.ritchennai.edu.in/admin/grade/student/mark/report", {
        headers: reportHeaders
      });

      const reportHtml = await reportRes.text();
      const reportDoc = parse(reportHtml);

      // Check if redirected or unauthenticated
      if (reportRes.url.includes("/login") || reportHtml.includes("http-equiv=\"refresh\"") || !reportDoc.querySelector('meta[name="csrf-token"]')) {
        return errorResponse("INVALID_CREDENTIALS", "The IMS username or password is incorrect.", 401);
      }

      const finalCookies = { ...authCookies, ...parseSetCookies(reportRes.headers.getSetCookie?.() || []) };
      const authenticatedCsrf = reportDoc.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

      // Step C.2: Fetch the main admin dashboard to parse metrics
      let dashboardStats = { cgpa: "N/A", arrears: "N/A", attendance: "N/A", pendingFees: "N/A" };
      try {
        const adminRes = await fetch("https://ims.ritchennai.edu.in/admin", {
          headers: getUpstreamHeaders(finalCookies)
        });
        if (adminRes.ok) {
          const adminHtml = await adminRes.text();
          const adminDoc = parse(adminHtml);
          
          const extractMetric = (labelRegex: RegExp, valueRegex: RegExp): string => {
            const elements = adminDoc.querySelectorAll("p, span, h3, h4, h1, td, th, b, strong, li, div");
            for (const el of elements) {
              const text = (el.textContent || "").trim();
              if (labelRegex.test(text) && text.length < 50) {
                // Check immediate siblings
                let sibling = el.nextElementSibling;
                while (sibling) {
                  const sibText = (sibling.textContent || "").trim();
                  const match = sibText.match(valueRegex);
                  if (match) return match[1] || match[0];
                  sibling = sibling.nextElementSibling;
                }
                sibling = el.previousElementSibling;
                while (sibling) {
                  const sibText = (sibling.textContent || "").trim();
                  const match = sibText.match(valueRegex);
                  if (match) return match[1] || match[0];
                  sibling = sibling.previousElementSibling;
                }
                
                // Check direct parent wrapper
                const parent = el.parentElement;
                if (parent) {
                  const parentText = (parent.textContent || "").trim();
                  const cleanParentText = parentText.replace(text, "");
                  const match = cleanParentText.match(valueRegex);
                  if (match) return match[1] || match[0];
                }
              }
            }
            return "N/A";
          };

          dashboardStats.cgpa = extractMetric(/\bCGPA\b/i, /(\d+\.\d+)/);
          dashboardStats.arrears = extractMetric(/\barrears?\b/i, /\b(\d+)\b/);
          dashboardStats.attendance = extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?\s*%)/) || extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?)/);
          dashboardStats.pendingFees = extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /(?:Rs\.?|₹)\s*([\d,]+)/) || 
                                       extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /\b([\d,]+)\b/);
        }
      } catch (adminErr) {
        console.warn("Failed to fetch dashboard metrics:", adminErr);
      }

      // Step D: Create Encrypted Opaque Session Token
      const sessionData = {
        cookies: finalCookies,
        csrfToken: authenticatedCsrf,
        username,
        createdAt: Date.now()
      };
      const apiToken = await encryptSession(sessionData);

      return jsonResponse({
        success: true,
        message: "Authentication successful",
        session: apiToken,
        dashboard: dashboardStats
      }, 200, corsHeaders);

    } catch (err: any) {
      return errorResponse("INTERNAL_SERVER_ERROR", err.message || "An unexpected error occurred.", 500);
    }
  }

  // 3. Authenticate Bearer Session Token for subsequent endpoints
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid Authorization header.", 401);
  }

  const token = authHeader.substring(7);
  const session = await decryptSession(token);
  if (!session) {
    return errorResponse("IMS_SESSION_EXPIRED", "The upstream IMS session is not authenticated.", 401);
  }

  // Helper to verify upstream response is not redirecting
  function checkSessionValidity(html: string, res: Response): boolean {
    if (res.url.includes("/login") || html.includes("http-equiv=\"refresh\"") || html.includes("Redirecting to")) {
      return false;
    }
    return true;
  }

  // Helper to fetch upstream content
  async function fetchUpstream(endpoint: string, method = "GET", body: any = null): Promise<{ html: string; res: Response; error?: Response }> {
    const upstreamUrl = `https://ims.ritchennai.edu.in${endpoint}`;
    const headers = getUpstreamHeaders(session.cookies, session.csrfToken);
    
    let fetchBody = null;
    if (method === "POST" && body) {
      headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
      headers.set("X-Requested-With", "XMLHttpRequest");
      fetchBody = new URLSearchParams(body);
    }

    try {
      const res = await fetch(upstreamUrl, { method, headers, body: fetchBody });
      const html = await res.text();
      if (!checkSessionValidity(html, res)) {
        return { html, res, error: errorResponse("IMS_SESSION_EXPIRED", "The upstream IMS session has expired. Please authenticate again.", 401) };
      }
      return { html, res };
    } catch (_err) {
      return { html: "", res: new Response(), error: errorResponse("UPSTREAM_UNAVAILABLE", "Failed to communicate with RIT IMS.", 502) };
    }
  }

  // 4. Logout Endpoint
  if (path === "/api/auth/logout" && request.method === "POST") {
    // Invalidate upstream session
    await fetchUpstream("/admin/logout-rit", "POST", { _token: session.csrfToken });
    return jsonResponse({ success: true, message: "Logged out successfully" }, 200, corsHeaders);
  }

  // 4.1. Student Dashboard Metrics Endpoint
  if (path === "/api/student/dashboard" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin");
    if (error) return error;

    const adminDoc = parse(html);
    const dashboardStats = { cgpa: "N/A", arrears: "N/A", attendance: "N/A", pendingFees: "N/A" };

    const extractMetric = (labelRegex: RegExp, valueRegex: RegExp): string => {
      const elements = adminDoc.querySelectorAll("p, span, h3, h4, h1, td, th, b, strong, li, div");
      for (const el of elements) {
        const text = (el.textContent || "").trim();
        if (labelRegex.test(text) && text.length < 50) {
          // Check immediate siblings
          let sibling = el.nextElementSibling;
          while (sibling) {
            const sibText = (sibling.textContent || "").trim();
            const match = sibText.match(valueRegex);
            if (match) return match[1] || match[0];
            sibling = sibling.nextElementSibling;
          }
          sibling = el.previousElementSibling;
          while (sibling) {
            const sibText = (sibling.textContent || "").trim();
            const match = sibText.match(valueRegex);
            if (match) return match[1] || match[0];
            sibling = sibling.previousElementSibling;
          }
          
          // Check direct parent wrapper
          const parent = el.parentElement;
          if (parent) {
            const parentText = (parent.textContent || "").trim();
            const cleanParentText = parentText.replace(text, "");
            const match = cleanParentText.match(valueRegex);
            if (match) return match[1] || match[0];
          }
        }
      }
      return "N/A";
    };

    dashboardStats.cgpa = extractMetric(/\bCGPA\b/i, /(\d+\.\d+)/);
    dashboardStats.arrears = extractMetric(/\barrears?\b/i, /\b(\d+)\b/);
    dashboardStats.attendance = extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?\s*%)/) || extractMetric(/\battendance\b/i, /(\d+(?:\.\d+)?)/);
    dashboardStats.pendingFees = extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /(?:Rs\.?|₹)\s*([\d,]+)/) || 
                                 extractMetric(/(?:pending|due|balance|academic)\s*fees?/i, /\b([\d,]+)\b/);

    return jsonResponse({
      success: true,
      data: dashboardStats
    }, 200, corsHeaders);
  }

  // 5. Student Profile Endpoint
  if (path === "/api/student/profile" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/students/Profile-view");
    if (error) return error;

    const doc = parse(html);
    const rawFields: Record<string, string> = {};

    // Parser matching main website
    const addField = (label: string, val: string) => {
      const cleanLabel = label.replace(/:/g, "").replace(/\*/g, "").trim().toLowerCase();
      const cleanVal = val.trim();
      if (cleanLabel && cleanVal && cleanLabel !== "_token") {
        rawFields[cleanLabel] = cleanVal;
      }
    };

    doc.querySelectorAll("tr, dl, .profile-info-row, .row").forEach(row => {
      const ths = row.querySelectorAll("th");
      const tds = row.querySelectorAll("td");
      if (ths.length > 0 && tds.length > 0 && ths.length === tds.length) {
        for (let i = 0; i < ths.length; i++) {
          addField(ths[i].textContent || "", tds[i].textContent || "");
        }
      } else if (tds.length >= 2) {
        for (let i = 0; i < tds.length - 1; i += 2) {
          addField(tds[i].textContent || "", tds[i + 1].textContent || "");
        }
      }
    });

    const findField = (...keys: string[]): string => {
      for (const k of keys) {
        const matchKey = Object.keys(rawFields).find(rk => rk.includes(k.toLowerCase()));
        if (matchKey) return rawFields[matchKey];
      }
      return "";
    };

    const name = findField("name", "fullname") || "Student";
    const register_number = findField("register", "regno", "rollno") || session.username;
    const department = findField("department", "branch", "course") || "";
    const batch = findField("batch", "academic year") || "";

    return jsonResponse({
      success: true,
      data: {
        name,
        register_number,
        department,
        batch
      }
    }, 200, corsHeaders);
  }

  // 6. Attendance Endpoint
  if (path === "/api/student/attendance" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/student-personal-attendance/report");
    if (error) return error;

    const doc = parse(html);
    const subjects: any[] = [];
    const table = doc.querySelector("#studentAttendence") || doc.querySelector("table");

    if (table) {
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 8) {
          const code = cells[2].textContent?.trim() || "";
          const name = cells[3].textContent?.trim() || "";
          const present = parseInt(cells[5].textContent?.trim() || "0", 10);
          const conducted = parseInt(cells[6].textContent?.trim() || "0", 10);
          const absent = Math.max(0, conducted - present);
          const percentage = parseFloat(cells[7].textContent?.trim() || "0");
          if (code && name) {
            subjects.push({ code, name, conducted, present, absent, percentage });
          }
        }
      });
    }

    return jsonResponse({ success: true, data: { subjects } }, 200, corsHeaders);
  }

  // 7. Timetable Endpoint
  if (path === "/api/student/timetable" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/student-time-table");
    if (error) return error;

    const doc = parse(html);
    const schedule: Record<string, Record<number, any[]>> = {
      monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}
    };

    doc.querySelectorAll(".period_form").forEach(form => {
      const dayInput = form.querySelector('input[name="day"]') as any;
      const periodInput = form.querySelector('input[name="period"]') as any;
      const day = (dayInput?.getAttribute("value") || "").toLowerCase().trim();
      const period = parseInt(periodInput?.getAttribute("value") || "0", 10);

      if (!day || !period || isNaN(period)) return;

      let rawSubject = "";
      let rawStaff = "";
      const primaries = form.querySelectorAll(".text-primary");
      if (primaries.length >= 1) rawSubject = primaries[0].textContent?.trim() || "";
      if (primaries.length >= 2) rawStaff = primaries[1].textContent?.trim() || "";

      let subjectName = rawSubject;
      let subjectCode = "";
      const subMatch = rawSubject.match(/^(.*?)\s*\(([^)]+)\)$/s);
      if (subMatch) {
        subjectName = subMatch[1].trim();
        subjectCode = subMatch[2].trim();
      }

      let staffName = rawStaff;
      let staffCode = "";
      const staffMatch = rawStaff.match(/^(.*?)\s*\(([^)]+)\)$/s);
      if (staffMatch) {
        staffName = staffMatch[1].trim();
        staffCode = staffMatch[2].trim();
      }

      if (!schedule[day]) schedule[day] = {};
      if (!schedule[day][period]) schedule[day][period] = [];

      schedule[day][period].push({ subjectName, subjectCode, staffName, staffCode });
    });

    return jsonResponse({ success: true, data: { schedule } }, 200, corsHeaders);
  }

  // 8. CAT Marks Endpoint
  if (path === "/api/student/cat-marks" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/student-cat-mark/report");
    if (error) return error;

    const doc = parse(html);
    const subjects: any[] = [];
    const table = doc.querySelector("table");

    if (table) {
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 6) {
          const code = cells[0].textContent?.trim() || "";
          const name = cells[1].textContent?.trim() || "";
          const co1 = cells[3]?.textContent?.trim() || "";
          const co2 = cells[4]?.textContent?.trim() || "";
          const total = cells[5]?.textContent?.trim() || "";
          const weightage = cells[6]?.textContent?.trim() || "";
          if (code && name) {
            subjects.push({ code, name, co1, co2, total, weightage });
          }
        }
      });
    }

    return jsonResponse({ success: true, data: { subjects } }, 200, corsHeaders);
  }

  // 9. Assignment Marks Endpoint
  if (path === "/api/student/assignment-marks" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/assignment/student/mark/report");
    if (error) return error;

    const doc = parse(html);
    const subjects: any[] = [];
    const table = doc.querySelector("table");

    if (table) {
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 8) {
          const code = cells[0]?.textContent?.trim() || cells[1]?.textContent?.trim() || "";
          const name = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || "";
          const a1 = cells[3]?.textContent?.trim() || "";
          const a2 = cells[4]?.textContent?.trim() || "";
          const a3 = cells[5]?.textContent?.trim() || "";
          const a4 = cells[6]?.textContent?.trim() || "";
          const a5 = cells[7]?.textContent?.trim() || "";
          const total = cells[8]?.textContent?.trim() || "";
          if (code && name) {
            subjects.push({ code, name, a1, a2, a3, a4, a5, total });
          }
        }
      });
    }

    return jsonResponse({ success: true, data: { subjects } }, 200, corsHeaders);
  }

  // 10. Leaves Endpoint
  if (path === "/api/student/leaves" && request.method === "GET") {
    const { html, error } = await fetchUpstream("/admin/student-request-leaves/index");
    if (error) return error;

    const doc = parse(html);
    const leaves: any[] = [];
    const table = doc.querySelector("table");

    if (table) {
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 5) {
          const type = cells[1]?.textContent?.trim() || "";
          const fromDate = cells[2]?.textContent?.trim() || "";
          const toDate = cells[3]?.textContent?.trim() || "";
          const noOfDays = cells[4]?.textContent?.trim() || "1";
          const reason = cells[5]?.textContent?.trim() || type;
          const status = cells[6]?.textContent?.trim() || "Approved";
          leaves.push({ type, fromDate, toDate, noOfDays, reason, status });
        }
      });
    }

    return jsonResponse({ success: true, data: { leaves } }, 200, corsHeaders);
  }

  // 11. Results Endpoint
  if (path === "/api/student/results" && (request.method === "GET" || request.method === "POST")) {
    let semesterStr = "";
    if (request.method === "POST") {
      try {
        const json = await request.json();
        semesterStr = String(json.semester || "");
      } catch (_e) {
        return errorResponse("INVALID_REQUEST", "Invalid JSON payload.", 400);
      }
    } else {
      semesterStr = url.searchParams.get("semester") || "";
    }

    const semester = parseInt(semesterStr, 10);
    if (isNaN(semester) || semester < 1 || semester > 8) {
      return errorResponse("INVALID_SEMESTER", "Semester must be a valid integer between 1 and 8.", 400);
    }

    // Call upstream grade fetch
    const { html, error } = await fetchUpstream("/admin/grade/student/mark/get_marks", "POST", {
      semester: String(semester)
    });
    if (error) return error;

    try {
      const raw = JSON.parse(html);
      const rawItems = raw.data || [];
      const data = rawItems.map((item: any) => {
        const course_code = item.subject_code || item.get_subject?.subject_code || "";
        const course_name = item.subject_name || item.get_subject?.name || "";
        const grade = (item.grade_letter || item.get_grade?.grade_letter || "U").trim().toUpperCase();
        const result = grade === "U" || grade === "RA" || grade === "F" ? "FAIL" : "PASS";
        
        return {
          course_code,
          course_name,
          internal_mark: item.internal_mark || 0,
          external_mark: item.external_mark || 0,
          total_mark: item.total_mark || 0,
          grade,
          result
        };
      });

      return jsonResponse({
        success: true,
        semester,
        data
      }, 200, corsHeaders);
    } catch (_e) {
      return errorResponse("UPSTREAM_ERROR", "Failed to parse grade data from upstream.", 502);
    }
  }

  // 12. Fee Endpoint
  if (path === "/api/student/fees" && request.method === "GET") {
    // Requires authenticated CSRF token
    const headers = getUpstreamHeaders(session.cookies, session.csrfToken);
    headers.set("X-Requested-With", "XMLHttpRequest");
    
    try {
      const res = await fetch("https://ims.ritchennai.edu.in/admin/fee-payment/get-data", {
        method: "GET", headers
      });
      const html = await res.text();
      if (!checkSessionValidity(html, res)) {
        return errorResponse("IMS_SESSION_EXPIRED", "The upstream IMS session has expired. Please authenticate again.", 401);
      }

      const raw = JSON.parse(html);
      if (!raw.status || !raw.data) {
        return errorResponse("UPSTREAM_ERROR", "Invalid response from upstream fee API.", 502);
      }

      const data = raw.data;
      const records = (data.feeData || []).map((item: any) => ({
        academic_year: item.academic_year || "Current",
        tuition_fee: Number(item.tuition_fee) || 0,
        hostel_fee: Number(item.hostel_fee) || 0,
        other_fee: Number(item.other_fee) || 0,
        total_fee: Number(item.total_fee) || 0,
        paid_fee: Number(item.paid_fee) || 0,
        pending_fee: Math.max(0, (Number(item.total_fee) || 0) - (Number(item.paid_fee) || 0)),
        paid_date: item.paid_date || "N/A"
      }));

      return jsonResponse({
        success: true,
        data: {
          total_fee: records.reduce((sum: number, r: any) => sum + r.total_fee, 0),
          paid: records.reduce((sum: number, r: any) => sum + r.paid_fee, 0),
          pending: records.reduce((sum: number, r: any) => sum + r.pending_fee, 0),
          transactions: records
        }
      }, 200, corsHeaders);

    } catch (_err) {
      return errorResponse("UPSTREAM_ERROR", "Failed to retrieve fee records.", 502);
    }
  }

  return errorResponse("NOT_FOUND", "API endpoint not found.", 404);
};
