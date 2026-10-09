import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const base = process.env.VITE_BASE_PATH || "/cleanquest/";
const output = resolve(process.argv[2] || "dist");
const origin = "https://cleanquest-build.invalid";
assert(
  base.startsWith("/") && base.endsWith("/"),
  "Base must start and end with /.",
);
assert.equal(
  new URL(base, origin).pathname,
  base,
  "Base must be a normalized local path.",
);
assert(
  !/[?#\\]/.test(base),
  "Base cannot contain a query, fragment or backslash.",
);

async function localFile(reference, parent = `${origin}${base}`) {
  const url = new URL(reference, parent);
  assert.equal(url.origin, origin, `External application asset: ${reference}`);
  assert(
    url.pathname.startsWith(base),
    `Asset outside deployment base: ${reference}`,
  );
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const path = resolve(output, relative);
  assert(
    path.startsWith(output + sep),
    `Asset outside build directory: ${reference}`,
  );
  assert((await stat(path)).isFile(), `Missing build asset: ${reference}`);
  return { relative, bytes: await readFile(path) };
}

const html = await readFile(resolve(output, "index.html"), "utf8");
assert.match(html, /<html\s+lang="sk"/);
assert.match(html, /viewport-fit=cover/);
const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map((m) => m[0]);
const linked = [];
for (const tag of tags) {
  const reference = tag.match(/(?:src|href)="([^"]+)"/)?.[1];
  if (reference) linked.push(await localFile(reference));
}
assert(
  linked.some((f) => f.relative.endsWith(".js")),
  "Missing application script.",
);
assert(
  linked.some((f) => f.relative.endsWith(".css")),
  "Missing application stylesheet.",
);
assert(
  tags.some((t) => t.includes('rel="manifest"')),
  "Missing manifest link.",
);
assert(
  tags.some((t) => t.includes('rel="apple-touch-icon"')),
  "Missing Apple icon link.",
);

const manifestAsset = await localFile("manifest.webmanifest");
const manifest = JSON.parse(manifestAsset.bytes.toString());
for (const field of ["id", "start_url", "scope"])
  assert.equal(manifest[field], base, `Manifest ${field}`);
assert.equal(manifest.name, "CleanQuest");
assert.equal(manifest.lang, "sk");
assert.equal(manifest.display, "standalone");
assert(manifest.icons.some((i) => i.sizes === "192x192"));
assert(
  manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"),
);

function pngSize(bytes) {
  assert.equal(
    bytes.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    "Invalid PNG icon.",
  );
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}
for (const icon of manifest.icons) {
  const file = await localFile(
    icon.src,
    `${origin}${base}manifest.webmanifest`,
  );
  assert.equal(icon.type, "image/png");
  assert.equal(pngSize(file.bytes), icon.sizes, `Icon dimensions: ${icon.src}`);
}
assert.equal(
  pngSize((await localFile("apple-touch-icon.png")).bytes),
  "180x180",
);

const sw = (await localFile("sw.js")).bytes.toString();
assert.match(sw, /SKIP_WAITING/, "Missing explicit update activation.");
assert.match(sw, /cleanupOutdatedCaches/, "Missing old precache cleanup.");
assert.match(
  sw,
  /createHandlerBoundToURL\("index\.html"\)/,
  "Missing offline shell fallback.",
);
const precached = new Set(
  [...sw.matchAll(/\burl:"([^"]+)"/g)].map((m) => m[1]),
);
assert(
  precached.has("index.html") && precached.has("manifest.webmanifest"),
  "Missing offline shell/manifest.",
);
for (const reference of precached) await localFile(reference);
for (const file of linked)
  assert(
    precached.has(file.relative),
    `Linked asset is not precached: ${file.relative}`,
  );
for (const file of await readdir(resolve(output, "assets")))
  if (/\.(js|css|woff2)$/.test(file))
    assert(precached.has(`assets/${file}`), `Uncached runtime asset: ${file}`);
const workbox = [...sw.matchAll(/"\.\/(workbox-[^"]+)"/g)].map((m) => m[1]);
assert(workbox.length > 0, "Missing Workbox runtime.");
for (const reference of workbox) await localFile(`${reference}.js`);
console.log(
  `Production verified: ${base}, ${linked.length} linked assets, ${precached.size} unique precache entries, PNG icons and offline shell.`,
);
