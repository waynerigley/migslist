# MigsList - Project Context

## Production Server (Vultr)

The app is deployed on Vultr, NOT Proxmox.

| What         | Details                   |
|--------------|---------------------------|
| Site         | https://migslist.com      |
| Server IP    | 155.138.149.116           |
| SSH          | ssh wayne@155.138.149.116 |
| App location | /var/www/migs             |
| Logs         | pm2 logs migs             |
| Restart app  | pm2 restart migs          |
| DB password  | See vultr info.txt        |

## Server Setup

- HTTPS with Cloudflare Origin Certificate (valid until 2040)
- Full SSL mode (encrypted end-to-end)
- Auto-restart on crash/reboot via PM2 (systemd service: pm2-wayne)
- Firewall + fail2ban for security
- Servers located in Canada

## Common Commands

```bash
# Check server status
ssh wayne@155.138.149.116 "pm2 list"

# View logs
ssh wayne@155.138.149.116 "pm2 logs migs --lines 50"

# Restart app
ssh wayne@155.138.149.116 "pm2 restart migs"

# Deploy updates
ssh wayne@155.138.149.116 "cd /var/www/migs && git pull && pm2 restart migs"

# Verify auto-start is configured
ssh wayne@155.138.149.116 "systemctl is-enabled pm2-wayne"
```

## PM2 Auto-Start

- PM2 startup service (pm2-wayne) is enabled via systemd
- Process list is saved in /home/wayne/.pm2/dump.pm2
- On server reboot, systemd automatically starts PM2, which resurrects the migs app

## Key Features

- Track Members In Good Standing
- Excel & PDF Exports
- 1-Click Voter Lists
- Export Rank-and-File Lists (members without executive roles)
- Member status tracking (Active vs Non-Active)
- Excel import for bulk member uploads
- Email system for member communication
- PDF document storage for good standing documents

## Public Pages

- `/` - Landing page with login
- `/features` - Features overview
- `/pricing` - Pricing page
- `/tutorials` - Video tutorials (11 videos)

## Video Tutorials

Thumbnails located in `/public/images/tutorials/`:
1. getting-started.png
2. team-access.png
3. creating-buckets.png
4. managing-lists.png
5. member-management.png
6. member-documents.png
7. election-prep.png
8. importing-members.png
9. exporting-data.png
10. member-status.png
11. email-system.png

## Local Development

- Local repo: /home/wayne/migs
- Run locally: `npm run dev` (uses node --watch)

## Business Info

| What              | Details                                           |
|-------------------|---------------------------------------------------|
| Business Name     | Migs List                                         |
| BIN               | 1001457886                                        |
| Type              | Ontario Sole Proprietorship                       |
| Mailing Address   | 9880 Ridge Road, Windsor, Ontario, Canada N8R 1G6 |

## Pricing

- First year: $500 CAD
- Following years: $800 CAD
- Savings: $300 first year

## Contact Emails

| Email                    | Purpose                    |
|--------------------------|----------------------------|
| payments@migslist.com    | e-Transfer payments        |
| support@migslist.com     | Customer support           |
| demo@migslist.com        | Demo/tutorial account      |

## Payment Options

1. **Interac e-Transfer** to payments@migslist.com (fastest)
2. **Cheque by mail** - Contact payments@migslist.com for mailing instructions

Note: Mailing address is hidden by default for privacy. Only shown on invoices when "Include mailing address" checkbox is checked.

## Finance Module

Access at: `/admin/finance`

Features:
- **Dashboard** - Professional design with stat cards, quick actions, invoice overview
- **Income Tracking** - Record payments with method, reference, customer
- **Expense Tracking** - Categories, receipt uploads, currency (CAD/USD), expiry dates
- **Invoicing** - Create/send invoices (INV-YYYY-NNN format), PDF generation
- **Payment Receipts** - Generate PDF receipts for customers
- **Tax Reports** - Annual summaries for CRA (T2125)

Invoice Privacy:
- Mailing address hidden by default on invoices and public pages
- Check "Include mailing address for cheque payment" when creating invoice to show address
- Protects home address while still allowing cheque payments when needed

Auto-Income Recording:
- When invoice marked as "Paid", income record is automatically created
- Shows up in dashboard YTD totals immediately

Expense Categories: Server, Domain, Software, Office, Marketing, Professional, Banking, Other

Database tables: `income`, `expenses`, `invoices`

Server Timezone: America/Toronto (set via TZ env var in .env)

## Production Deployment Checklist

When deploying new features that add database columns, ALWAYS run the migration on production:

```bash
# SSH into server and run migration
ssh root@155.138.149.116 "cd /var/www/migs && node -e \"
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// ADD YOUR ALTER TABLE STATEMENTS HERE
pool.query('SELECT 1').then(() => console.log('Migration complete')).finally(() => pool.end());
\""
```

### Required Database Columns

| Table   | Column                | Type         | Added   |
|---------|----------------------|--------------|---------|
| buckets | master_pdf_filename  | VARCHAR(255) | Jan 2026 |

---

## Incident Log

### Jan 1, 2026 - PDF Upload Failing on Unit Creation

**Symptoms:**
- Creating a unit with PDF attached showed "Something went wrong" error
- Unit was created but PDF was not attached
- PDF files were being uploaded to `/uploads/pdfs/` successfully

**Root Causes:**
1. **Missing database column**: The `master_pdf_filename` column was never added to the production `buckets` table. The feature was developed locally but the migration was never run on production.
2. **PM2 conflict**: Two PM2 daemons were running (root and wayne), both trying to run the app on port 3000, causing crash loops.

**Resolution:**
1. Killed wayne's PM2 daemon: `kill -9 5309 18600`
2. Added missing column: `ALTER TABLE buckets ADD COLUMN master_pdf_filename VARCHAR(255)`
3. Restarted PM2 with correct working directory: `pm2 start src/app.js --name migs --cwd /var/www/migs`

**Prevention:**
1. **Always run migrations on production** after deploying new features
2. **Only one PM2 instance** should run on the server (use root's PM2)
3. **Check PM2 status** after deployment: `pm2 list` should show only one instance
4. **Verify database schema** matches local before assuming feature works

---

## Recent Updates (Dec 2025)

- **Finance module** - Full income/expense/invoice tracking for taxes
- **Invoice privacy** - Mailing address hidden by default, only shown when checkbox checked
- **Auto-income** - Marking invoice as paid automatically creates income record
- **Toronto timezone** - Server uses America/Toronto for correct dates
- **Union contact info** - Can add president name/email/phone to union, shows on invoices
- Professional invoice & receipt PDFs with colored headers and status badges
- Redesigned landing page with professional look
- Added sticky navigation header
- Trust badges: Secure & Encrypted, Made in Canada, Servers in Canada, Built for Unions
- Updated video tutorials page with 11 tutorial cards
- Added new features: Rank-and-file exports, Excel import, PDF exports
- Business registration as Ontario sole proprietorship
- Professional contact emails (payments@, support@, demo@)
