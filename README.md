# RIT IMS Data Retrieval Guide (`curl` via Netlify Proxy)

This document outlines the correct, robust `curl` commands to fetch all student and academic data from your **Netlify deployed proxy**.

When you deploy this site to Netlify, it uses Netlify Edge Functions (configured via [[edge-functions]](file:///Users/sidharth/development/IMS%20Test/ims-test/netlify.toml) and [`netlify/edge-functions/ims-proxy.ts`](file:///Users/sidharth/development/IMS%20Test/ims-test/netlify/edge-functions/ims-proxy.ts)) to proxy requests matching `/ims/*` to the real portal (`https://ims.ritchennai.edu.in`). Using the Netlify proxy endpoint is highly recommended to circumvent client CORS/SSL errors and match the production environment architecture.

Retrieving data via `curl` requires a multi-step sequence:
1. **Initialize a session** and capture the initial CSRF token from the Netlify proxy.
2. **Authenticate (Log in)** through the proxy to establish and bind session cookies.
3. **Execute requests** against specific proxy paths using the active session cookie and CSRF headers.

---

## Prerequisites & State Management

To run these requests sequentially, we will use a cookie jar (`cookies.txt`) to maintain session state across commands.

### Environment Variables
```bash
export IMS_USER="YOUR_REGISTER_NUMBER"
export IMS_PASS="YOUR_PASSWORD"
export BASE_URL="https://ims-api.sidharthprabhu.co.in/ims"
```

---

## 1. Authentication Flow (Mandatory First Steps)

### Step A: Initialize Session and Fetch CSRF Token
First, fetch the login page via the proxy to acquire a valid session cookie and extract the `_token` (CSRF token) needed for authentication.

```bash
# 1. Fetch page, save cookies, and extract CSRF token
CSRF_TOKEN=$(curl -s -S -c cookies.txt "$BASE_URL/login" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  | grep -oE 'name="csrf-token" content="([^"]+)"' | cut -d'"' -f4)

# Verify the token was found
echo "CSRF Token: $CSRF_TOKEN"
```

### Step B: Authenticate / Log In
Submit the credentials alongside the CSRF token. This binds your session cookie in `cookies.txt` to the authenticated student profile.

```bash
curl -s -S -b cookies.txt -c cookies.txt -L "$BASE_URL/login" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  --data-urlencode "_token=$CSRF_TOKEN" \
  --data-urlencode "email=$IMS_USER" \
  --data-urlencode "password=$IMS_PASS" \
  -o /dev/null

echo "Authentication request complete. Cookie jar 'cookies.txt' is now authenticated."
```

---

## 2. Data Retrieval Endpoints

Once authenticated, use the following `curl` commands to extract specific tables and views.

### 2.1. Basic Student Info
Scrapes the name and department of the logged-in student from the main report landing page.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/grade/student/mark/report" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o student_report.html
```

### 2.2. Detailed Student Profile
Fetches the detailed student profile containing father's name, permanent address, contact details, quota, etc.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/students/Profile-view" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o student_profile.html
```

### 2.3. Semester Results & Subject Grades (POST)
Fetches published subject-wise grades, GPA, and credits for a specific semester (e.g., Semester 1, 2, 3, etc.).
* Note: Replace `semester=1` with the desired semester number.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/grade/student/mark/get_marks" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  --data-urlencode "semester=1" \
  -o semester_1_results.json
```

### 2.4. Continuous Assessment Test (CAT) Marks
Retrieves internal test marks (CO-1, CO-2, Totals, Weightage) for active courses in the current semester.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/student-cat-mark/report" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o cat_marks.html
```

### 2.5. Assignment Marks
Fetches the scores for assignments (A1 to A5) along with faculty names and totals.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/assignment/student/mark/report" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o assignment_marks.html
```

### 2.6. Academic Fee Breakdown & Pending Dues
Fetches quota type, first graduate scholarship eligibility, and detailed fee records (Tuition fee, Hostel/Bus fee, AU Exam fee, reversals, paid vs. pending balance) as a clean JSON payload.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/fee-payment/get-data" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o academic_fee.json
```

### 2.7. Attendance Report
Retrieves course-wise attendance stats (Attended hours, Total conducted hours, Percentage) and faculty info.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/student-personal-attendance/report" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o attendance.html
```

### 2.8. Weekly Class Timetable
Extracts the scheduled periods, faculty initials, and subject codes by day (Monday to Saturday).
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/student-time-table" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o timetable.html
```

### 2.9. Leaves & On-Duty (OD) Request History
Scrapes the history of leave/OD requests, status checks (Approved/Rejected/Pending), and dates.
```bash
curl -s -S -b cookies.txt "$BASE_URL/admin/student-request-leaves/index" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -o leaves_history.html
```

---

## 3. Automation Script (`fetch_all.sh`)

To make data collection as robust as possible, save the following code snippet into a script named `fetch_all.sh` to fetch all variables via your Netlify proxy in one click:

```bash
#!/bin/bash
set -e

# Config
# Replace with: https://ims-api.sidharthprabhu.co.in/ims
COOKIE_FILE="cookies.txt"
OUTPUT_DIR="./ims_raw_data"
mkdir -p "$OUTPUT_DIR"

if [ -z "$IMS_USER" ] || [ -z "$IMS_PASS" ] || [ -z "$BASE_URL" ]; then
  echo "Error: Please set IMS_USER, IMS_PASS, and BASE_URL (ending in /ims) environment variables."
  exit 1
fi

echo "[*] Step 1: Initializing session & fetching CSRF token..."
CSRF_TOKEN=$(curl -s -S -c "$COOKIE_FILE" "$BASE_URL/login" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  | grep -oE 'name="csrf-token" content="([^"]+)"' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
  echo "[-] Error: Failed to extract CSRF token."
  exit 1
fi
echo "[+] Got CSRF Token: $CSRF_TOKEN"

echo "[*] Step 2: Logging in..."
curl -s -S -b "$COOKIE_FILE" -c "$COOKIE_FILE" -L "$BASE_URL/login" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  --data-urlencode "_token=$CSRF_TOKEN" \
  --data-urlencode "email=$IMS_USER" \
  --data-urlencode "password=$IMS_PASS" \
  -o /dev/null

echo "[+] Logged in successfully."

echo "[*] Step 3: Fetching Academic Data..."

# Fetch HTML/JSON items
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/grade/student/mark/report" -o "$OUTPUT_DIR/report.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/students/Profile-view" -o "$OUTPUT_DIR/profile.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/student-cat-mark/report" -o "$OUTPUT_DIR/cat_marks.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/assignment/student/mark/report" -o "$OUTPUT_DIR/assignments.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/student-personal-attendance/report" -o "$OUTPUT_DIR/attendance.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/student-time-table" -o "$OUTPUT_DIR/timetable.html"
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/student-request-leaves/index" -o "$OUTPUT_DIR/leaves.html"

# Fetch JSON Fee Data
curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/fee-payment/get-data" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  -o "$OUTPUT_DIR/fee_data.json"

# Fetch Grades for Semester 1 to 8
for sem in {1..8}; do
  echo "[*] Fetching Semester $sem marks..."
  curl -s -S -b "$COOKIE_FILE" "$BASE_URL/admin/grade/student/mark/get_marks" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
    -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
    -H "X-Requested-With: XMLHttpRequest" \
    --data-urlencode "semester=$sem" \
    -o "$OUTPUT_DIR/semester_${sem}_marks.json"
done

echo "[+] Done! All raw documents saved to folder: $OUTPUT_DIR"
```
