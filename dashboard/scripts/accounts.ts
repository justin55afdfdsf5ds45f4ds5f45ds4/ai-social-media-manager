/** Verify the API key and list connected social accounts. */
import { blotato } from "../lib/blotato";

async function main() {
  const me = await blotato.me();
  console.log(`Blotato user ${me.id} · ${me.subscriptionStatus} (${me.subscriptionPlan ?? "plan unknown"})`);
  const accounts = await blotato.accounts();
  if (!accounts.length) {
    console.log("No social accounts connected. Connect one at https://my.blotato.com/settings");
    return;
  }
  console.log("\n  id       platform    username / name");
  for (const a of accounts) {
    const mark = a.id === process.env.INSTAGRAM_ACCOUNT_ID ? "▶" : " ";
    console.log(`${mark} ${a.id.padEnd(8)} ${a.platform.padEnd(11)} ${a.username || a.fullname}`);
  }
  console.log("\n▶ = INSTAGRAM_ACCOUNT_ID in .env");
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
