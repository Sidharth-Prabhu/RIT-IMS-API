import apiHandler from "./netlify/edge-functions/ims-api.ts";
import proxyHandler from "./netlify/edge-functions/ims-proxy.ts";

const PORT = parseInt(Deno.env.get("PORT") || "3000", 10);

Deno.serve({ port: PORT, host: "0.0.0.0" }, async (request) => {
  const url = new URL(request.url);
  
  // Enable CORS headers
  const origin = request.headers.get("origin") || "*";
  const corsHeaders = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-CSRF-TOKEN, Cookie",
  });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (url.pathname.startsWith("/api")) {
      return await apiHandler(request, {} as any);
    }
    
    if (url.pathname.startsWith("/ims")) {
      return await proxyHandler(request, {} as any);
    }
  } catch (err: any) {
    console.error(`Error handling ${request.method} ${url.pathname}:`, err);
    return new Response(JSON.stringify({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: err.message || "An internal error occurred."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
});
