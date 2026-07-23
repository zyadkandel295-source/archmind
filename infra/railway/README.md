# Railway

Create these services:

1. `web` from `apps/web/Dockerfile`
2. `api` from `apps/api/Dockerfile`
3. `worker` with command `npm run worker -w @archmind/api`
4. PostgreSQL plugin
5. Redis plugin

Set the environment variables from `.env.example`. The API health check path is:

```text
/api/health
```

Recommended deployment commands:

```bash
railway up --service api
railway up --service worker
railway logs --tail
```
