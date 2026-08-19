import type { Context, Config } from "@netlify/edge-functions";

export const config: Config = {
  path: "/ims/*",
};

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") || "*";
  
  // Handle HTTP OPTIONS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-CSRF-TOKEN, X-Requested-With, Cookie, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Rewrite path: /ims/foo -> /foo
  const targetPath = url.pathname.replace(/^\/ims/, "");
  // If targetPath is empty, default to /
  const sanitizedPath = targetPath === "" ? "/" : targetPath;
  
  const targetUrl = new URL(sanitizedPath + url.search, "https://ims.ritchennai.edu.in");

  console.log(`Proxying ${request.method} ${url.pathname} to ${targetUrl.toString()}`);

  // Clone the request headers and tweak them
  const headers = new Headers(request.headers);
  headers.set("host", "ims.ritchennai.edu.in");
  headers.set("origin", "https://ims.ritchennai.edu.in");
  
  // Adjust Referer header if present
  const referer = headers.get("referer");
  if (referer) {
    headers.set("referer", referer.replace(url.origin + "/ims", "https://ims.ritchennai.edu.in"));
  }

  // Handle request body if present (for POST requests)
  let body: ArrayBuffer | undefined = undefined;
  if (request.body) {
    try {
      body = await request.arrayBuffer();
    } catch (bodyErr) {
      console.warn("Failed to parse request body:", bodyErr);
    }
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: body,
      redirect: "manual", // Keep redirect manual to rewrite Location header
    });

    const newHeaders = new Headers(response.headers);

    // 1. Rewrite Location header to keep redirects pointing to the Netlify app proxy
    const location = newHeaders.get("location");
    if (location) {
      let rewrittenLocation = location;
      if (/https?:\/\/ims\.ritchennai\.edu\.in/i.test(rewrittenLocation)) {
        rewrittenLocation = rewrittenLocation.replace(/https?:\/\/ims\.ritchennai\.edu\.in/gi, `${url.origin}/ims`);
      } else if (rewrittenLocation.startsWith("/")) {
        rewrittenLocation = "/ims" + rewrittenLocation;
      }
      newHeaders.set("location", rewrittenLocation);
    }

    // 2. Tweak cookies to allow them on the Netlify domain (removing domain restriction)
    let setCookies: string[] = [];
    if (typeof response.headers.getSetCookie === "function") {
      setCookies = response.headers.getSetCookie();
    } else {
      // Fallback for older Deno runtimes
      const rawCookie = response.headers.get("set-cookie");
      if (rawCookie) {
        setCookies = rawCookie.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
      }
    }

    if (setCookies.length > 0) {
      newHeaders.delete("set-cookie");
      for (const cookie of setCookies) {
        const tweaked = cookie
          .replace(/domain=[^;]+/gi, "") // strip domain restriction
          .replace(/samesite=none/gi, "SameSite=Lax") // rewrite SameSite
          .replace(/;\s*;/g, ";");
        newHeaders.append("set-cookie", tweaked);
      }
    }

    // 3. Add CORS headers for API accessibility
    newHeaders.set("Access-Control-Allow-Origin", origin);
    newHeaders.set("Access-Control-Allow-Credentials", "true");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-TOKEN, X-Requested-With, Cookie, Authorization");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    
    const errHeaders = new Headers();
    errHeaders.set("Access-Control-Allow-Origin", origin);
    errHeaders.set("Access-Control-Allow-Credentials", "true");
    
    return new Response(`Proxy error: ${error.message}`, { 
      status: 502,
      headers: errHeaders
    });
  }
};
