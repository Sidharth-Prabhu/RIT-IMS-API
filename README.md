# RIT IMS API Documentation

**Base URL:** `https://ims-api.sidharthprabhu.co.in`

## Quick Start with curl

The API is designed to be usable directly from the command line. You do not need a browser, frontend application, or the upstream IMS cookies.

### 1. Set the API URL

```bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"
```

### 2. Log in

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

Expected response:

```json
{
  "success": true,
  "message": "Authentication successful",
  "session": "YOUR_API_SESSION_TOKEN"
}
```

### 3. Extract the session token

If `jq` is installed:

```bash
API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')
```

Check that it was extracted:

```bash
echo "$API_TOKEN"
```

Do not share the token. It represents your authenticated API session.

### 4. Fetch Semester 1 marks

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

For formatted JSON:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .
```

### 5. Fetch another semester

Change the `semester` value:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=2" | jq .
```

Valid semester values are `1` through `8`.

### 6. Fetch other student information

Profile:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/profile" | jq .
```

Attendance:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/attendance" | jq .
```

Timetable:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/timetable" | jq .
```

CAT marks:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/cat-marks" | jq .
```

Assignment marks:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/assignment-marks" | jq .
```

Leave history:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/leaves" | jq .
```

Academic fees:

```bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/fees" | jq .
```

### 7. Log out

```bash
curl -s \
  -X POST \
  "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```

### Complete example

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

API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')

curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .
```

This is the recommended basic workflow:

```text
Login
  ↓
Receive API session token
  ↓
Send token in Authorization header
  ↓
Call student endpoints
  ↓
Receive JSON
  ↓
Logout when finished
```


This API provides programmatic access to authenticated student
information from the RIT IMS portal.

The API communicates server-side with:

`https://ims.ritchennai.edu.in`

Clients do **not** need to manage the upstream RIT IMS cookies or CSRF
token. The API handles the upstream IMS session internally and returns
an API session token to the client.

------------------------------------------------------------------------

## 1. Architecture

``` text
Client / curl
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

The legacy `/ims/*` route is a separate proxy and should not be used for
the new API authentication flow.

------------------------------------------------------------------------

# 2. Authentication

## POST `/api/auth/login`

Authenticate against RIT IMS and create an API session.

### Request

``` http
POST /api/auth/login
Content-Type: application/json
```

### Body

``` json
{
  "username": "YOUR_REGISTER_NUMBER",
  "password": "YOUR_PASSWORD"
}
```

### curl

``` bash
curl -s \
  -X POST \
  "https://ims-api.sidharthprabhu.co.in/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }'
```

### Successful response

``` json
{
  "success": true,
  "message": "Authentication successful",
  "session": "API_SESSION_TOKEN"
}
```

The `session` value is an encrypted opaque API session token.

Do not expose or log the user's IMS password.

Do not expose the upstream IMS cookies or CSRF token.

------------------------------------------------------------------------

# 3. Using the API Session

Send the returned session token using:

``` http
Authorization: Bearer API_SESSION_TOKEN
```

Example:

``` bash
API_TOKEN="YOUR_API_SESSION_TOKEN"

curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/profile"
```

The API decrypts the token server-side and reconstructs the upstream IMS
session.

------------------------------------------------------------------------

# 4. Logout

## POST `/api/auth/logout`

Invalidate the current API/IMS session.

### curl

``` bash
curl -s \
  -X POST \
  "https://ims-api.sidharthprabhu.co.in/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN"
```

### Response

``` json
{
  "success": true,
  "message": "Logged out successfully"
}
```

------------------------------------------------------------------------

# 5. Health Check

## GET `/api/health`

Unauthenticated endpoint for checking whether the API is responding.

### curl

``` bash
curl -s \
  "https://ims-api.sidharthprabhu.co.in/api/health"
```

### Response

``` json
{
  "success": true,
  "status": "ok"
}
```

The response must be JSON. If this endpoint returns the frontend
`index.html`, the Netlify `/api/*` Edge Function routing is not working
correctly.

------------------------------------------------------------------------

# 6. Upstream IMS Health Check

## GET `/api/health/upstream`

Checks whether the RIT IMS portal is reachable.

### curl

``` bash
curl -s \
  "https://ims-api.sidharthprabhu.co.in/api/health/upstream"
```

### Example response

``` json
{
  "success": true,
  "api": "ok",
  "upstream_ims": "reachable"
}
```

------------------------------------------------------------------------

# 7. Semester Results / Marks

## GET `/api/student/results`

Fetch semester marks for the authenticated student.

### Query parameter

  Parameter    Required   Description
  ------------ ---------- -----------------------------
  `semester`   Yes        Semester number from 1 to 8

### Example

``` text
GET /api/student/results?semester=1
```

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

### Semester 2

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=2"
```

### Semester 3

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=3"
```

### Successful response

The API normalizes the upstream response into:

``` json
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

The exact values depend on the student's actual IMS data.

### Upstream request

The API internally calls:

``` http
POST https://ims.ritchennai.edu.in/admin/grade/student/mark/get_marks
```

with:

``` text
semester=1
```

The upstream IMS cookies and CSRF token are handled server-side.

------------------------------------------------------------------------

# 8. Alternative POST Results Request

The results endpoint also accepts POST.

## POST `/api/student/results`

### Request

``` http
POST /api/student/results
Authorization: Bearer API_SESSION_TOKEN
Content-Type: application/json
```

### Body

``` json
{
  "semester": 1
}
```

### curl

``` bash
curl -s \
  -X POST \
  "https://ims-api.sidharthprabhu.co.in/api/student/results" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "semester": 1
  }'
```

GET is recommended for simple read-only retrieval.

------------------------------------------------------------------------

# 9. Student Profile

## GET `/api/student/profile`

Fetch the authenticated student's basic profile information.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/profile"
```

### Response

``` json
{
  "success": true,
  "data": {
    "name": "Student Name",
    "register_number": "123456789",
    "department": "Artificial Intelligence and Data Science",
    "batch": "2024-2028"
  }
}
```

------------------------------------------------------------------------

# 10. Attendance

## GET `/api/student/attendance`

Fetch the student's attendance.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/attendance"
```

### Response format

``` json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "code": "CS1234",
        "name": "Subject Name",
        "conducted": 40,
        "present": 36,
        "absent": 4,
        "percentage": 90
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 11. Timetable

## GET `/api/student/timetable`

Fetch the student's timetable.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/timetable"
```

### Response structure

``` json
{
  "success": true,
  "data": {
    "schedule": {
      "monday": {},
      "tuesday": {},
      "wednesday": {},
      "thursday": {},
      "friday": {},
      "saturday": {}
    }
  }
}
```

The actual schedule contents depend on the student's IMS data.

------------------------------------------------------------------------

# 12. CAT Marks

## GET `/api/student/cat-marks`

Fetch CAT/internal examination marks.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/cat-marks"
```

### Response format

``` json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "code": "CS1234",
        "name": "Subject Name",
        "co1": "20",
        "co2": "18",
        "total": "38",
        "weightage": "19"
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 13. Assignment Marks

## GET `/api/student/assignment-marks`

Fetch assignment marks.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/assignment-marks"
```

### Response format

``` json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "code": "CS1234",
        "name": "Subject Name",
        "a1": "10",
        "a2": "9",
        "a3": "10",
        "a4": "8",
        "a5": "10",
        "total": "47"
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 14. Leave History

## GET `/api/student/leaves`

Fetch leave history.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/leaves"
```

### Response format

``` json
{
  "success": true,
  "data": {
    "leaves": [
      {
        "type": "Leave",
        "fromDate": "2026-08-01",
        "toDate": "2026-08-02",
        "noOfDays": "2",
        "reason": "Personal",
        "status": "Approved"
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 15. Academic Fees

## GET `/api/student/fees`

Fetch academic fee information.

### curl

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/fees"
```

### Response structure

``` json
{
  "success": true,
  "data": {
    "total_fee": 100000,
    "paid": 80000,
    "pending": 20000,
    "transactions": []
  }
}
```

------------------------------------------------------------------------

# 16. Complete curl Workflow

The following is the recommended complete Bash workflow.

## Step 1 --- Set API URL

``` bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"
```

## Step 2 --- Authenticate

``` bash
LOGIN_RESPONSE=$(curl -s \
  -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }')
```

## Step 3 --- Inspect login response

``` bash
echo "$LOGIN_RESPONSE" | jq .
```

## Step 4 --- Extract API session

``` bash
API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')
```

Verify:

``` bash
echo "$API_TOKEN"
```

## Step 5 --- Fetch semester marks

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .
```

## Step 6 --- Fetch another semester

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=2" | jq .
```

## Step 7 --- Logout

``` bash
curl -s \
  -X POST \
  "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```

------------------------------------------------------------------------

# 17. One-Line Semester Marks Command

Authenticate and immediately fetch Semester 1:

``` bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"; API_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"username":"YOUR_REGISTER_NUMBER","password":"YOUR_PASSWORD"}' | jq -r '.session'); curl -s -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/api/student/results?semester=1" | jq .
```

------------------------------------------------------------------------

# 18. Windows PowerShell

## Login

``` powershell
$BaseUrl = "https://ims-api.sidharthprabhu.co.in"

$Body = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json

$Login = curl.exe -s `
    -X POST `
    "$BaseUrl/api/auth/login" `
    -H "Content-Type: application/json" `
    -d $Body

$Login
```

Extract token:

``` powershell
$ApiToken = ($Login | ConvertFrom-Json).session
```

Fetch semester marks:

``` powershell
curl.exe -s `
    -H "Authorization: Bearer $ApiToken" `
    "$BaseUrl/api/student/results?semester=1"
```

------------------------------------------------------------------------

# 19. Windows CMD

Login:

``` cmd
curl -s -X POST "https://ims-api.sidharthprabhu.co.in/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"YOUR_REGISTER_NUMBER\",\"password\":\"YOUR_PASSWORD\"}"
```

Copy the `session` value from the response and set:

``` cmd
set API_TOKEN=YOUR_API_SESSION_TOKEN
```

Fetch semester marks:

``` cmd
curl -s ^
  -H "Authorization: Bearer %API_TOKEN%" ^
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

------------------------------------------------------------------------

# 20. HTTP Status Codes

    Status Meaning
  -------- ----------------------------------------
       200 Successful request
       400 Invalid request
       401 Missing/invalid/expired authentication
       404 API endpoint not found
       429 Rate limit exceeded
       502 Upstream IMS failure
       500 Internal API error

------------------------------------------------------------------------

# 21. Error Format

API errors use:

``` json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

## Invalid credentials

``` json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "The IMS username or password is incorrect."
}
```

HTTP status:

``` text
401
```

## Missing authentication

``` json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid Authorization header."
}
```

HTTP status:

``` text
401
```

## Expired IMS session

``` json
{
  "success": false,
  "error": "IMS_SESSION_EXPIRED",
  "message": "The upstream IMS session has expired. Please authenticate again."
}
```

HTTP status:

``` text
401
```

## Invalid semester

``` json
{
  "success": false,
  "error": "INVALID_SEMESTER",
  "message": "Semester must be a valid integer between 1 and 8."
}
```

HTTP status:

``` text
400
```

------------------------------------------------------------------------

# 22. Authentication Flow

The server performs the following process.

``` text
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
Verify authenticated IMS page
       |
       +-- obtain authenticated cookies
       +-- obtain authenticated CSRF token
       |
       v
Create encrypted API session token
       |
       v
Return token to client
```

Subsequent requests:

``` text
Authorization: Bearer <API_TOKEN>
       |
       v
Decrypt API session
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

------------------------------------------------------------------------

# 23. Important Client-Side Rules

Clients should **not**:

-   request `/ims/*` for normal API usage
-   send the upstream `laravel_session` cookie manually
-   send the upstream `XSRF-TOKEN` manually
-   send the upstream CSRF token
-   submit credentials directly to `ims.ritchennai.edu.in`
-   follow upstream IMS redirects themselves

Clients should only communicate with:

``` text
https://ims-api.sidharthprabhu.co.in/api/*
```

and use:

``` http
Authorization: Bearer <API_TOKEN>
```

------------------------------------------------------------------------

# 24. Security

The API handles sensitive student authentication and academic
information.

Never log:

-   IMS passwords
-   API bearer tokens
-   upstream cookies
-   upstream CSRF tokens
-   unnecessary student academic information

Use HTTPS only.

Apply rate limiting to login and authenticated endpoints.

Do not create arbitrary upstream URL forwarding.

Do not turn the service into an open proxy.

Authenticated student data should not be publicly cached.

Responses containing student information should use:

``` http
Cache-Control: no-store
```

------------------------------------------------------------------------

# 25. API Endpoint Summary

  Method   Endpoint                            Auth
  -------- ----------------------------------- ------
  GET      `/api/health`                       No
  GET      `/api/health/upstream`              No
  POST     `/api/auth/login`                   No
  POST     `/api/auth/logout`                  Yes
  GET      `/api/student/profile`              Yes
  GET      `/api/student/attendance`           Yes
  GET      `/api/student/timetable`            Yes
  GET      `/api/student/cat-marks`            Yes
  GET      `/api/student/assignment-marks`     Yes
  GET      `/api/student/leaves`               Yes
  GET      `/api/student/results?semester=N`   Yes
  POST     `/api/student/results`              Yes
  GET      `/api/student/fees`                 Yes

------------------------------------------------------------------------

# 26. Quick Reference

``` bash
# Base URL
BASE_URL="https://ims-api.sidharthprabhu.co.in"

# Health
curl -s "$BASE_URL/api/health"

# Login
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_REGISTER_NUMBER","password":"YOUR_PASSWORD"}')

# Token
API_TOKEN=$(echo "$LOGIN" | jq -r '.session')

# Semester 1
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1" | jq .

# Semester 2
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=2" | jq .

# Profile
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/profile" | jq .

# Attendance
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/attendance" | jq .

# Timetable
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/timetable" | jq .

# CAT marks
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/cat-marks" | jq .

# Assignment marks
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/assignment-marks" | jq .

# Leaves
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/leaves" | jq .

# Fees
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/fees" | jq .

# Logout
curl -s -X POST \
  "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```

------------------------------------------------------------------------

# 27. Troubleshooting

## `/api/health` returns HTML

Expected:

``` json
{
  "success": true,
  "status": "ok"
}
```

If instead the response contains:

``` html
<title>ims-test</title>
```

the request is reaching the frontend SPA rather than the `ims-api` Edge
Function.

Fix the Netlify `/api/*` routing before testing authentication.

## Login returns 404

Check that:

``` text
/api/auth/login
```

is being routed to the `ims-api` Edge Function.

## Results return `IMS_SESSION_EXPIRED`

The API successfully reached the function but the upstream IMS session
is no longer valid.

Authenticate again.

## Results return `UPSTREAM_ERROR`

The API reached the upstream IMS but could not parse the response as
expected. Inspect the upstream response structure before changing the
parser.

## Results return the IMS login HTML

The upstream session was not preserved or has expired. The API must
detect this and return `401 IMS_SESSION_EXPIRED` rather than returning
the login HTML.

------------------------------------------------------------------------

# 28. Production Verification

Before considering the API production-ready, verify the following in
order:

``` bash
curl -i "$BASE_URL/api/health"
```

Must return JSON.

Then:

``` bash
curl -i "$BASE_URL/api/health/upstream"
```

Must return JSON.

Then:

``` bash
curl -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_REGISTER_NUMBER","password":"YOUR_PASSWORD"}'
```

Must return an API session.

Then:

``` bash
curl -i \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

Must return JSON containing semester results.

The client must never receive the upstream IMS login HTML during a
normal API request.


## Windows PowerShell

PowerShell users can use `Invoke-RestMethod` directly. This is the recommended PowerShell approach because the JSON response is automatically converted into a PowerShell object.

If you specifically want to use curl, use `curl.exe`, not `curl`, because `curl` may resolve to PowerShell's `Invoke-WebRequest` alias.

### 1. Set the API URL

```powershell
$BaseUrl = "https://ims-api.sidharthprabhu.co.in"
```

### 2. Log in

Replace the register number and password:

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

A successful login returns an object similar to:

```text
success message
------- -------
True    Authentication successful
```

The response also contains a `session` property.

### 3. Extract the API session token

Because `Invoke-RestMethod` already parses the JSON response, **do not use `ConvertFrom-Json` here**.

Correct:

```powershell
$ApiToken = $Login.session
```

Check it:

```powershell
$ApiToken
```

Do not share the token. It represents your authenticated API session.

### 4. Fetch Semester 1 marks

```powershell
$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=1" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

### 5. Fetch another semester

For Semester 2:

```powershell
$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=2" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

Valid semester values are `1` through `8`.

### 6. Fetch profile

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/profile" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 7. Fetch attendance

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/attendance" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 8. Fetch timetable

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/timetable" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 9. Fetch CAT marks

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/cat-marks" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 10. Fetch assignment marks

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/assignment-marks" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 11. Fetch leave history

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/leaves" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 12. Fetch academic fees

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/fees" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 13. Logout

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/logout" `
    -Method POST `
    -Headers @{
        Authorization = "Bearer $ApiToken"
} | ConvertTo-Json -Depth 10
```

### 14. Health check

```powershell
Invoke-RestMethod `
    -Uri "$BaseUrl/api/health" `
    -Method GET | ConvertTo-Json -Depth 10
```

Expected:

```json
{
  "success": true,
  "status": "ok"
}
```

### 15. Complete PowerShell workflow

This is the recommended copy-paste workflow:

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

if (-not $Login.success) {
    Write-Error "Login failed: $($Login.message)"
    exit 1
}

$ApiToken = $Login.session

if (-not $ApiToken) {
    Write-Error "Login succeeded but no API session token was returned."
    exit 1
}

$Results = Invoke-RestMethod `
    -Uri "$BaseUrl/api/student/results?semester=1" `
    -Method GET `
    -Headers @{
        Authorization = "Bearer $ApiToken"
    }

$Results | ConvertTo-Json -Depth 10
```

### Important PowerShell distinction

With `Invoke-RestMethod`:

```powershell
$Login = Invoke-RestMethod ...
$ApiToken = $Login.session
```

Do **not** do:

```powershell
$ApiToken = ($Login | ConvertFrom-Json).session
```

`Invoke-RestMethod` has already converted the JSON response into a PowerShell object.

### PowerShell using curl.exe instead

If you specifically want the command-line `curl` implementation:

```powershell
$BaseUrl = "https://ims-api.sidharthprabhu.co.in"

$LoginBody = '{"username":"YOUR_REGISTER_NUMBER","password":"YOUR_PASSWORD"}'

$LoginJson = curl.exe -s `
    -X POST `
    "$BaseUrl/api/auth/login" `
    -H "Content-Type: application/json" `
    --data-raw $LoginBody

$Login = $LoginJson | ConvertFrom-Json

$ApiToken = $Login.session

curl.exe -s `
    -H "Authorization: Bearer $ApiToken" `
    "$BaseUrl/api/student/results?semester=1"
```

Here `ConvertFrom-Json` is correct because `curl.exe` returns the response as a JSON string.

