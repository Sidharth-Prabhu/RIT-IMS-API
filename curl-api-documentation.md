# RIT IMS Data Retrieval Guide (Cross-Platform)

This document outlines the correct `curl` commands to fetch student and academic data from your **Netlify deployed proxy** across different operating systems (**macOS, Linux, and Windows**).

The proxy endpoint redirects paths under `/ims/*` to the real portal (`https://ims.ritchennai.edu.in`). To retrieve data, you must:
1. **Initialize a session** and capture the CSRF token.
2. **Authenticate (Log in)** to bind session cookies.
3. **Execute requests** using the cookies and CSRF headers.

---

## 1. Environment Variable & Cookie Syntax by System

Select the terminal environment you are using below to set up your variables:

### Option A: macOS / Linux / Git Bash / WSL (Bash/Zsh)
```bash
export IMS_USER="YOUR_REGISTER_NUMBER"
export IMS_PASS="YOUR_PASSWORD"
export BASE_URL="https://YOUR_APP_SUBDOMAIN.netlify.app/ims"
```

### Option B: Windows PowerShell
```powershell
$env:IMS_USER="YOUR_REGISTER_NUMBER"
$env:IMS_PASS="YOUR_PASSWORD"
$env:BASE_URL="https://YOUR_APP_SUBDOMAIN.netlify.app/ims"
```

### Option C: Windows Command Prompt (CMD)
```cmd
set IMS_USER=YOUR_REGISTER_NUMBER
set IMS_PASS=YOUR_PASSWORD
set BASE_URL=https://YOUR_APP_SUBDOMAIN.netlify.app/ims
```

---

## 2. Authentication Flow

To log in, you must first pull the CSRF token. The method to extract this token varies by shell:

### Step 1: Extract CSRF Token & Save Session Cookie

#### On macOS / Linux / Git Bash (Bash/Zsh):
```bash
CSRF_TOKEN=$(curl -s -c cookies.txt "$BASE_URL/login" | grep -oE 'name="csrf-token" content="([^"]+)"' | cut -d'"' -f4)
echo "CSRF Token: $CSRF_TOKEN"
```

#### On Windows PowerShell:
Using PowerShell's native regex parsing:
```powershell
$html = curl.exe -s -c cookies.txt "$env:BASE_URL/login"
if ($html -match 'name="csrf-token" content="([^"]+)"') {
    $env:CSRF_TOKEN = $Matches[1]
}
Write-Output "CSRF Token: $env:CSRF_TOKEN"
```

#### On Windows Command Prompt (CMD):
Since CMD lacks a native extraction tool like grep, it is easiest to save the page first and check the output manually, or use a quick Node command (since Node is installed for this project):
```cmd
curl -s -c cookies.txt "%BASE_URL%/login" -o login.html
:: Run Node to pull the token from the file:
for /f "delims=" %i in ('node -e "const fs=require('fs'); const m=fs.readFileSync('login.html','utf8').match(/name=\x22csrf-token\x22 content=\x22([^\x22]+)\x22/); console.log(m ? m[1] : '');"') do set CSRF_TOKEN=%i
echo CSRF Token: %CSRF_TOKEN%
```

---

### Step 2: Authenticate (Log In)

#### On macOS / Linux / Git Bash (Bash/Zsh):
```bash
curl -s -b cookies.txt -c cookies.txt -L "$BASE_URL/login" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
  -H "X-Requested-With: XMLHttpRequest" \
  --data-urlencode "_token=$CSRF_TOKEN" \
  --data-urlencode "email=$IMS_USER" \
  --data-urlencode "password=$IMS_PASS" \
  -o /dev/null
```

#### On Windows PowerShell:
*(Note: Always use `curl.exe` in PowerShell to bypass the default alias to `Invoke-WebRequest`)*
```powershell
curl.exe -s -b cookies.txt -c cookies.txt -L "$env:BASE_URL/login" `
  -X POST `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -H "X-CSRF-TOKEN: $env:CSRF_TOKEN" `
  -H "X-Requested-With: XMLHttpRequest" `
  --data-urlencode "_token=$env:CSRF_TOKEN" `
  --data-urlencode "email=$env:IMS_USER" `
  --data-urlencode "password=$env:IMS_PASS" `
  -o NUL
```

#### On Windows Command Prompt (CMD):
```cmd
curl -s -b cookies.txt -c cookies.txt -L "%BASE_URL%/login" ^
  -X POST ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -H "X-CSRF-TOKEN: %CSRF_TOKEN%" ^
  -H "X-Requested-With: XMLHttpRequest" ^
  --data-urlencode "_token=%CSRF_TOKEN%" ^
  --data-urlencode "email=%IMS_USER%" ^
  --data-urlencode "password=%IMS_PASS%" ^
  -o NUL
```

---

## 3. Data Retrieval Endpoints

Once authenticated, choose the appropriate syntax for your command line to fetch data.

### 3.1. Fetch Semester Grades (POST)
Replace `semester=1` with the desired semester number.

* **macOS / Linux / Bash:**
  ```bashI wan
  curl -s -b cookies.txt "$BASE_URL/admin/grade/student/mark/get_marks" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
    -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
    -H "X-Requested-With: XMLHttpRequest" \
    --data-urlencode "semester=1"
  ```
* **Windows PowerShell:**
  ```powershell
  curl.exe -s -b cookies.txt "$env:BASE_URL/admin/grade/student/mark/get_marks" `
    -X POST `
    -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" `
    -H "X-CSRF-TOKEN: $env:CSRF_TOKEN" `
    -H "X-Requested-With: XMLHttpRequest" `
    --data-urlencode "semester=1"
  ```
* **Windows Command Prompt (CMD):**
  ```cmd
  curl -s -b cookies.txt "%BASE_URL%/admin/grade/student/mark/get_marks" ^
    -X POST ^
    -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" ^
    -H "X-CSRF-TOKEN: %CSRF_TOKEN%" ^
    -H "X-Requested-With: XMLHttpRequest" ^
    --data-urlencode "semester=1"
  ```

### 3.2. Fetch Academic Fee (GET)

* **macOS / Linux / Bash:**
  ```bash
  curl -s -b cookies.txt "$BASE_URL/admin/fee-payment/get-data" \
    -H "X-CSRF-TOKEN: $CSRF_TOKEN" \
    -H "X-Requested-With: XMLHttpRequest"
  ```
* **Windows PowerShell:**
  ```powershell
  curl.exe -s -b cookies.txt "$env:BASE_URL/admin/fee-payment/get-data" `
    -H "X-CSRF-TOKEN: $env:CSRF_TOKEN" `
    -H "X-Requested-With: XMLHttpRequest"
  ```
* **Windows Command Prompt (CMD):**
  ```cmd
  curl -s -b cookies.txt "%BASE_URL%/admin/fee-payment/get-data" ^
    -H "X-CSRF-TOKEN: %CSRF_TOKEN%" ^
    -H "X-Requested-With: XMLHttpRequest"
  ```

### 3.3. Fetch Other Pages (GET)
To request simple pages (CAT Marks, Profile, Attendance, Timetable, Leaves), you only need the cookie session file. This syntax is identical across all systems:

```bash
# CAT Marks
curl -s -b cookies.txt [URL]/admin/student-cat-mark/report

# Assignment Marks
curl -s -b cookies.txt [URL]/admin/assignment/student/mark/report

# Profile Details
curl -s -b cookies.txt [URL]/admin/students/Profile-view

# Attendance Report
curl -s -b cookies.txt [URL]/admin/student-personal-attendance/report

# Timetable
curl -s -b cookies.txt [URL]/admin/student-time-table

# Leave History
curl -s -b cookies.txt [URL]/admin/student-request-leaves/index
```
*(Replace `[URL]` with `$BASE_URL` on Bash, `$env:BASE_URL` on PowerShell, or `%BASE_URL%` on CMD).*
