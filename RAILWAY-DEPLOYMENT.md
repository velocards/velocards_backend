# Railway Deployment Guide

## Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)

## Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `velocards.com`
4. Select the `backend` directory if asked

## Step 3: Add Redis Service
1. In your Railway project, click "New Service"
2. Select "Database" → "Redis"
3. Railway will automatically set `REDIS_URL` environment variable

## Step 4: Configure Environment Variables
1. Click on your service
2. Go to "Variables" tab
3. Click "Raw Editor"
4. Copy all variables from `.env.example.railway`
5. Update with your actual values:
   - Get `DATABASE_URL` from Supabase project settings
   - Get `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from Supabase
   - Generate secrets: `openssl rand -base64 32`
   - Add your API keys

## Step 5: Deploy
1. Railway will auto-deploy when you connect GitHub
2. Check deployment logs in "Deployments" tab
3. Look for: "Server running on port 3001"

## Step 6: Get Your URL
1. Go to "Settings" tab
2. Under "Domains", click "Generate Domain"
3. You'll get: `your-app.up.railway.app`
4. Update these env variables with your new URL:
   - `API_BASE_URL`
   - `XMONEY_CALLBACK_URL`

## Step 7: Test Your Deployment
```bash
# Test health endpoint
curl https://your-app.up.railway.app/health

# Test auth endpoint
curl https://your-app.up.railway.app/api/v1/auth/status
```

## Step 8: Custom Domain (Later)
1. Go to Settings → Domains
2. Add your custom domain: `api.yourdomain.com`
3. Update DNS with provided CNAME record

## Monitoring
- Check logs: Deployments → View Logs
- Monitor usage: Usage tab
- Set up alerts: Settings → Notifications

## Troubleshooting
1. **Build fails**: Check `npm run build` works locally
2. **App crashes**: Check environment variables
3. **Database errors**: Verify `DATABASE_URL` is correct
4. **Redis errors**: Ensure Redis service is attached

## Important URLs After Deployment
- Health: `https://your-app.up.railway.app/health`
- API Base: `https://your-app.up.railway.app/api/v1`
- Webhooks: `https://your-app.up.railway.app/webhooks`