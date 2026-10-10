# Glonni cloud backup setup (Step 2)

## Current status

The workflow is staged on the separate branch `backup/step2-cloud-workflow`. It is **manual-only** and is not on `main`. It has not run because the required credentials are not configured in GitHub Actions. No database or Storage export was started by this workflow, and nothing in the production project was changed.

The first successful cloud run must be reviewed and followed by an isolated restore test. Only then should the daily schedule and 30-backup retention be enabled.

## What a run will do

- Connect to Postgres through the Supabase Session Pooler and create a logical archive with `pg_dump` (read-only).
- Export the contents of every S3-listed Supabase Storage bucket. The database archive also preserves Storage bucket/object metadata.
- Save a separate CSV snapshot of PostgreSQL role attributes/settings. Password hashes are intentionally not exported; role passwords must be reset if a role is recreated.
- Encrypt all three outputs with GPG AES-256 using the recovery key supplied as a GitHub Actions secret.
- Decrypt and inspect the archives locally on the temporary GitHub runner, upload them to the designated private Drive folder, and compare uploaded files against the local encrypted files.
- Delete the temporary runner files when the job exits.

It does not write to Supabase, delete Storage files, upload unencrypted database or object archives to Drive, or run on pull requests/pushes. The manifest contains only timestamps, counts, and checksums.

## GitHub Actions secrets to add

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add each item below as a repository secret. Do not paste these values into a chat, source file, issue, or commit.

| Secret name | Value to use |
| --- | --- |
| `SUPABASE_DB_HOST` | Session Pooler host from Supabase Connect |
| `SUPABASE_DB_PORT` | Session Pooler port |
| `SUPABASE_DB_NAME` | Database name |
| `SUPABASE_DB_USER` | Session Pooler username (the username includes the project reference) |
| `SUPABASE_DB_PASSWORD` | The current database password |
| `SUPABASE_S3_ENDPOINT` | S3 endpoint from Supabase Storage settings |
| `SUPABASE_S3_REGION` | Region shown in the same S3 settings panel |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase Storage S3 access key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Matching S3 secret key |
| `GOOGLE_DRIVE_CLIENT_ID` | Your own Google OAuth client ID for rclone |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Matching OAuth client secret |
| `GOOGLE_DRIVE_TOKEN_JSON` | rclone OAuth token JSON for your Google account |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID of the private Drive backup folder |
| `BACKUP_ENCRYPTION_KEY` | The exact recovery key saved in Apple Passwords |

Use the Session Pooler values—not the direct database host. Before saving `SUPABASE_DB_PASSWORD`, rotate it again to a new unique password because a previous database password was posted in the chat. Then update any other systems that use that database password. Do not reuse the posted value.

The S3 keys are server-side credentials with broad Storage access. Keep them only in GitHub Secrets and do not enable this workflow until you have confirmed the endpoint and region in Supabase. Supabase says these keys bypass Storage RLS and are intended for server-side use. [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)

## Google Drive OAuth

The Codex Drive connection is not automatically available to a GitHub runner. The workflow needs its own rclone OAuth token. Create/use a Google OAuth client, run rclone's browser authorization while signed in to the Google account that owns the backup folder, and copy the resulting token JSON directly into the `GOOGLE_DRIVE_TOKEN_JSON` secret. Never send the token to me. Use a dedicated OAuth client; rclone notes its shared client ID is being retired during 2026. [rclone Google Drive setup](https://rclone.org/drive/)

The workflow sets the provided folder as the rclone remote root and writes into a `Glonni-backups` subfolder. Keep that Drive folder private.

## Important activation boundary

GitHub only shows the manual **Run workflow** button after the workflow file exists on the default branch. Scheduled workflows also run only from the default branch. This branch has deliberately not been merged: adding a file to `main` may trigger the repository's existing production checks and Vercel's connected deployment. Review/approve that main-branch change before merging; do not merge this setup branch if you want to avoid that deployment for now. [GitHub workflow triggers](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

After secrets are added and the file is approved on `main`, the first run must be manual. Check the GitHub Actions result and confirm the encrypted files and checksums appear in Drive. Then test decryption and restore in an isolated database. Do not turn on unattended runs before that succeeds.

The intended daily time is **12:30 a.m. India time**. GitHub can schedule in the `Asia/Kolkata` timezone, but it warns scheduled runs may be delayed or dropped during high load. This is an intended target, not a guaranteed exact start time. For a public repository, GitHub also automatically disables scheduled workflows after 60 days without repository activity. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## Still pending

- Add the secrets securely in GitHub.
- Approve how to make the workflow available on the default branch without an unwanted Vercel production deployment.
- Run the manual workflow and verify its Drive upload.
- Test a restore in isolation.
- Only after those checks: add daily scheduling, success/failure notification handling, and safe retention of 30 verified backup sets.
