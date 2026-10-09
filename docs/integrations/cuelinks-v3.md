# Cuelinks V3 connector

The \`cuelinks\` Supabase Edge Function is the server-side boundary for Glonni's first affiliate network. The API key is read only from the Supabase Edge Function secret \`CUELINKS_API_KEY\`; never place it in frontend code, a \`NEXT_PUBLIC_\` variable, GitHub, or chat.

## Supported admin actions

Send a POST request to \`/functions/v1/cuelinks\` with the signed-in Supabase administrator's bearer token and JSON body:

- \`{"action":"health"}\` checks the V3 API connection.
- \`{"action":"campaigns","page":1,"per_page":50}\` lists campaigns for India (country ID 252), sorted by 7-day EPC.
- \`{"action":"offers","campaign_id":"4821","page":1,"per_page":50}\` lists live offers. The campaign filter is optional.
- \`{"action":"convert_link","url":"https://merchant.example/product","subid":"<opaque-click-reference>"}\` creates a tracking link. Check the returned \`affiliated\` value before using it.
- \`{"action":"transactions","updated_since":"2026-10-01T00:00:00Z"}\` reads transactions for reconciliation.

Every action requires a valid Supabase JWT, an AAL2 session, and an active owner/admin employee record. The endpoint does not write to the catalog or publish deals. Admin review and catalog mapping are a separate step. Cuelinks offers are deals/coupons, not a full SKU product feed.

## Required Cuelinks V3 scopes

Use \`read:campaigns\`, \`read:offers\`, \`write:links\`, and \`read:transactions\` for the implemented actions. \`read:reports\` can support the next reporting pass. Other scopes are not used by this function.

## Configure the secret

In Supabase Dashboard, open the **Glonni Affiliate** project, go to **Edge Functions → Secrets**, add \`CUELINKS_API_KEY\` with the V3 key as its value, then deploy or redeploy the \`cuelinks\` function. Do not send the value in chat. This repository does not contain the key.

## Deployment

Deploy with JWT verification enabled. Keep the same function source in this repository and in the Supabase project. The function uses a fixed Cuelinks API host and only exposes the supported actions above; it does not accept arbitrary provider URLs.
