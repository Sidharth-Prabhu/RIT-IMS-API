# RIT IMS API Documentation

**Base URL:** `https://ims-api.sidharthprabhu.co.in`

This API provides programmatic access to authenticated student information from the RIT IMS portal.

The API communicates server-side with:

`https://ims.ritchennai.edu.in`

Clients do **not** need to manage the upstream RIT IMS cookies or CSRF token. The API handles the upstream IMS session internally and returns an API session token to the client.

---

# Quick Start

The API can be used directly from:

- macOS / Linux / Bash / Zsh
- Windows PowerShell
- Windows Command Prompt (CMD)

Each step below contains the commands for all supported operating systems. You do not need to jump to a separate Windows section.

---

# Step 1 — Set the API URL

## macOS / Linux / Bash / Zsh

```bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"
```

## Windows PowerShell

```powershell
$BaseUrl = "https://ims-api.sidharthprabhu.co.in"
```

## Windows CMD

```cmd
set BASE_URL=https://ims-api.sidharthprabhu.co.in
```

---

# Step 2 — Authenticate

The login endpoint is:

```text
POST /api/auth/login
```

Request body:

```json
{
  "username": "YOUR_REGISTER_NUMBER",
  "password": "YOUR_PASSWORD"
}
```

## macOS / Linux / Bash / Zsh

```bash
LOGIN_RESPONSE=$(curl -s \
  -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }')

echo "$LOGIN_RESPONSE"
```

## Windows PowerShell

PowerShell should use `Invoke-RestMethod` for the recommended workflow. It automatically converts the JSON response into a PowerShell object.

```powershell
$LoginBody = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json -Compress

$Login = Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $LoginBody

$Login
```

A successful PowerShell response will contain properties similar to:

```text
success message
------- -------
True    Authentication successful
```

It will also contain a `session` property.

## Windows CMD

```cmd
curl -s -X POST "%BASE_URL%/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"YOUR_REGISTER_NUMBER\",\"password\":\"YOUR_PASSWORD\"}"
```

A successful response looks like:

```json
{
  "success": true,
  "message": "Authentication successful",
  "session": "YOUR_API_SESSION_TOKEN"
}
```

---

# Step 3 — Extract the API Session Token

The API returns an opaque session token after successful authentication.

## macOS / Linux / Bash / Zsh

If `jq` is installed:

```bash
API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')
```

Check it:

```bash
echo "$API_TOKEN"
```

Without `jq`, inspect the login response and copy the value of `session` manually:

```bash
echo "$LOGIN_RESPONSE"
```

Then:

```bash
API_TOKEN="YOUR_API_SESSION_TOKEN"
```

## Windows PowerShell

Because `Invoke-RestMethod` already parses JSON, use:

```powershell
$ApiToken = $Login.session
```

Check it:

```powershell
$ApiToken
```

**Do not use:**

```powershell
$ApiToken = ($Login | ConvertFrom-Json).session
```

That is incorrect when `$Login` was created using `Invoke-RestMethod`.

## Windows CMD

CMD does not have a built-in JSON parser. Copy the `session` value from the login response and set:

```cmd
set API_TOKEN=YOUR_API_SESSION_TOKEN
```

---

# Step 4 — Fetch Semester Marks

Endpoint:

```text
GET /api/student/results?semester=N
```

`N` can be a semester number from `1` through `8`.

## macOS / Linux / Bash / Zsh

Semester 1:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

Formatted JSON with `jq`:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .
```

Semester 2:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=2" | jq .
```

Semester 3:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=3" | jq .
```

For any other semester, change the value:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=4" | jq .
```

## Windows PowerShell

Semester 1:

```powershell
$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=1" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

Semester 2:

```powershell
$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=2" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

For another semester, change the value:

```powershell
$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=3" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

## Windows CMD

Semester 1:

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/results?semester=1"
```

Semester 2:

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/results?semester=2"
```

For another semester, change the value:

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/results?semester=3"
```

---

# Step 5 — Fetch Student Profile

Endpoint:

```text
GET /api/student/profile
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/profile" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/profile" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/profile"
```

---

# Step 6 — Fetch Attendance

Endpoint:

```text
GET /api/student/attendance
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/attendance" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/attendance" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/attendance"
```

---

# Step 7 — Fetch Timetable

Endpoint:

```text
GET /api/student/timetable
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/timetable" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/timetable" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/timetable"
```

---

# Step 8 — Fetch CAT Marks

Endpoint:

```text
GET /api/student/cat-marks
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/cat-marks" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/cat-marks" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/cat-marks"
```

---

# Step 9 — Fetch Assignment Marks

Endpoint:

```text
GET /api/student/assignment-marks
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/assignment-marks" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/assignment-marks" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/assignment-marks"
```

---

# Step 10 — Fetch Leave History

Endpoint:

```text
GET /api/student/leaves
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/leaves" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/leaves" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/leaves"
```

---

# Step 11 — Fetch Academic Fees

Endpoint:

```text
GET /api/student/fees
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/fees" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/fees" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/fees"
```

---

# Step 12 — Logout

Endpoint:

```text
POST /api/auth/logout
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -X POST \
  "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/logout" `
    -Method POST `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -X POST ^
  "%BASE_URL%/api/auth/logout" ^
  -H "Authorization: Bearer %API_TOKEN%"
```

---

# Step 13 — API Health Check

Endpoint:

```text
GET /api/health
```

No authentication is required.

## macOS / Linux / Bash / Zsh

```bash
curl -s "$BASE_URL/api/health" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/health" `
    -Method GET | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s "%BASE_URL%/api/health"
```

Expected:

```json
{
  "success": true,
  "status": "ok"
}
```

If this returns the site's frontend HTML instead of JSON, `/api/*` is not being routed to the `ims-api` Edge Function correctly.

---

# Step 14 — Upstream IMS Health Check

Endpoint:

```text
GET /api/health/upstream
```

No authentication is required.

## macOS / Linux / Bash / Zsh

```bash
curl -s "$BASE_URL/api/health/upstream" | jq .
```

## Windows PowerShell

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/health/upstream" `
    -Method GET | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s "%BASE_URL%/api/health/upstream"
```

Example:

```json
{
  "success": true,
  "api": "ok",
  "upstream_ims": "reachable"
}
```

---

# API Reference

## Authentication

### POST `/api/auth/login`

Authenticates the user against RIT IMS and creates an API session.

Request:

```json
{
  "username": "YOUR_REGISTER_NUMBER",
  "password": "YOUR_PASSWORD"
}
```

Successful response:

```json
{
  "success": true,
  "message": "Authentication successful",
  "session": "API_SESSION_TOKEN"
}
```

The `session` value is an opaque API session token.

---

## Authorization

Authenticated requests use:

```http
Authorization: Bearer API_SESSION_TOKEN
```

The client does not need to send:

- `laravel_session`
- `XSRF-TOKEN`
- IMS CSRF token
- IMS cookies

The API handles the upstream IMS session internally.

---

# Semester Results

## GET `/api/student/results?semester=N`

Fetch marks for the authenticated student.

`N` must be a semester number from `1` to `8`.

Example:

```text
GET /api/student/results?semester=1
```

Example response:

```json
{
  "success": true,
  "semester": 1,
  "data": [
    {
      "course_code": "CS1234",
      "course_name": "Data Structures",
      "internal_mark": 40,
      "external_mark": 55,
      "total_mark": 95,
      "grade": "A",
      "result": "PASS"
    }
  ]
}
```

The exact fields and values depend on the data returned by the upstream IMS.

Internally, the API retrieves semester marks from:

```text
POST https://ims.ritchennai.edu.in/admin/grade/student/mark/get_marks
```

with:

```text
semester=N
```

---

# Alternative Results POST

## POST `/api/student/results`

Request:

```json
{
  "semester": 1
}
```

## macOS / Linux / Bash / Zsh

```bash
curl -s \
  -X POST \
  "$BASE_URL/api/student/results" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"semester":1}' | jq .
```

## Windows PowerShell

```powershell
$Body = @{
    semester = 1
} | ConvertTo-Json -Compress

Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results" `
    -Method POST `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } `
    -ContentType "application/json" `
    -Body $Body | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -s ^
  -X POST ^
  "%BASE_URL%/api/student/results" ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"semester\":1}"
```

GET is recommended for simple read-only retrieval.

---

# Response and Error Handling

## Success

Successful requests return JSON with:

```json
{
  "success": true
}
```

Additional fields depend on the endpoint.

## Invalid credentials

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "The IMS username or password is incorrect."
}
```

HTTP status:

```text
401
```

## Unauthorized

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid Authorization header."
}
```

HTTP status:

```text
401
```

## Expired IMS session

```json
{
  "success": false,
  "error": "IMS_SESSION_EXPIRED",
  "message": "The upstream IMS session has expired. Please authenticate again."
}
```

HTTP status:

```text
401
```

## Invalid semester

```json
{
  "success": false,
  "error": "INVALID_SEMESTER",
  "message": "Semester must be a valid integer between 1 and 8."
}
```

HTTP status:

```text
400
```

## General error format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

---

# HTTP Status Codes

| Status | Meaning |
|---:|---|
| 200 | Successful request |
| 400 | Invalid request |
| 401 | Missing, invalid, or expired authentication |
| 404 | API endpoint not found |
| 429 | Rate limit exceeded |
| 500 | Internal API error |
| 502 | Upstream IMS failure |

---

# Architecture

```text
Client
  |
  | HTTPS
  v
https://ims-api.sidharthprabhu.co.in/api/*
  |
  | Netlify Edge Function: ims-api
  v
https://ims.ritchennai.edu.in
```

The `/api/*` routes are handled by the `ims-api` Edge Function.

The legacy `/ims/*` route is a separate proxy and should not be used for normal API authentication.

---

# Authentication Flow

```text
POST /api/auth/login
       |
       v
GET RIT IMS /login
       |
       +-- obtain session cookies
       |
       +-- extract CSRF token
       |
       v
POST RIT IMS /login
       |
       +-- username
       +-- password
       +-- CSRF token
       |
       v
Verify authenticated IMS session
       |
       +-- authenticated cookies
       +-- authenticated CSRF token
       |
       v
Create API session token
       |
       v
Return token to client
```

Subsequent requests:

```text
Authorization: Bearer <API_TOKEN>
       |
       v
Restore API session
       |
       +-- IMS cookies
       +-- IMS CSRF token
       |
       v
Request RIT IMS
       |
       v
Parse response
       |
       v
Return JSON
```

---

# Complete Workflow by Operating System

## macOS / Linux / Bash / Zsh

```bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"

LOGIN_RESPONSE=$(curl -s \
  -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }')

echo "$LOGIN_RESPONSE" | jq .

API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')

curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .

curl -s \
  -X POST \
  "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```

## Windows PowerShell

```powershell
$BaseUrl = "https://ims-api.sidharthprabhu.co.in"

$LoginBody = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json -Compress

$Login = Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $LoginBody

$Login

$ApiToken = $Login.session

$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=1" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10

Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/logout" `
    -Method POST `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

**Important:** Since this workflow uses `Invoke-RestMethod`, `$Login` is already a PowerShell object.

Use:

```powershell
$ApiToken = $Login.session
```

Do not use:

```powershell
$ApiToken = ($Login | ConvertFrom-Json).session
```

## Windows CMD

```cmd
set BASE_URL=https://ims-api.sidharthprabhu.co.in

curl -s -X POST "%BASE_URL%/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"YOUR_REGISTER_NUMBER\",\"password\":\"YOUR_PASSWORD\"}"
```

Copy the `session` value:

```cmd
set API_TOKEN=YOUR_API_SESSION_TOKEN
```

Fetch Semester 1:

```cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/results?semester=1"
```

Logout:

```cmd
curl -s ^
  -X POST ^
  "%BASE_URL%/api/auth/logout" ^
  -H "Authorization: Bearer %API_TOKEN%"
```

---

# Important Client-Side Rules

Clients should **not**:

- request `/ims/*` for normal API usage
- send upstream `laravel_session` cookies manually
- send the upstream `XSRF-TOKEN` manually
- send the upstream CSRF token
- submit credentials directly to `ims.ritchennai.edu.in`
- follow upstream IMS redirects themselves

Clients should communicate with:

```text
https://ims-api.sidharthprabhu.co.in/api/*
```

and authenticate using:

```http
Authorization: Bearer <API_TOKEN>
```

---

# Security

The API handles sensitive student authentication and academic information.

Never log:

- IMS passwords
- API bearer tokens
- upstream cookies
- upstream CSRF tokens
- unnecessary student academic information

Use HTTPS only.

Apply rate limiting to login and authenticated endpoints.

Do not create arbitrary upstream URL forwarding.

Do not turn the service into an open proxy.

Authenticated student data should not be publicly cached.

Responses containing student information should use:

```http
Cache-Control: no-store
```

---

# API Endpoint Summary

| Method | Endpoint | Authentication |
|---|---|---|
| GET | `/api/health` | No |
| GET | `/api/health/upstream` | No |
| POST | `/api/auth/login` | No |
| POST | `/api/auth/logout` | Yes |
| GET | `/api/student/profile` | Yes |
| GET | `/api/student/attendance` | Yes |
| GET | `/api/student/timetable` | Yes |
| GET | `/api/student/cat-marks` | Yes |
| GET | `/api/student/assignment-marks` | Yes |
| GET | `/api/student/leaves` | Yes |
| GET | `/api/student/results?semester=N` | Yes |
| POST | `/api/student/results` | Yes |
| GET | `/api/student/fees` | Yes |

---

# Troubleshooting

## `/api/health` returns HTML

Expected:

```json
{
  "success": true,
  "status": "ok"
}
```

If the response is the frontend `index.html`, the request is reaching the SPA instead of the `ims-api` Edge Function.

Fix the Netlify `/api/*` routing.

## Login returns 404

Verify that:

```text
/api/auth/login
```

is routed to the `ims-api` Edge Function.

## PowerShell says `ConvertFrom-Json` is invalid

If login was performed using:

```powershell
$Login = Invoke-RestMethod ...
```

use:

```powershell
$ApiToken = $Login.session
```

Do not pipe `$Login` into `ConvertFrom-Json`.

## Results return `UNAUTHORIZED`

Verify that the token exists:

```powershell
$ApiToken
```

or:

```bash
echo "$API_TOKEN"
```

The request must contain:

```http
Authorization: Bearer <API_TOKEN>
```

## Results return `IMS_SESSION_EXPIRED`

Authenticate again to create a new API session.

## Results return the IMS login HTML

The upstream IMS session was not preserved or has expired. The API should detect this and return `401 IMS_SESSION_EXPIRED` rather than exposing the IMS login HTML.

---

# Production Verification

Verify the API in this order.

## macOS / Linux

```bash
curl -i "$BASE_URL/api/health"
```

```bash
curl -i "$BASE_URL/api/health/upstream"
```

```bash
curl -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_REGISTER_NUMBER","password":"YOUR_PASSWORD"}'
```

Then:

```bash
curl -i \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

## Windows PowerShell

```powershell
Invoke-RestMethod "$BaseUrl/api/health" | ConvertTo-Json -Depth 10
```

```powershell
Invoke-RestMethod "$BaseUrl/api/health/upstream" | ConvertTo-Json -Depth 10
```

```powershell
$LoginBody = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json -Compress

$Login = Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $LoginBody

$ApiToken = $Login.session
```

Then:

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=1" `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    } | ConvertTo-Json -Depth 10
```

## Windows CMD

```cmd
curl -i "%BASE_URL%/api/health"
```

```cmd
curl -i "%BASE_URL%/api/health/upstream"
```

```cmd
curl -i -X POST "%BASE_URL%/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"YOUR_REGISTER_NUMBER\",\"password\":\"YOUR_PASSWORD\"}"
```

After copying the returned session token:

```cmd
curl -i ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "%BASE_URL%/api/student/results?semester=1"
```

The client should receive JSON containing the requested data, not the upstream IMS login HTML.
