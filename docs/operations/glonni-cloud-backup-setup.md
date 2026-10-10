# Glonni cloud backup and restore (Step 2)

## Current status

The cloud-only workflows are staged on the separate branch `backup/step2-cloud-only`; they are not on `main`, have not run, and have not changed Supabase or the live website. The backup uses GitHub Actions to export the database and Storage objects and upload plain (unencrypted) archives to the private Drive folder. It does not use a Mac or an encryption key.

The two older encrypted files already in Drive are left untouched. The new workflows do not read, require, or remove their key.

The backup workflow includes a daily 12:30 a.m. `Asia/Kolkata` schedule, but scheduled runs are gated by the GitHub repository variable `GLONNI_BACKUPS_ENABLED=true`. It must remain unset until the first backup and isolated restore are verified and the owner approves activation. GitHub may delay scheduled runs during busy periods.

## What the backup workflow does

1. Uses the Supabase CLI to export role definitions, schema, database rows, and Supabase migration history from the source project.
2. Uses the Supabase S3-compatible endpoint to copy every listed Storage bucket and its files.
3. Creates compressed database and Storage archives plus a manifest and SHA-256 checksums. Compression is not encryption; the files remain readable to anyone with access to the private Drive folder.
4. Uploads to `Glonni-backups/<timestamp>-<run-id>-<attempt>` in the selected Drive folder and verifies the uploaded files by downloading/checking their contents.
5. Marks a folder verified only after checksum verification; after a successful new backup it keeps the newest 30 verified folders and moves older folders to Drive Trash.

The export only reads the source project. Role passwords are not included; custom login-role passwords must be reset when restoring. Supabase's backup guidance notes that database exports do not include Storage file contents, so the workflow backs those up separately.

## What the restore workflow does

The manual restore workflow downloads a selected backup from Drive, verifies its checksums, and restores its database and Storage files to a separate Supabase target. It refuses to run when the target project reference equals the source project reference, and checks that the target pooler username and Storage endpoint match the isolated target project.

The target must be a new, empty, isolated Supabase project. Do not use production credentials. A failed restore can leave the isolated target partially restored; review it before reuse.

## GitHub secret setup

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add the names below one at a time. Do not send secret values in chat, put them in files, or commit them.

### Backup secrets

| Secret name | Where to get its value |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Project reference from the Supabase Dashboard URL |
| `SUPABASE_DB_HOST` | Supabase Connect panel: Session pooler host |
| `SUPABASE_DB_PORT` | Supabase Connect panel: Session pooler port |
| `SUPABASE_DB_NAME` | Supabase Connect panel: database name |
| `SUPABASE_DB_USER` | Supabase Connect panel: Session pooler username |
| `SUPABASE_DB_PASSWORD` | Current database password |
| `SUPABASE_S3_ENDPOINT` | Supabase Storage settings: S3 endpoint |
| `SUPABASE_S3_REGION` | Supabase Storage settings: S3 region |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase Storage settings: generated S3 access key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Matching generated S3 secret key |
| `GOOGLE_DRIVE_CLIENT_ID` | Google OAuth client used by rclone |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Matching Google OAuth client secret |
| `GOOGLE_DRIVE_TOKEN_JSON` | rclone OAuth token for the Google account that owns the private folder |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Folder ID from the supplied Google Drive folder URL |

The Supabase S3 access keys have full Storage access and bypass Storage RLS, so use them only as server-side GitHub Actions secrets. The connected Drive session in Codex cannot be reused by a GitHub runner; the runner needs its own rclone OAuth token. Do not paste that token here.

The database password was previously shared in chat. Before saving `SUPABASE_DB_PASSWORD`, reset it to a new unique value and enter it directly in GitHub Secrets. Do not reuse a value previously posted in chat.

There is no `BACKUP_ENCRYPTION_KEY` secret in this workflow.

### Additional secrets for isolated restore

After creating or selecting a dedicated empty test Supabase project, add these secrets before attempting the restore workflow:

`RESTORE_PROJECT_REF`, `RESTORE_DB_HOST`, `RESTORE_DB_PORT`, `RESTORE_DB_NAME`, `RESTORE_DB_USER`, `RESTORE_DB_PASSWORD`, `RESTORE_S3_ENDPOINT`, `RESTORE_S3_REGION`, `RESTORE_S3_ACCESS_KEY_ID`, and `RESTORE_S3_SECRET_ACCESS_KEY`.

Use the test project's own Session Pooler values and S3 settings. The restore workflow requires the pooler username to be `postgres.<test-project-ref>` and the S3 endpoint to contain that same project reference.

## Workflow activation and remaining user actions

GitHub only offers manual workflow runs and scheduled runs when the workflow file is on the repository's default branch. These files are still on a separate branch because prior Step 2 instructions said not to merge into `main` or change the live site. The repository is connected to Vercel, so adding these workflow-only files to `main` may still cause Vercel to start a build/deployment. No merge or deployment has been made.

Before a real run:
1. Add the backup secrets in GitHub Settings; do not paste values into chat.
2. Create or identify a dedicated empty Supabase test project and add the restore-only secrets.
3. Decide whether to allow these workflow/documentation files onto `main` despite the possible Vercel build, or use a separate backup-only repository.
4. After activation, manually run the backup, inspect its Drive result, manually run restore to the isolated project, and verify database and Storage contents.
5. Only after those checks and owner approval, set `GLONNI_BACKUPS_ENABLED=true` to activate daily backups. Enable GitHub Actions failure notifications for the repository owner.

## Source reconciliation findings

- Supabase currently lists 7 active Edge Functions. Their deployed source files and import maps were retrieved and compared with the backup branch; all available files matched exactly. A limited scan found no obvious hardcoded API-token/password patterns. Function names: `admin-invite-user`, `ai-owner-chat`, `provider-webhook`, `ai-product-enrichment`, `ai-job-runner`, `ai-provider-health`, and `cuelinks`.
- Supabase lists 100 migration records and the branch contains 100 migration files. 82 match by exact version and name. 17 have the same migration name but a different timestamp/version in the file name than Supabase records, and one recorded migration name (`deactivate_seed_catalog_20261009`) differs from the repository filename (`deactivate_seed_catalog`). This remains unresolved; do not run `db push`, rename migrations, or reapply them until the history and SQL effects are reconciled.
- The local checkout still differs from GitHub `main` (one local commit ahead and 16 commits behind). Commit `7d18091` is preserved on `backup/local-unpushed-7d18091`. The local checkout was not changed during this work.

## Step 2 completion status

Not complete yet. The workflows are drafted, but no cloud backup or restore has run because GitHub Actions secrets are not configured and the workflows are not on the default branch. There is no verified unencrypted Actions backup in Drive yet. Migration-history naming/version drift also needs a safe review.

Supabase references: [Database backup guidance](https://supabase.com/docs/guides/platform/backups), [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), and [S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).
