import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.DEMO_CLIENT_EMAIL || "clientdemo@denr-cenro.local";
const demoPassword = process.env.DEMO_CLIENT_PASSWORD || "ClientDemo123!";
const demoFullName = process.env.DEMO_CLIENT_FULL_NAME || "Demo Client";

if (!url || !serviceRoleKey) {
  console.error("Missing required env vars:");
  console.error("- EXPO_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const createResult = await admin.auth.admin.createUser({
  email: demoEmail,
  password: demoPassword,
  email_confirm: true,
  user_metadata: { full_name: demoFullName, role: "client" },
});

if (createResult.error && !createResult.error.message.toLowerCase().includes("already")) {
  console.error("Failed to create demo user:", createResult.error.message);
  process.exit(1);
}

const listResult = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listResult.error) {
  console.error("Failed to fetch users:", listResult.error.message);
  process.exit(1);
}

const demoUser = listResult.data.users.find((user) => user.email?.toLowerCase() === demoEmail.toLowerCase());

if (!demoUser) {
  console.error("Demo user not found after creation.");
  process.exit(1);
}

const profileResult = await admin
  .from("profiles")
  .upsert(
    {
      id: demoUser.id,
      email: demoEmail.toLowerCase(),
      full_name: demoFullName,
      role: "client",
    },
    { onConflict: "id" }
  );

if (profileResult.error) {
  console.error("Failed to upsert profile:", profileResult.error.message);
  process.exit(1);
}

console.log("Demo client is ready:");
console.log(`Email: ${demoEmail}`);
console.log(`Password: ${demoPassword}`);
