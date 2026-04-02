import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/x-ndjson; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function createStaticServer(rootDir, preferredPort) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname.endsWith("/")) {
        pathname = `${pathname}index.html`;
      }

      if (!path.extname(pathname)) {
        pathname = `${pathname}/index.html`;
      }

      const filePath = path.resolve(rootDir, `.${pathname}`);
      const relativePath = path.relative(rootDir, filePath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      const extension = path.extname(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start static server."));
        return;
      }

      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}
