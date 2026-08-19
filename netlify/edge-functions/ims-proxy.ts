import type { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  
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
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
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
      if (rewrittenLocation.includes("ims.ritchennai.edu.in")) {
        rewrittenLocation = rewrittenLocation.replace(/https:\/\/ims\.ritchennai\.edu\.in/gi, `${url.origin}/ims`);
      } else if (rewrittenLocation.startsWith("/")) {
        rewrittenLocation = "/ims" + rewrittenLocation;
      }
      newHeaders.set("location", rewrittenLocation);
    }

    // 2. Tweak cookies to allow them on the Netlify domain (removing domain restriction)
    const setCookies = response.headers.getSetCookie?.() || [];
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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return new Response(`Proxy error: ${error.message}`, { status: 502 });
  }
};
