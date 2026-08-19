# RIT IMS API --- Agent Implementation Specification

## 1. Objective

Convert the existing RIT IMS proxy at:

`https://ims-api.sidharthprabhu.co.in`

into a proper server-side API that can be consumed from:

-   macOS/Linux `curl`
-   Windows PowerShell `curl.exe`
-   Windows CMD
-   Python/Node.js clients
-   Other HTTP clients

The API must authenticate against the upstream RIT IMS portal:

`https://ims.ritchennai.edu.in`

and expose stable API endpoints returning JSON.

The client must **not** need to know or manage the upstream IMS session
cookie. The server must maintain the upstream IMS session associated
with the API session.

------------------------------------------------------------------------

## 2. Critical Architecture

Do **not** implement this as a simple HTTP redirect.

The architecture should be:

``` text
Client
  |
  | HTTPS API request
  v
https://ims-api.sidharthprabhu.co.in
  |
  | Server-side authenticated request
  v
https://ims.ritchennai.edu.in
```

The API server is responsible for:

1.  Fetching the upstream login page.
2.  Extracting the upstream CSRF token.
3.  Creating and maintaining the upstream IMS session.
4.  Submitting the user's IMS credentials to the upstream IMS.
5.  Storing the upstream cookies securely.
6.  Sending the correct cookies and CSRF token to subsequent upstream
    requests.
7.  Parsing upstream responses.
8.  Returning clean JSON to API clients.
9.  Preventing upstream session cookies from being exposed to clients.

The API must not return raw `Set-Cookie` headers from
`ims.ritchennai.edu.in` to the client.

------------------------------------------------------------------------

## 3. Base URL

Production API:

``` text
https://ims-api.sidharthprabhu.co.in
```

Use `/api` as the API namespace:

``` text
https://ims-api.sidharthprabhu.co.in/api
```

Example:

``` text
POST https://ims-api.sidharthprabhu.co.in/api/auth/login
```

------------------------------------------------------------------------

# 4. Authentication API

## 4.1 Login

### Endpoint

``` http
POST /api/auth/login
Content-Type: application/json
```

### Request

``` json
{
  "username": "YOUR_REGISTER_NUMBER",
  "password": "YOUR_PASSWORD"
}
```

The server must:

1.  Request:

``` text
https://ims.ritchennai.edu.in/login
```

2.  Capture the upstream session cookie.
3.  Extract the CSRF token.
4.  Submit the login form.
5.  Verify that authentication succeeded.
6.  Store the upstream session information server-side.
7.  Create an API session/token for the client.

### Successful response

``` json
{
  "success": true,
  "message": "Authentication successful",
  "session": "API_SESSION_TOKEN"
}
```

Do not return:

-   IMS password
-   upstream IMS cookies
-   upstream CSRF token
-   internal proxy credentials

------------------------------------------------------------------------

# 5. API Session

Prefer a server-side session model.

The client should send:

``` http
Authorization: Bearer API_SESSION_TOKEN
```

on subsequent requests.

Example:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/profile"
```

The server maps the API token to the corresponding upstream IMS session.

Recommended server-side session structure:

``` text
api_session_id
    |
    +-- user identifier
    +-- upstream cookies
    +-- upstream CSRF token
    +-- created_at
    +-- last_used_at
    +-- expires_at
```

Do not put upstream cookies or passwords inside a client-visible JWT.

------------------------------------------------------------------------

# 6. Logout

### Endpoint

``` http
POST /api/auth/logout
Authorization: Bearer API_SESSION_TOKEN
```

The server must:

1.  Invalidate the API session.
2.  Delete the stored upstream IMS cookies/session.
3.  Remove associated CSRF/session information.

Response:

``` json
{
  "success": true,
  "message": "Logged out successfully"
}
```

------------------------------------------------------------------------

# 7. Student Data Endpoints

Implement the following API endpoints.

## 7.1 Profile

``` http
GET /api/student/profile
Authorization: Bearer API_SESSION_TOKEN
```

Upstream endpoint:

``` text
/admin/students/Profile-view
```

Return normalized JSON.

Example:

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

Do not assume exact upstream field names. Parse the actual IMS response.

------------------------------------------------------------------------

## 7.2 Attendance

``` http
GET /api/student/attendance
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/student-personal-attendance/report
```

Return structured JSON.

Example:

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

## 7.3 Timetable

``` http
GET /api/student/timetable
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/student-time-table
```

Return structured JSON.

------------------------------------------------------------------------

## 7.4 CAT Marks

``` http
GET /api/student/cat-marks
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/student-cat-mark/report
```

Return structured JSON.

------------------------------------------------------------------------

## 7.5 Assignment Marks

``` http
GET /api/student/assignment-marks
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/assignment/student/mark/report
```

Return structured JSON.

------------------------------------------------------------------------

## 7.6 Leave History

``` http
GET /api/student/leaves
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/student-request-leaves/index
```

Return structured JSON.

------------------------------------------------------------------------

# 8. Semester Results

## Endpoint

``` http
GET /api/student/results?semester=1
Authorization: Bearer API_SESSION_TOKEN
```

or:

``` http
POST /api/student/results
Content-Type: application/json
Authorization: Bearer API_SESSION_TOKEN
```

with:

``` json
{
  "semester": 1
}
```

Prefer the GET version for simple read-only retrieval.

Upstream endpoint:

``` text
POST /admin/grade/student/mark/get_marks
```

with:

``` text
semester=1
```

The server must make this POST request to the upstream IMS while
preserving the authenticated upstream session.

### Example response

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

The exact fields should be determined from the real IMS response.

------------------------------------------------------------------------

# 9. Academic Fee

## Endpoint

``` http
GET /api/student/fees
Authorization: Bearer API_SESSION_TOKEN
```

Upstream:

``` text
/admin/fee-payment/get-data
```

The upstream request must include the authenticated session and required
CSRF headers.

Return normalized JSON.

Example:

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

Do not invent values. Map only data actually available from the IMS
response.

------------------------------------------------------------------------

# 10. Generic Request Requirements

Every authenticated API request must:

1.  Validate the API bearer token.
2.  Find the corresponding server-side upstream IMS session.
3.  Verify that the session is still valid.
4.  Send the stored upstream cookies.
5.  Send the current CSRF token where required.
6.  Send appropriate headers expected by the IMS.
7.  Detect upstream redirects to `/login`.
8.  Treat an upstream login redirect as an authentication/session
    failure.
9.  Never return the upstream login HTML as a successful API response.

If the upstream session expires, return:

``` http
401 Unauthorized
```

with:

``` json
{
  "success": false,
  "error": "IMS_SESSION_EXPIRED",
  "message": "The IMS session has expired. Please authenticate again."
}
```

------------------------------------------------------------------------

# 11. HTTP Status Codes

Use conventional status codes.

  Status   Meaning
  -------- ----------------------------------------
  200      Successful request
  201      Resource created, if applicable
  400      Invalid request
  401      Missing/invalid/expired authentication
  403      Authenticated but not permitted
  404      API endpoint/resource not found
  429      Rate limit exceeded
  502      Upstream IMS failure
  503      API/upstream temporarily unavailable
  500      Internal server error

Never return HTTP 200 for an upstream login page or authentication
failure.

------------------------------------------------------------------------

# 12. Error Format

All API errors should use a consistent JSON structure:

``` json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

Examples:

``` json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "The IMS username or password is incorrect."
}
```

``` json
{
  "success": false,
  "error": "UPSTREAM_UNAVAILABLE",
  "message": "The RIT IMS portal is currently unavailable."
}
```

``` json
{
  "success": false,
  "error": "UPSTREAM_AUTH_REQUIRED",
  "message": "The upstream IMS session is no longer authenticated."
}
```

------------------------------------------------------------------------

# 13. curl Compatibility

The API must work without browser-specific behavior.

## Login

``` bash
curl -s \
  -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "YOUR_REGISTER_NUMBER",
    "password": "YOUR_PASSWORD"
  }'
```

Expected:

``` json
{
  "success": true,
  "message": "Authentication successful",
  "session": "..."
}
```

## Store the token

Bash:

``` bash
API_TOKEN="..."
```

Then:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

------------------------------------------------------------------------

# 14. Example Complete curl Flow

``` bash
BASE_URL="https://ims-api.sidharthprabhu.co.in"

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

Extract the returned token with `jq`:

``` bash
API_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session')
```

Fetch results:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/results?semester=1"
```

Fetch attendance:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/attendance"
```

Fetch profile:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/profile"
```

Fetch fees:

``` bash
curl -s \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/api/student/fees"
```

------------------------------------------------------------------------

# 15. PowerShell Example

``` powershell
$baseUrl = "https://ims-api.sidharthprabhu.co.in"

$body = @{
    username = "YOUR_REGISTER_NUMBER"
    password = "YOUR_PASSWORD"
} | ConvertTo-Json

$response = curl.exe -s `
    -X POST `
    "$baseUrl/api/auth/login" `
    -H "Content-Type: application/json" `
    -d $body

$response
```

Extract the token:

``` powershell
$token = ($response | ConvertFrom-Json).session
```

Fetch results:

``` powershell
curl.exe -s `
    -H "Authorization: Bearer $token" `
    "$baseUrl/api/student/results?semester=1"
```

------------------------------------------------------------------------

# 16. Security Requirements

This API handles student credentials and academic information. Security
is mandatory.

## Never

-   Log IMS passwords.
-   Return IMS passwords.
-   Return upstream session cookies.
-   Return upstream CSRF tokens.
-   Store credentials in plaintext unnecessarily.
-   Expose debug stack traces in production.
-   Allow arbitrary upstream URLs.
-   Create an open proxy.
-   Accept arbitrary target domains from users.

## Implement

### HTTPS

Only expose the production API over HTTPS.

### Rate limiting

At minimum:

``` text
Login: 5 requests/minute/IP
Authenticated API: 60 requests/minute/session
```

Adjust based on actual usage.

### Authentication

Require a valid API session for student endpoints.

### Session expiration

Suggested:

``` text
API session: 1–2 hours of inactivity
Absolute lifetime: 24 hours
```

The upstream IMS session may have a different lifetime.

### Credential handling

Credentials should only be used to authenticate against the upstream
IMS.

If credentials must be persisted, encrypt them. Prefer not storing the
password at all.

### Input validation

Validate:

``` text
username
password
semester
Authorization header
```

For semester:

``` text
integer
reasonable range
```

Do not interpolate user input into arbitrary URLs.

------------------------------------------------------------------------

# 17. Upstream Session Handling

This is the most important implementation requirement.

The server-side HTTP client must support a cookie jar/session.

Conceptually:

``` text
session = createHttpSession()

GET upstream /login
    ↓
capture cookies
capture CSRF

POST upstream /login
    ↓
same cookies
same session
CSRF token
credentials

GET/POST upstream API
    ↓
same cookies
same authenticated session
```

Do not create a new HTTP client for every request if that causes the
upstream cookies to be lost.

If using a serverless runtime where execution instances are ephemeral,
do not rely on process memory for sessions.

Use a persistent session store such as:

-   Redis
-   database
-   encrypted external session store

The stored session data must be protected.

------------------------------------------------------------------------

# 18. CSRF Handling

The upstream IMS appears to use a CSRF token.

The API should:

1.  GET the login page.
2.  Extract the CSRF token from the HTML.
3.  Save it with the upstream session.
4.  Send it during login.
5.  Send it on subsequent requests that require it.
6.  Refresh the token/session if the upstream application changes it.

Do not expose the upstream CSRF token to the API client.

------------------------------------------------------------------------

# 19. Detecting Failed Authentication

The current failure looks like:

``` html
<meta http-equiv="refresh"
content="0;url='https://ims.ritchennai.edu.in/login'">
```

The API must detect this.

Treat any of the following as an upstream authentication failure:

``` text
HTTP 302/303 redirect to /login
```

or:

``` text
HTML meta refresh to /login
```

or:

``` text
response contains authenticated-login-page indicators
```

Do not blindly pass that HTML back to the client.

Instead return:

``` json
{
  "success": false,
  "error": "IMS_SESSION_EXPIRED",
  "message": "The upstream IMS session is not authenticated."
}
```

with HTTP 401.

------------------------------------------------------------------------

# 20. Upstream Headers

The server may need to send headers similar to:

``` http
User-Agent: Mozilla/5.0
Accept: application/json, text/html, */*
X-Requested-With: XMLHttpRequest
X-CSRF-TOKEN: <server-side token>
Referer: https://ims.ritchennai.edu.in/
```

Do not blindly copy every client header to the upstream server.

Create an explicit upstream-header allowlist.

------------------------------------------------------------------------

# 21. CORS

If the API is intended for browser applications, configure CORS
explicitly.

Do not use:

``` http
Access-Control-Allow-Origin: *
```

together with credentialed authentication unless there is a specific
reason.

Prefer an allowlist such as:

``` text
https://your-frontend-domain.example
```

For curl clients, CORS is irrelevant.

------------------------------------------------------------------------

# 22. API Health Endpoint

Implement:

``` http
GET /api/health
```

Response:

``` json
{
  "success": true,
  "status": "ok"
}
```

Optionally implement:

``` http
GET /api/health/upstream
```

which checks whether the upstream IMS is reachable.

Example:

``` json
{
  "success": true,
  "api": "ok",
  "upstream_ims": "reachable"
}
```

Do not require user authentication for `/api/health`.

------------------------------------------------------------------------

# 23. API Documentation

Create an API documentation page.

Recommended:

``` text
/api/docs
```

If the implementation stack supports OpenAPI/Swagger, generate an
OpenAPI specification.

Document:

-   authentication
-   login
-   logout
-   profile
-   attendance
-   timetable
-   CAT marks
-   assignment marks
-   semester results
-   fees
-   error responses
-   rate limits
-   curl examples

------------------------------------------------------------------------

# 24. Logging

Log operational information such as:

``` text
timestamp
request ID
API endpoint
HTTP status
response duration
upstream status
error code
```

Never log:

``` text
password
Authorization bearer token
session cookie
CSRF token
sensitive student data
```

Use a request ID to correlate failures.

Example:

``` text
request_id=8f31...
endpoint=/api/student/results
upstream_status=302
error=IMS_SESSION_EXPIRED
```

------------------------------------------------------------------------

# 25. Caching

Do not cache authenticated student data in a public CDN.

If caching is implemented:

-   cache only per authenticated user
-   never expose one student's data to another user
-   never use a shared public cache for authenticated responses

For sensitive endpoints, preferably send:

``` http
Cache-Control: no-store
```

------------------------------------------------------------------------

# 26. API Response Headers

For sensitive endpoints:

``` http
Cache-Control: no-store
Content-Type: application/json
```

Use security headers where appropriate.

------------------------------------------------------------------------

# 27. Important Proxy Requirement

Do not use a redirect such as:

``` text
/ims/* → https://ims.ritchennai.edu.in/*
```

for authenticated API functionality.

A redirect tells the client to communicate with:

``` text
ims.ritchennai.edu.in
```

and therefore breaks the intended server-side session architecture.

The server must make the upstream request itself.

Correct:

``` text
curl
 ↓
ims-api.sidharthprabhu.co.in/api/student/results
 ↓
server-side HTTP client
 ↓
ims.ritchennai.edu.in/admin/grade/student/mark/get_marks
 ↓
server parses response
 ↓
JSON returned to curl
```

Incorrect:

``` text
curl
 ↓
ims-api.sidharthprabhu.co.in/ims/...
 ↓
HTTP redirect
 ↓
ims.ritchennai.edu.in/...
```

------------------------------------------------------------------------

# 28. Implementation Checklist

-   [ ] Replace redirect-based proxy with server-side proxy/API.
-   [ ] Implement `/api/auth/login`.
-   [ ] Implement server-side upstream session handling.
-   [ ] Implement API bearer/session authentication.
-   [ ] Implement `/api/auth/logout`.
-   [ ] Implement `/api/student/profile`.
-   [ ] Implement `/api/student/attendance`.
-   [ ] Implement `/api/student/timetable`.
-   [ ] Implement `/api/student/cat-marks`.
-   [ ] Implement `/api/student/assignment-marks`.
-   [ ] Implement `/api/student/leaves`.
-   [ ] Implement `/api/student/results`.
-   [ ] Implement `/api/student/fees`.
-   [ ] Implement `/api/health`.
-   [ ] Implement consistent JSON errors.
-   [ ] Detect upstream login redirects.
-   [ ] Prevent upstream cookies from leaking to clients.
-   [ ] Prevent upstream CSRF tokens from leaking to clients.
-   [ ] Add rate limiting.
-   [ ] Add secure logging.
-   [ ] Add request IDs.
-   [ ] Add input validation.
-   [ ] Configure CORS if browser access is required.
-   [ ] Add OpenAPI/API documentation.
-   [ ] Verify all endpoints with curl.
-   [ ] Verify expired-session behavior.
-   [ ] Verify invalid-credential behavior.
-   [ ] Verify upstream IMS downtime behavior.

------------------------------------------------------------------------

# 29. Acceptance Tests

The implementation is considered complete only when the following work.

### Test 1 --- Login

``` bash
curl -i -X POST \
  https://ims-api.sidharthprabhu.co.in/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TEST_USER","password":"TEST_PASSWORD"}'
```

Expected:

``` text
HTTP 200
Content-Type: application/json
```

and a session/token is returned.

### Test 2 --- Results

``` bash
curl -i \
  -H "Authorization: Bearer API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

Expected:

``` text
HTTP 200
Content-Type: application/json
```

The response must contain structured semester-result data.

It must **not** contain the IMS login HTML.

### Test 3 --- Invalid session

``` bash
curl -i \
  -H "Authorization: Bearer INVALID_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

Expected:

``` text
HTTP 401
```

### Test 4 --- Expired upstream session

Simulate an expired/deleted upstream session.

Expected:

``` text
HTTP 401
```

with:

``` json
{
  "success": false,
  "error": "IMS_SESSION_EXPIRED"
}
```

### Test 5 --- Invalid semester

``` bash
curl -i \
  -H "Authorization: Bearer API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=invalid"
```

Expected:

``` text
HTTP 400
```

### Test 6 --- No credential leakage

Inspect server logs and responses.

There must be no:

``` text
IMS password
upstream Cookie
upstream CSRF token
Authorization token
```

in application logs or API responses.

------------------------------------------------------------------------

# 30. Final Agent Instruction

Inspect the existing project before making changes.

Determine:

1.  Current framework/runtime.
2.  Current Netlify deployment architecture.
3.  Existing proxy implementation.
4.  How cookies are currently handled.
5.  How CSRF is currently extracted.
6.  Whether the project uses Netlify Functions, Edge Functions,
    redirects, or another mechanism.
7.  Existing environment variables.
8.  Existing deployment configuration.

Then implement the API architecture described above.

Do not blindly rewrite the project.

Preserve existing functionality where possible, but replace the
redirect-only IMS proxy with a genuine server-side API proxy/session
layer.

The final implementation must allow a user to authenticate once and then
use simple commands such as:

``` bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "https://ims-api.sidharthprabhu.co.in/api/student/results?semester=1"
```

and receive JSON rather than a redirect/login HTML page.

Before considering the task complete, test the complete authentication →
session storage → upstream request → JSON response flow against the real
configured upstream IMS endpoint.
