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

## Local Development

- Local repo: /home/wayne/migs
- Run locally: `npm run dev` (uses node --watch)
