# RIT IMS Server-Side API & Portal Dashboard

A clean React + Vite frontend and Netlify Edge Function server-side API proxy for **ims.ritchennai.edu.in**.

This project provides:
1. A modern React client that scrapes and visualizes academic analytics (grades, attendance, fees, timetable) directly on the client.
2. A proper server-side REST API that manages session tokens (`Authorization: Bearer <token>`) statelessly and returns clean JSON data without exposing upstream cookies/secrets.

---

## 1. Getting Started

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```

### Production Deployment (Netlify)
The serverless API runs on Netlify Edge Functions. Configure the build parameters in your Netlify dashboard:
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Edge Functions**: `netlify/edge-functions`
- **Environment Variables**: Add `SESSION_SECRET` (minimum 32-character key for session encrypting).

---

## 2. Server-Side REST API Reference

The production API is exposed under `/api` namespace (e.g., `https://ims-api.sidharthprabhu.co.in/api`).

### 2.1 Authentication Flow

#### A. Login
Authenticate against the college portal and receive a stateless session token:
- **Endpoint**: `POST /api/auth/login`
- **Content-Type**: `application/json`

```bash
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }'
```
**Example Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "session": "API_SESSION_TOKEN",
  "studentInfo": {
    "name": "Student Name",
    "register_number": "211724...",
    "department": "Artificial Intelligence and Data Science",
    "batch": "2024-2028"
  },
  "dashboard": {
    "cgpa": "6.66",
    "arrears": "1",
    "attendance": "92.5%",
    "pendingFees": "0"
  }
}
```

#### B. Logout
Invalidate the token and session:
- **Endpoint**: `POST /api/auth/logout`

```bash
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN"
```

---

### 2.2 Student Data Endpoints

All data endpoints require your session token in the authorization header:
`Authorization: Bearer <API_SESSION_TOKEN>`

#### A. Fetch Live Dashboard Metrics (CGPA, Attendance, Dues, Arrears)
Retrieves the key figures directly scraped from the `/admin` portal page:
- **Endpoint**: `GET /api/student/dashboard`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/dashboard"
```
**Example Output:**
```json
{
  "success": true,
  "data": {
    "cgpa": "6.66",
    "arrears": "1",
    "attendance": "92.5%",
    "pendingFees": "0"
  }
}
```

#### B. Student Profile
- **Endpoint**: `GET /api/student/profile`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/profile"
```

#### C. Semester Results
- **Endpoint**: `GET /api/student/results?semester=X`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

#### C.2 Download Results PDF
Retrieves the binary PDF report for the semester from the upstream server:
- **Endpoint**: `GET /api/student/results/download?semester=X`

##### Mac / Linux (Bash/Zsh)
```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results/download?semester=1" \
  -o semester_1_results.pdf
```

##### Windows PowerShell
```powershell
curl.exe -s -H "Authorization: Bearer $env:API_TOKEN" `
  "https://ims-api.sidharthprabhu.co.in/api/student/results/download?semester=1" `
  -o semester_1_results.pdf
```

##### Windows Command Prompt (CMD)
```cmd
curl -s -H "Authorization: Bearer %API_TOKEN%" ^
  "https://ims-api.sidharthprabhu.co.in/api/student/results/download?semester=1" ^
  -o semester_1_results.pdf
```

#### D. Class Timetable
- **Endpoint**: `GET /api/student/timetable`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/timetable"
```

#### E. Attendance Log
- **Endpoint**: `GET /api/student/attendance`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/attendance"
```

#### F. CAT Marks (Internals)
- **Endpoint**: `GET /api/student/cat-marks`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/cat-marks"
```

#### G. Assignment Marks
- **Endpoint**: `GET /api/student/assignment-marks`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/assignment-marks"
```

#### H. Leave / OD History
- **Endpoint**: `GET /api/student/leaves`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/leaves"
```

#### I. Academic Dues / Fees
- **Endpoint**: `GET /api/student/fees`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/fees"
```

#### J. Exam Fees & Payment History
Retrieves outstanding semester exam fees and complete payment transaction logs:
- **Endpoint**: `GET /api/student/exam-fee`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/exam-fee"
```

#### K. Download Exam Fee Receipt
Retrieves the binary payment receipt PDF for a past transaction:
- **Endpoint**: `GET /api/student/exam-fee/receipt?history_id=X`

##### Mac / Linux (Bash/Zsh)
```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/exam-fee/receipt?history_id=YOUR_HISTORY_ID" \
  -o exam_receipt.pdf
```

##### Windows PowerShell
```powershell
curl.exe -s -H "Authorization: Bearer $env:API_TOKEN" `
  "https://ims-api.sidharthprabhu.co.in/api/student/exam-fee/receipt?history_id=YOUR_HISTORY_ID" `
  -o exam_receipt.pdf
```

##### Windows Command Prompt (CMD)
```cmd
curl -s -H "Authorization: Bearer %API_TOKEN%" ^
  "https://ims-api.sidharthprabhu.co.in/api/student/exam-fee/receipt?history_id=YOUR_HISTORY_ID" ^
  -o exam_receipt.pdf
```

#### L. Academic Fee History & Consolidated Receipts List
Retrieves full academic fee history logs and available consolidated receipts:
- **Endpoint**: `GET /api/student/fees/history`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/history"
```

#### M. Download Academic Fee Receipt
Retrieves the binary payment receipt PDF for a past academic fee transaction:
- **Endpoint**: `GET /api/student/fees/download-receipt?history_id=X`

##### Mac / Linux (Bash/Zsh)
```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-receipt?history_id=YOUR_HISTORY_ID" \
  -o academic_receipt.pdf
```

##### Windows PowerShell
```powershell
curl.exe -s -H "Authorization: Bearer $env:API_TOKEN" `
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-receipt?history_id=YOUR_HISTORY_ID" `
  -o academic_receipt.pdf
```

##### Windows Command Prompt (CMD)
```cmd
curl -s -H "Authorization: Bearer %API_TOKEN%" ^
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-receipt?history_id=YOUR_HISTORY_ID" ^
  -o academic_receipt.pdf
```

#### N. Download Consolidated Academic Fee Receipt
Retrieves the binary consolidated academic fee receipt PDF:
- **Endpoint**: `GET /api/student/fees/download-consolidated-receipt?id=X`

##### Mac / Linux (Bash/Zsh)
```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-consolidated-receipt?id=YOUR_CONSOLIDATED_ID" \
  -o consolidated_receipt.pdf
```

##### Windows PowerShell
```powershell
curl.exe -s -H "Authorization: Bearer $env:API_TOKEN" `
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-consolidated-receipt?id=YOUR_CONSOLIDATED_ID" `
  -o consolidated_receipt.pdf
```

##### Windows Command Prompt (CMD)
```cmd
curl -s -H "Authorization: Bearer %API_TOKEN%" ^
  "https://ims-api.sidharthprabhu.co.in/api/student/fees/download-consolidated-receipt?id=YOUR_CONSOLIDATED_ID" ^
  -o consolidated_receipt.pdf
```

---

### 2.3 Faculty Data Endpoints

All faculty data endpoints require your session token in the authorization header:
`Authorization: Bearer <API_SESSION_TOKEN>`

#### A. Fetch Faculty/Staff Profile
Retrieves the logged-in staff member's profile info:
- **Endpoint**: `GET /api/faculty/profile` (or `/api/staff/profile`)

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/faculty/profile"
```
**Example Response:**
```json
{
  "success": true,
  "data": {
    "name": "SHREE MAKESH N",
    "employee_id": "6429",
    "department": "Computer Science and Engineering",
    "designation": "Assistant Professor"
  }
}
```

#### B. Fetch Faculty/Staff Timetable
Retrieves the faculty's timetable, showing the classes and subjects taught:
- **Endpoint**: `GET /api/faculty/timetable` (or `/api/staff/timetable`)

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/faculty/timetable"
```
**Example Response:**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "monday": {
        "1": [
          {
            "subjectName": "AI Powered Chat Bot",
            "subjectCode": "DS23007",
            "className": "M. Tech (D S) / 3 / A"
          }
        ],
        "2": [
          {
            "subjectName": "Natural Language Processing",
            "subjectCode": "AL23531",
            "className": "B.E. CSE (AI & ML) / 5 / C"
          }
        ]
      },
      "tuesday": {
        "3": [
          {
            "subjectName": "AI Powered Chat Bot",
            "subjectCode": "DS23007",
            "className": "M. Tech (D S) / 3 / A"
          }
        ]
      }
    }
  }
}
```

#### C. Fetch Faculty/Staff Subjects
Retrieves the logged-in staff member's registered/taught subjects:
- **Endpoint**: `GET /api/faculty/subjects` (or `/api/staff/subjects`)

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/faculty/subjects"
```
**Example Response:**
```json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "serialNo": 1,
        "className": "B.E. CSE (AI & ML)/5/A",
        "subjectName": "Business Analytics",
        "subjectCode": "CB23531"
      },
      {
        "serialNo": 2,
        "className": "B.E. CSE (AI & ML)/5/C",
        "subjectName": "Natural Language Processing",
        "subjectCode": "AL23531"
      },
      {
        "serialNo": 3,
        "className": "M. Tech (D S)/3/A",
        "subjectName": "AI Powered Chat Bot",
        "subjectCode": "DS23007"
      }
    ]
  }
}
```

#### D. Fetch Past Archived Subjects
Retrieves the logged-in staff member's archived subjects taught in a past Academic Year and Semester:
- **Endpoint**: `GET /api/faculty/subjects/past?academic_year=AY&semester=SEM` or `POST /api/faculty/subjects/past` (or `/api/staff/subjects/past`)

##### GET request example:
```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/faculty/subjects/past?academic_year=2026-2027&semester=5"
```

##### POST request example:
```bash
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/faculty/subjects/past" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "academic_year": "2026-2027",
    "semester": "5"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "serialNo": 1,
        "className": "B.E. CSE (AI & ML) / 5 / A",
        "subjectName": "Business Analytics",
        "subjectCode": "CB23531"
      },
      {
        "serialNo": 2,
        "className": "B.E. CSE (AI & ML) / 5 / C",
        "subjectName": "Natural Language Processing",
        "subjectCode": "AL23531"
      }
    ]
  }
}
```

#### E. Fetch Attendance Subjects
Retrieves the daily subjects for which the logged-in staff member needs to mark student attendance:
- **Endpoint**: `GET /api/faculty/attendance-subjects` (or `/api/staff/attendance-subjects`)

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/faculty/attendance-subjects"
```
**Example Response:**
```json
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
```

---

### 2.4 Diagnostics / Health

#### Local Health Check
```bash
curl -s "https://ims-api.sidharthprabhu.co.in/api/health"
```

#### Upstream Connection Check (checks if college portal is reachable)
```bash
curl -s "https://ims-api.sidharthprabhu.co.in/api/health/upstream"
```
