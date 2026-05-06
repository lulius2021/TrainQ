/**
 * One-time script: uploads all exercise PNGs from scripts/exercise-images/
 * to Supabase Storage bucket "exercises".
 *
 * Prerequisites:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to your local .env or export it in the shell
 *      export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *   2. Run from the project root: node scripts/upload-exercise-images.mjs
 *
 * After a successful run the images are served from:
 *   https://ilfsxckixlsyanuovfum.supabase.co/storage/v1/object/public/exercises/<filename>
 *
 * Set this in .env (and on every deployment target):
 *   VITE_EXERCISES_CDN_URL=https://ilfsxckixlsyanuovfum.supabase.co/storage/v1/object/public/exercises
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXERCISES_DIR = join(__dirname, "exercise-images");
const BUCKET = "exercises";

const SUPABASE_URL = "https://ilfsxckixlsyanuovfum.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
      "Export it before running:\n" +
      "  export SUPABASE_SERVICE_ROLE_KEY=your-key-here\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MIME = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function main() {
  const files = (await readdir(EXERCISES_DIR)).filter((f) =>
    [".png", ".webp", ".jpg", ".jpeg"].includes(extname(f).toLowerCase())
  );

  console.log(`Uploading ${files.length} images to Supabase Storage…\n`);

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const path = join(EXERCISES_DIR, file);
    const data = await readFile(path);
    const contentType = MIME[extname(file).toLowerCase()] ?? "image/png";

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(file, data, { contentType, upsert: true, cacheControl: "31536000" });

    if (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${file}`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} uploaded, ${fail} failed.`);

  if (fail === 0) {
    console.log(
      "\nAll images uploaded.\n" +
        "Public URLs:\n" +
        "  https://ilfsxckixlsyanuovfum.supabase.co/storage/v1/object/public/exercises/<filename>\n"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
