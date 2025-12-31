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
2. **Cheque by mail** payable to "Migs List" at mailing address above

## Finance Module

Access at: `/admin/finance`

Features:
- **Dashboard** - YTD income/expenses, net profit, outstanding invoices
- **Income Tracking** - Record payments with method, reference, customer
- **Expense Tracking** - Categories, receipt uploads, currency (CAD/USD), expiry dates
- **Invoicing** - Create/send invoices (INV-YYYY-NNN format), PDF generation
- **Payment Receipts** - Generate PDF receipts for customers
- **Tax Reports** - Annual summaries for CRA (T2125)

Expense Categories: Server, Domain, Software, Office, Marketing, Professional, Banking, Other

Database tables: `income`, `expenses`, `invoices`

## Recent Updates (Dec 2025)

- **Finance module** - Full income/expense/invoice tracking for taxes
- Redesigned landing page with professional look
- Added sticky navigation header
- Trust badges: Secure & Encrypted, Made in Canada, Servers in Canada, Built for Unions
- Updated video tutorials page with 11 tutorial cards
- Added new features: Rank-and-file exports, Excel import, PDF exports
- Business registration as Ontario sole proprietorship
- Added cheque payment option with mailing address
- Professional contact emails (payments@, support@, demo@)
