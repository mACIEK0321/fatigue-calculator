# Deployment Guide

## 1. What to prepare first

- Hetzner Cloud account and SSH key.
- Domain or subdomain for the API, for example `api.example.com`.
- Vercel project for the frontend.
- DNS access for the domain.

## 2. Create the Hetzner server

1. Create an Ubuntu 24.04 server in Hetzner.
2. Attach the SSH key during provisioning.
3. Open only ports `22`, `80`, and `443` in the firewall.
4. SSH into the server as `root`.

## 3. Prepare the system

1. Update the system:
   `apt update && apt upgrade -y`
2. Create a deploy user:
   `adduser deploy`
   `usermod -aG sudo deploy`
3. Install runtime dependencies:
   `apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx`
4. Enable Docker:
   `systemctl enable --now docker`
5. Re-login as `deploy`.

## 4. Put the code on the server

1. Clone the repository into `/srv/fatigue_calculator`.
2. Change into the project directory.
3. Copy `backend/.env.example` to `backend/.env` and fill production values.
4. Set `ALLOWED_ORIGINS` to the real Vercel URL, for example:
   `ALLOWED_ORIGINS=https://your-app.vercel.app`
5. Keep `APP_VERSION` and `LOG_LEVEL` as needed.

## 5. Start the backend

1. Build and start the container:
   `docker compose up -d --build`
2. Check the backend health endpoint locally:
   `curl http://127.0.0.1:8000/api/health`
3. Check container logs if needed:
   `docker compose logs -f backend`

## 6. Set up reverse proxy

1. Copy `deployment/nginx-fatigue-backend.conf` to `/etc/nginx/sites-available/fatigue-backend`.
2. Replace `api.example.com` with the real hostname.
3. Enable the site:
   `ln -s /etc/nginx/sites-available/fatigue-backend /etc/nginx/sites-enabled/fatigue-backend`
4. Test the config:
   `nginx -t`
5. Reload Nginx:
   `systemctl reload nginx`

## 7. Add HTTPS

1. Point the DNS `A` record for `api.example.com` to the Hetzner server IP.
2. Issue the TLS certificate:
   `certbot --nginx -d api.example.com`
3. Verify HTTPS:
   `curl https://api.example.com/api/health`

## 8. Connect Vercel

1. In Vercel, set `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api`.
2. Redeploy the frontend.
3. Confirm the browser calls the API over HTTPS, not localhost.

## 9. Restart after changes

- Rebuild and restart the backend:
  `docker compose up -d --build`
- View logs:
  `docker compose logs -f backend`
- Restart Nginx:
  `systemctl reload nginx`

## 10. Typical failure modes

- `502 Bad Gateway`: backend container is down or Nginx proxy target is wrong.
- `CORS` errors: `ALLOWED_ORIGINS` does not include the Vercel URL.
- `HTTPS` errors: DNS still points elsewhere or the certificate was not issued.
- `frontend` cannot reach API: `NEXT_PUBLIC_API_BASE_URL` is missing or still points to localhost.
