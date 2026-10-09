// Test-only static hosting: GitHub Pages serves files without an SPA rewrite.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const base = process.env.VITE_BASE_PATH || "/cleanquest/";
const output = resolve("dist");
const port = 4174;
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    if (!["GET", "HEAD"].includes(request.method) || !pathname.startsWith(base))
      throw new Error("Not found");
    let path = resolve(output, pathname.slice(base.length));
    if (path !== output && !path.startsWith(output + sep))
      throw new Error("Not found");
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    const bytes = await readFile(path);
    response.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Static test host: http://127.0.0.1:${port}${base}`),
);
