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

## Recent Updates (Dec 2025)

- Redesigned landing page with professional look
- Added sticky navigation header
- Trust badges: Secure & Encrypted, Made in Canada, Servers in Canada, Built for Unions
- Updated video tutorials page with 11 tutorial cards
- Added new features: Rank-and-file exports, Excel import, PDF exports
