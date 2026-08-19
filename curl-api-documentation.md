# RIT IMS Server-Side API Specification & curl Guide

This documentation details the cross-platform, server-side REST API hosted at:
`https://ims-api.sidharthprabhu.co.in/api`

Unlike direct proxies, this API manages upstream sessions statelessly using encrypted, opaque session tokens (`API_SESSION_TOKEN`). Clients do not need to parse raw HTML or manage CSRF/cookies manually.

---

## 1. Authentication Endpoints

### 1.1 Login

* **Endpoint**: `POST /api/auth/login`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "username": "YOUR_REGISTER_NUMBER",
  "password": "YOUR_PASSWORD"
}
```

#### curl Command (Bash / Linux / macOS)
```bash
export BASE_URL="https://ims-api.sidharthprabhu.co.in"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }')

echo "$LOGIN_RESPONSE"
```

#### Extract Token (requires `jq`)
```bash
export API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')
echo "Token: $API_TOKEN"
```

#### Windows PowerShell
```powershell
$baseUrl = "https://ims-api.sidharthprabhu.co.in"
$body = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json

$response = curl.exe -s -X POST "$baseUrl/api/auth/login" `
  -H "Content-Type: application/json" `
  -d $body

$env:API_TOKEN = ($response | ConvertFrom-Json).session
Write-Output "Token: $env:API_TOKEN"
```

#### Windows Command Prompt (CMD)
```cmd
set BASE_URL=https://ims-api.sidharthprabhu.co.in

:: Perform login
curl -s -X POST "%BASE_URL%/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"YOUR_REGISTER_NUMBER\",\"password\":\"YOUR_PASSWORD\"}" > response.json

:: Extract using Node (if installed)
for /f "delims=" %i in ('node -e "console.log(require('./response.json').session)"') do set API_TOKEN=%i
echo Token: %API_TOKEN%
```

---

### 1.2 Logout

* **Endpoint**: `POST /api/auth/logout`
* **Headers**: `Authorization: Bearer <API_SESSION_TOKEN>`

```bash
curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN"
```

---

## 2. Student Data Endpoints

Every authenticated request requires the Bearer Token in the `Authorization` header:
`Authorization: Bearer API_SESSION_TOKEN`

### 2.1 Student Profile
* **Endpoint**: `GET /api/student/profile`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/profile"
```
**Example Output:**
```json
{
  "success": true,
  "data": {
    "name": "Student Name",
    "register_number": "211724...",
    "department": "Computer Science and Engineering",
    "batch": "2024-2028"
  }
}
```

### 2.2 Semester Results
* **Endpoint**: `GET /api/student/results?semester=X`
* **Query Parameter**: `semester` (value from 1 to 8)

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/results?semester=1"
```
**Example Output:**
```json
{
  "success": true,
  "semester": 1,
  "data": [
    {
      "course_code": "CS3401",
      "course_name": "Algorithms",
      "internal_mark": 38,
      "external_mark": 50,
      "total_mark": 88,
      "grade": "A+",
      "result": "PASS"
    }
  ]
}
```

### 2.3 Attendance
* **Endpoint**: `GET /api/student/attendance`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/attendance"
```

### 2.4 Time Table
* **Endpoint**: `GET /api/student/timetable`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/timetable"
```

### 2.5 CAT Marks (Internals)
* **Endpoint**: `GET /api/student/cat-marks`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/cat-marks"
```

### 2.6 Assignment Marks
* **Endpoint**: `GET /api/student/assignment-marks`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/assignment-marks"
```

### 2.7 Leaves & OD History
* **Endpoint**: `GET /api/student/leaves`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/leaves"
```

### 2.8 Academic Fees
* **Endpoint**: `GET /api/student/fees`

```bash
curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/fees"
```

---

## 3. Diagnostics & Health Check

### 3.1 Local API Status
```bash
curl -s "$BASE_URL/api/health"
```
**Response:**
```json
{"success":true,"status":"ok"}
```

### 3.2 Upstream Connection Check
Checks if the official portal `https://ims.ritchennai.edu.in` is online and reachable from your edge instance:
```bash
curl -s "$BASE_URL/api/health/upstream"
```

---

## 4. Error Formats

The API returns standard HTTP status codes combined with unified JSON error envelopes:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `INVALID_SEMESTER` | The requested semester index is not valid. |
| `401` | `INVALID_CREDENTIALS` | Upstream authentication failed (bad Register No / Password). |
| `401` | `IMS_SESSION_EXPIRED` | The active session has timed out or expired. |
| `404` | `NOT_FOUND` | Endpoint does not exist. |
| `502` | `UPSTREAM_UNAVAILABLE` | RIT IMS portal could not be reached. |
