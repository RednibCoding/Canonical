# Canonical Server - Netcup Setup

## Prerequisites
- Node.js v18+ installed on your server
- Domain/subdomain pointing to your server IP (e.g., `canonical.yourdomain.com`)

## Step 1: Copy Files to Server

Copy all game files to `/opt/canonical-server/` on your Netcup server:

```bash
# From your local machine (or use SFTP)
scp -r ./* root@YOUR_SERVER_IP:/opt/canonical-server/
```

Or via SFTP, upload to: `sftp://root@YOUR_SERVER_IP/opt/canonical-server/`

Make sure the folder structure looks like:
```
/opt/canonical-server/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── Game.js
│   ├── Network.js
│   ├── Terrain.js
│   ├── Worm.js
│   ├── Projectile.js
│   ├── Explosion.js
│   ├── AI.js
│   └── utils.js
└── server/
    ├── server.js
    └── package.json
```

Install dependencies on the server:
```bash
cd /opt/canonical-server/server
npm install
```

## Step 2: Create Systemd Service

Create the service file:
```bash
sudo nano /etc/systemd/system/canonical.service
```

Paste this content:
```ini
[Unit]
Description=Canonical Game Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/canonical-server
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
Environment=PORT=80
Environment=STATIC_DIR=/opt/canonical-server

[Install]
WantedBy=multi-user.target
```

Save and exit (Ctrl+X, Y, Enter).

## Step 3: Start the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable canonical
sudo systemctl start canonical
sudo systemctl status canonical
```

## Step 4: Open Firewall Port

```bash
sudo ufw allow 80/tcp
```

## Step 5: Access the Game

Once DNS propagates, access at:
- http://canonical.yourdomain.com

Check DNS propagation:
```bash
nslookup canonical.yourdomain.com
```

## Useful Commands

```bash
# Check server status
sudo systemctl status canonical

# View logs
sudo journalctl -u canonical -f

# Restart server
sudo systemctl restart canonical

# Stop server
sudo systemctl stop canonical
```

## Updating the Game

After making changes locally:
1. Copy updated files to `/opt/canonical-server/`
2. Restart the service: `sudo systemctl restart canonical`
