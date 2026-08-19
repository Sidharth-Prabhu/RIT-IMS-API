# RIT IMS Grade Fetcher – React + Vite + Serverless Proxy

A clean React + Vite frontend that mirrors **rit-ims.vercel.app**:  
login with Register Number + Password → fetch academic data (semesters, subjects, grades, CGPA) → display analytics.

Because the official IMS (`ims.ritchennai.edu.in`) uses Laravel session + CSRF and blocks direct browser calls (CORS + auth), **all scraping must happen on a backend**. This guide uses **Vercel Serverless Functions** (same architecture as the original site).

> **Important**  
> - This is an educational reverse-engineering of a public third-party tool.  
> - Using it may violate the college’s terms of service. Use at your own risk.  
> - The exact payload of `/admin/grade/student/mark/get_marks` is not public; the backend example uses a realistic structure based on observed behaviour. You may need to adjust field names after inspecting a real browser request.

---

## 1. Project Setup

```bash
npm create vite@latest rit-ims-clone -- --template react
cd rit-ims-clone
npm install
npm install chart.js react-chartjs-2 lucide-react
```

Optional (nice UI):
```bash
npm install tailwindcss @tailwindcss/vite
```

Create the folder structure:

```
rit-ims-clone/
├── api/
│   └── grades.js          ← Vercel serverless function (the scraper)
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── LoginForm.jsx
│   │   ├── Dashboard.jsx
│   │   └── GradeTable.jsx
│   ├── lib/
│   │   └── processData.js
│   ├── index.css
│   └── main.jsx
├── vercel.json
└── package.json
```

---

## 2. `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 3. Backend – `api/grades.js` (Vercel Serverless)

This is the core that does the same work as the original site:

1. Receive `{ username, password, forceRefresh }`
2. Login to `ims.ritchennai.edu.in`
3. Call the marks endpoint
4. Return clean JSON  
5. (Optional) simple in-memory / KV cache that `forceRefresh` bypasses

```js
// api/grades.js
import { parse } from 'node-html-parser'; // or cheerio if you prefer

// Simple in-memory cache (for demo). In production use Vercel KV / Redis.
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password, forceRefresh = false } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  // Department restriction example (mirror original site)
  // if (!username.startsWith('...')) {
  //   return res.status(403).json({ success: false, message: 'Access Restricted: CSE & AIDS only' });
  // }

  const cacheKey = username.toLowerCase();

  if (!forceRefresh && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return res.status(200).json({ success: true, data: entry.data, cached: true });
    }
  }

  try {
    // ---------- 1. Get CSRF + cookies ----------
    const loginPage = await fetch('https://ims.ritchennai.edu.in/login', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const loginHtml = await loginPage.text();
    const cookies = loginPage.headers.getSetCookie?.() || [];
    const csrfMatch = loginHtml.match(/name="csrf-token" content="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : null;

    if (!csrf) throw new Error('Could not extract CSRF token');

    // ---------- 2. Login ----------
    const loginRes = await fetch('https://ims.ritchennai.edu.in/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-TOKEN': csrf,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0',
        Cookie: cookies.map(c => c.split(';')[0]).join('; ')
      },
      body: new URLSearchParams({
        _token: csrf,
        email: username,
        password: password
      }),
      redirect: 'manual'
    });

    // Collect new session cookies
    const setCookies = loginRes.headers.getSetCookie?.() || [];
    const sessionCookie = [...cookies, ...setCookies]
      .map(c => c.split(';')[0])
      .join('; ');

    // Check if login succeeded (should not redirect back to /login)
    const location = loginRes.headers.get('location') || '';
    if (location.includes('/login') || loginRes.status === 422) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // ---------- 3. Fetch marks ----------
    // IMPORTANT: The exact body is not public.
    // After logging in with a real account, open DevTools → Network →
    // find the request to /admin/grade/student/mark/get_marks and copy the payload.
    // Typical fields (adjust after inspection):
    const marksRes = await fetch(
      'https://ims.ritchennai.edu.in/admin/grade/student/mark/get_marks',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrf,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          Cookie: sessionCookie,
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({
          // Placeholder – replace with real fields after reverse-engineering
          // student_id: ...,
          // semester: 4,
          // exam_id: ...,
          // academic_year: ...
        })
      }
    );

    if (!marksRes.ok) {
      const text = await marksRes.text();
      throw new Error(`Marks endpoint failed: ${marksRes.status} – ${text.slice(0, 200)}`);
    }

    const raw = await marksRes.json();

    // ---------- 4. Normalize into the shape the frontend expects ----------
    // You will need to map the real response into this structure.
    const data = normalizeMarks(raw, username);

    // Cache it
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return res.status(200).json({ success: true, data, cached: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch grades from IMS'
    });
  }
}

function normalizeMarks(raw, username) {
  // TODO: map the real API response into this shape
  return {
    studentInfo: {
      name: raw.name || 'Student',
      regNo: username,
      department: raw.department || 'CSE',
      college: 'Rajalakshmi Institute of Technology',
      isLateralEntry: false
    },
    semesters: [
      // example shape the original site uses
      // {
      //   semester: 4,
      //   gpa: 8.5,
      //   subjects: [
      //     { code: 'CS3401', title: '...', credits: 3, grade: 'A', gradePoints: 9 }
      //   ]
      // }
    ]
  };
}
```

> **Critical next step**  
> Log in once with a real account in Chrome → DevTools → Network → click the marks page → right-click the `get_marks` request → **Copy as cURL**.  
> Paste the real body into the `JSON.stringify({...})` above and adjust `normalizeMarks`.

---

## 4. Frontend

### `src/App.jsx`

```jsx
import { useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';

export default function App() {
  const [studentData, setStudentData] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchGrades = async (username, password, forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, forceRefresh })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Failed');
      setStudentData(result.data);
      setCredentials({ username, password });
    } catch (err) {
      setError(err.message);
      setStudentData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setStudentData(null);
    setCredentials(null);
  };

  if (studentData) {
    return (
      <Dashboard
        data={studentData}
        onSync={() => fetchGrades(credentials.username, credentials.password, true)}
        onLogout={handleLogout}
        loading={loading}
      />
    );
  }

  return (
    <LoginForm
      onSubmit={fetchGrades}
      loading={loading}
      error={error}
    />
  );
}
```

### `src/components/LoginForm.jsx`

```jsx
import { useState } from 'react';
import { GraduationCap, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginForm({ onSubmit, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(username.trim(), password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-lime-400/20 mb-4">
            <GraduationCap className="w-8 h-8 text-lime-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">IMS Dashboard</h1>
          <p className="text-slate-300 text-sm mt-2">
            Enter your RIT IMS register number and password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Register Number</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 2117240020329"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-400/50"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-lime-400 text-slate-900 font-semibold hover:bg-lime-300 transition disabled:opacity-60"
          >
            {loading ? 'Accessing IMS…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Credentials are sent only to the secure backend proxy.
        </p>
      </div>
    </div>
  );
}
```

### `src/components/Dashboard.jsx` (simplified)

```jsx
import { useMemo } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';
import GradeTable from './GradeTable';
import { processAcademicData } from '../lib/processData';

export default function Dashboard({ data, onSync, onLogout, loading }) {
  const processed = useMemo(() => processAcademicData(data), [data]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{processed.studentInfo.name}</h1>
          <p className="text-slate-400 text-sm">
            {processed.studentInfo.regNo} · {processed.studentInfo.department}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onSync}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sync (force refresh)
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Cumulative CGPA</p>
          <p className="text-4xl font-bold text-lime-400 mt-1">
            {processed.cgpa.toFixed(2)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Earned Credits</p>
          <p className="text-4xl font-bold mt-1">{processed.totalCredits}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Subjects Completed</p>
          <p className="text-4xl font-bold mt-1">{processed.totalSubjects}</p>
        </div>
      </div>

      {/* Semesters */}
      {processed.semesters.map((sem) => (
        <div key={sem.semester} className="mb-8">
          <h2 className="text-xl font-semibold mb-3">
            Semester {sem.semester} · GPA {sem.gpa.toFixed(2)}
          </h2>
          <GradeTable subjects={sem.subjects} />
        </div>
      ))}
    </div>
  );
}
```

### `src/components/GradeTable.jsx`

```jsx
export default function GradeTable({ subjects }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-slate-400">
          <tr>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-left">Title</th>
            <th className="px-4 py-3 text-center">Credits</th>
            <th className="px-4 py-3 text-center">Grade</th>
            <th className="px-4 py-3 text-center">Points</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.code} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-4 py-3 font-mono">{s.code}</td>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3 text-center">{s.credits}</td>
              <td className="px-4 py-3 text-center font-semibold">{s.grade}</td>
              <td className="px-4 py-3 text-center">{s.gradePoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### `src/lib/processData.js`

```js
export function processAcademicData(raw) {
  const isLateral = raw.studentInfo?.isLateralEntry;
  let semesters = raw.semesters || [];

  if (isLateral) {
    semesters = semesters.filter((s) => s.semester >= 3);
  }

  let totalQualityPoints = 0;
  let totalCredits = 0;
  let totalSubjects = 0;

  const processedSemesters = semesters.map((sem) => {
    let semQP = 0;
    let semCredits = 0;

    const subjects = (sem.subjects || []).map((sub) => {
      const gp = Number(sub.gradePoints) || 0;
      const cr = Number(sub.credits) || 0;
      semQP += gp * cr;
      semCredits += cr;
      totalSubjects += 1;
      return { ...sub, gradePoints: gp, credits: cr };
    });

    totalQualityPoints += semQP;
    totalCredits += semCredits;

    return {
      ...sem,
      subjects,
      gpa: semCredits > 0 ? semQP / semCredits : 0
    };
  });

  return {
    studentInfo: raw.studentInfo,
    semesters: processedSemesters,
    cgpa: totalCredits > 0 ? totalQualityPoints / totalCredits : 0,
    totalCredits,
    totalSubjects
  };
}
```

---

## 5. Local Development

Vercel serverless functions need the Vercel CLI for local testing:

```bash
npm i -g vercel
vercel dev
```

Or deploy directly:

```bash
vercel
```

---

## 6. What you still need to finish

1. **Capture the real `get_marks` request**  
   - Log into `https://ims.ritchennai.edu.in` with a real student account.  
   - Open DevTools → Network.  
   - Navigate to the marks / grade page.  
   - Find the POST to `/admin/grade/student/mark/get_marks`.  
   - Copy as cURL → extract the exact JSON body and headers.  
   - Paste them into `api/grades.js`.

2. **Map the response**  
   Adjust the `normalizeMarks` function so the frontend receives the shape shown above.

3. **Production cache**  
   Replace the in-memory `Map` with Vercel KV or Upstash Redis if you want the cache to survive cold starts.

---

## 7. Security notes

- Never store passwords in the browser longer than the current session (or use `localStorage` only with explicit “Remember me”).
- Rate-limit the `/api/grades` endpoint.
- Add a simple CAPTCHA or department check if you open the tool publicly.
- The original site claims “credentials never stored” – keep the same policy.

---

You now have a complete skeleton that performs the exact same flow as `rit-ims.vercel.app`:

**Frontend → POST `/api/grades` (with optional `forceRefresh`) → Serverless function logs into the college IMS → returns structured marks → Dashboard renders CGPA & tables.**

After you fill in the real `get_marks` payload, the clone will work end-to-end.
