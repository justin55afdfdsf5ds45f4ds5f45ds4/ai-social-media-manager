#!/usr/bin/env node
/* tools/asset.mjs — generate video assets (objects, props, icons, cutouts) with fal.ai.
 *
 *   node tools/asset.mjs shot   <video> <seconds> <out.png>                 frame grab (a reference for the look)
 *   node tools/asset.mjs gen    <out.png> --prompt "…" [--ref a.png,b.png] [--style S02] [--bg transparent|flat] [--quality low|medium|high] [--size 1024x1024|1024x1536|1536x1024]
 *   node tools/asset.mjs cutout <in.png> <out.png> [--how birefnet|bria|chroma] [--key FF00FF]
 *   node tools/asset.mjs make   <out.png> --prompt "…" [gen options]        gen on a flat key colour, then cutout (birefnet, chroma fallback)
 *
 * Models (fal.ai): fal-ai/gpt-image-1.5 (text→image), fal-ai/gpt-image-1.5/edit (references→image),
 * fal-ai/birefnet/v2 and fal-ai/bria/background/remove (background removal). FAL_KEY comes from the root .env.
 *
 * Rule of thumb (docs/reel-method.md): ask for ONE object, centred, nothing else, no text; prefer a native
 * transparent background; when the model refuses transparency, generate on flat magenta and segment it out.
 * Chroma key is the last resort (fails on green/blue objects and leaves fringes).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(fs.existsSync(path.join(ROOT, ".env")) ? fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }) : []);
const KEY = process.env.FAL_KEY || env.FAL_KEY;

const STYLE_HINTS = {
  S01: "photographic, sepia-toned paper cutout with a thin light paper edge, soft contact shadow, collage prop",
  S02: "dark matte glass object, subtle rim light from the top-left, deep soft drop shadow, desaturated green-grey palette, premium and minimal",
};
const OBJECT_RULES = "A single object, centred, filling about 70% of the frame, nothing else in the frame, no text, no letters, no watermark, no floor, no scene.";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}
const mime = f => ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[path.extname(f).toLowerCase()] || "application/octet-stream");
const dataUri = f => `data:${mime(f)};base64,${fs.readFileSync(f).toString("base64")}`;

async function fal(model, input) {
  if (!KEY) throw new Error("FAL_KEY missing: add it to .env (see .env.example)");
  const r = await fetch(`https://fal.run/${model}`, { method: "POST", headers: { Authorization: `Key ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${model} -> HTTP ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}
async function download(url, out) {
  const r = await fetch(url); if (!r.ok) throw new Error(`download ${r.status}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
}

/* ---- commands ---- */
function shot(video, t, out) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-update", "1", out]);
  console.log(`shot ${t}s of ${path.basename(video)} -> ${out}`);
}

async function gen(out, o) {
  if (!o.prompt) throw new Error("--prompt is required");
  const bg = o.bg || "transparent";
  const size = o.size || "1024x1024";
  const style = o.style && STYLE_HINTS[o.style] ? ` Style: ${STYLE_HINTS[o.style]}.` : "";
  const bgLine = bg === "transparent" ? " Transparent background." : " Background: one flat, solid, uniform magenta (#FF00FF) colour field, no gradient, no shadow on the background, no vignette.";
  const prompt = `${o.prompt}. ${OBJECT_RULES}${style}${bgLine}`;
  const refs = o.ref ? String(o.ref).split(",").map(s => s.trim()).filter(Boolean) : [];
  const base = { prompt, quality: o.quality || "medium", image_size: size, num_images: 1, output_format: "png", background: bg === "transparent" ? "transparent" : "opaque" };
  const model = refs.length ? "fal-ai/gpt-image-1.5/edit" : "fal-ai/gpt-image-1.5";
  const input = refs.length ? { ...base, image_urls: refs.map(dataUri) } : base;
  console.log(`gen (${model}, ${base.quality}, ${size}, bg ${bg}${refs.length ? `, ${refs.length} ref` : ""})…`);
  const t0 = Date.now();
  const res = await fal(model, input);
  const url = res.images?.[0]?.url; if (!url) throw new Error("no image in response: " + JSON.stringify(res).slice(0, 300));
  await download(url, out);
  console.log(`-> ${out} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return out;
}

async function cutout(inp, out, o) {
  const how = o.how || "birefnet";
  if (how === "chroma") {
    const key = (o.key || "FF00FF").replace("#", "");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-vf", `colorkey=0x${key}:0.30:0.10,despill=type=green`, "-c:v", "png", out]);
    console.log(`cutout (chroma 0x${key}) -> ${out}`);
    return out;
  }
  const model = how === "bria" ? "fal-ai/bria/background/remove" : "fal-ai/birefnet/v2";
  const input = how === "bria" ? { image_url: dataUri(inp) } : { image_url: dataUri(inp), model: "General Use (Heavy)", operating_resolution: "1024x1024", refine_foreground: true, output_format: "png" };
  console.log(`cutout (${model})…`);
  const res = await fal(model, input);
  const url = res.image?.url; if (!url) throw new Error("no image in response: " + JSON.stringify(res).slice(0, 300));
  await download(url, out);
  console.log(`-> ${out}`);
  return out;
}

async function make(out, o) {
  const flat = out.replace(/\.png$/i, ".flat.png");
  await gen(flat, { ...o, bg: "flat" });
  try { await cutout(flat, out, { how: o.how || "birefnet" }); }
  catch (e) { console.warn("segmentation failed, chroma fallback:", e.message); await cutout(flat, out, { how: "chroma" }); }
  return out;
}

const o = args(process.argv.slice(2));
const [cmd, a, b, c] = o._;
try {
  if (cmd === "shot") shot(a, b, c);
  else if (cmd === "gen") await gen(a, o);
  else if (cmd === "cutout") await cutout(a, b, o);
  else if (cmd === "make") await make(a, o);
  else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(cmd ? 1 : 0); }
} catch (e) { console.error("asset:", e.message); process.exit(1); }
