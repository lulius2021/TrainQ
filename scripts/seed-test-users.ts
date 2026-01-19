
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SITE_URL = process.env.VITE_SITE_URL || "http://localhost:5173";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = "trainq1234";

const USERS = [
    ...Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const id = n < 10 ? `0${n}` : `${n}`; // pro01..pro10
        return {
            email: `pro${id}@testflight.trainq`,
            password: TEST_PASSWORD,
            user_metadata: { plan: "pro", is_testflight: true, full_name: `Pro User ${id}` },
        };
    }),
    ...Array.from({ length: 6 }, (_, i) => {
        const n = i + 1;
        const id = n < 10 ? `0${n}` : `${n}`; // free01..free06
        return {
            email: `free${id}@testflight.trainq`,
            password: TEST_PASSWORD,
            user_metadata: { plan: "free", is_testflight: true, full_name: `Free User ${id}` },
        };
    }),
];

async function seed() {
    console.log(`🌱 Seeding ${USERS.length} test users...`);

    for (const u of USERS) {
        // 1. Check if user exists
        const list = await supabase.auth.admin.listUsers();
        // Simple filter (inefficient for large dbs but fine for test)
        // Actually listUsers is paginated, but for test env likely fine.
        // Better: createUser and catch error or listUsers with filter if supported?
        // Admin listUsers doesn't support email filter easily in JS client versions sometimes.
        // We'll try to create, if error "User already registered", we update.

        // Actually, createClient admin.createUser auto-confirms usually.

        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: u.user_metadata,
        });

        if (created?.user) {
            console.log(`✅ Created ${u.email}`);
        } else if (createError && createError.message.includes("already registered")) {
            // Update existing
            // We need the ID. Loopups are annoying without filter.
            // Let's rely on listUsers to find ID.
        } else {
            console.error(`❌ Create failed ${u.email}:`, createError?.message);
        }
    }

    // Idempotency Pass: Ensure metadata is up to date for ALL (including existing)
    // Get all users
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
        console.error("❌ Failed to list users for update:", listError.message);
        return;
    }

    for (const u of USERS) {
        const existing = allUsers.users.find(x => x.email === u.email);
        if (existing) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
                user_metadata: u.user_metadata,
                password: u.password // Reset password to ensure test access
            });
            if (updateError) console.error(`❌ Update failed ${u.email}:`, updateError.message);
            else console.log(`🔄 Updated ${u.email}`);
        }
    }

    console.log("🏁 Seeding complete.");
}

seed().catch(e => console.error(e));
