# Chat Application - Free Deployment Guide

This guide will teach you how to deploy your chat application **for free** using:
- **Cloudflare Pages** - Frontend (React)
- **Render.com** - Backend (.NET API)
- **Neon.tech** - Database (PostgreSQL)

**Total Cost: $0/month**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Set Up Database (Neon.tech)](#step-1-set-up-database-neontech)
3. [Step 2: Deploy Backend (Render.com)](#step-2-deploy-backend-rendercom)
4. [Step 3: Deploy Frontend (Cloudflare Pages)](#step-3-deploy-frontend-cloudflare-pages)
5. [Step 4: Connect Everything](#step-4-connect-everything)
6. [Testing Your Deployment](#testing-your-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Understanding the Limitations](#understanding-the-limitations)

---

## Prerequisites

Before you start, you need:

1. **A GitHub account** - [Sign up free](https://github.com/signup)
2. **Your code on GitHub** - Push this project to a GitHub repository
3. **Basic terminal knowledge** - You'll copy/paste some commands

### Push Your Code to GitHub

If your code isn't on GitHub yet:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/chat-application.git
git branch -M main
git push -u origin main
```

---

## Step 1: Set Up Database (Neon.tech)

Neon provides free PostgreSQL databases that never expire.

### 1.1 Create Account

1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"**
3. Sign up with GitHub (easiest)

### 1.2 Create a Project

1. Click **"Create a project"**
2. Enter project name: `chatapp`
3. Select region closest to you (or `us-east-1` for US)
4. Click **"Create project"**

### 1.3 Get Your Connection String

1. After creation, you'll see a connection string like:
   ```
   postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/chatapp?sslmode=require
   ```
2. **Copy this string** - you'll need it for the backend

### 1.4 Important Notes

- **Free tier limits:** 0.5 GB storage, auto-suspends when idle
- **That's okay!** Auto-suspend saves resources and it wakes up automatically

---

## Step 2: Deploy Backend (Render.com)

Render.com will host your .NET API.

### 2.1 Create Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with GitHub

### 2.2 Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select your chat-application repo

### 2.3 Configure the Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `chatapp-api` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Docker |
| **Instance Type** | Free |

### 2.4 Set Environment Variables

Click **"Advanced"** and add these environment variables:

| Key | Value |
|-----|-------|
| `ConnectionStrings__DefaultConnection` | Your Neon connection string from Step 1.3 |
| `Jwt__SecretKey` | Generate: `openssl rand -base64 32` or use a random 32+ char string |
| `Jwt__Issuer` | `ChatApp` |
| `Jwt__Audience` | `ChatApp` |
| `Jwt__ExpirationMinutes` | `60` |
| `Jwt__RefreshTokenExpirationDays` | `7` |
| `Cors__AllowedOrigins__0` | `https://your-frontend.pages.dev` (update after Step 3) |
| `FileStorage__BasePath` | `/app/uploads` |
| `FileStorage__MaxFileSizeBytes` | `104857600` |
| `Admin__Username` | `admin` |
| `Admin__Password` | Your secure password |

### 2.5 Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes first time)
3. Your API URL will be: `https://chatapp-api.onrender.com`

### 2.6 Verify Backend

Visit: `https://chatapp-api.onrender.com/swagger`

You should see the Swagger API documentation page.

---

## Step 3: Deploy Frontend (Cloudflare Pages)

Cloudflare Pages has **unlimited bandwidth** on free tier!

### 3.1 Create Account

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up (email or GitHub)

### 3.2 Create Pages Project

1. Click **"Create a project"**
2. Click **"Connect to Git"**
3. Select your GitHub repository

### 3.3 Configure Build Settings

| Setting | Value |
|---------|-------|
| **Project name** | `chatapp` |
| **Production branch** | `main` |
| **Framework preset** | Vite |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `frontend/web` |

### 3.4 Set Environment Variables

Click **"Environment variables"** and add:

| Variable name | Value |
|---------------|-------|
| `VITE_API_URL` | `https://chatapp-api.onrender.com/api` |
| `VITE_HUB_URL` | `https://chatapp-api.onrender.com/hubs/chat` |

> Replace `chatapp-api` with your actual Render service name!

### 3.5 Deploy

1. Click **"Save and Deploy"**
2. Wait for build (2-3 minutes)
3. Your frontend URL: `https://chatapp.pages.dev`

---

## Step 4: Connect Everything

Now update the backend CORS to allow your frontend:

### 4.1 Update Render Environment Variables

1. Go to Render dashboard → Your service → Environment
2. Update `Cors__AllowedOrigins__0`:
   ```
   https://chatapp.pages.dev
   ```
3. Click **"Save Changes"**
4. Render will automatically redeploy

### 4.2 Verify Connection

1. Open your frontend: `https://chatapp.pages.dev`
2. Try to register a new account
3. If it works, you're done! 🎉

---

## Testing Your Deployment

### Quick Tests

1. **Frontend loads:** Visit `https://chatapp.pages.dev`
2. **API responds:** Visit `https://chatapp-api.onrender.com/swagger`
3. **Database works:** Register a new user
4. **Real-time works:** Open two browsers, send a message

### Health Check URLs

- Frontend: `https://chatapp.pages.dev/health`
- Backend: `https://chatapp-api.onrender.com/health`

---

## Troubleshooting

### "502 Bad Gateway" on Backend

**Cause:** First request after sleep (cold start)

**Solution:** Wait 30-60 seconds, the service is waking up

### "CORS Error" in Browser Console

**Cause:** Backend doesn't allow frontend origin

**Solution:**
1. Go to Render → Environment
2. Check `Cors__AllowedOrigins__0` matches your Cloudflare URL exactly
3. Include `https://` and no trailing slash

### "Connection Refused" for SignalR

**Cause:** WebSocket connection failing

**Solution:** Make sure `VITE_HUB_URL` is correct (with `/hubs/chat`)

### Database Connection Failed

**Cause:** Wrong connection string or database sleeping

**Solutions:**
1. Verify connection string in Render environment
2. Go to Neon dashboard and check if project is active
3. Make sure `?sslmode=require` is in connection string

### Frontend Shows Blank Page

**Cause:** Build failed or wrong build settings

**Solutions:**
1. Check Cloudflare build logs
2. Verify `Build output directory` is `dist`
3. Verify `Root directory` is `frontend/web`

---

## Understanding the Limitations

### Free Tier Reality

| Service | Limitation | Impact |
|---------|------------|--------|
| **Render.com** | Sleeps after 15 min | First request takes 30-60 sec |
| **Neon.tech** | 0.5 GB storage | Good for ~10,000 messages |
| **Cloudflare** | 500 builds/month | Plenty for most projects |

### SignalR (Real-time Chat) Issues

When backend sleeps:
- All WebSocket connections **disconnect**
- Users need to refresh to reconnect
- Messages sent while sleeping are **lost**

**Workaround:** Add a keep-alive ping in frontend (not perfect, but helps)

### This is Fine For:
- ✅ Portfolio demonstrations
- ✅ Job interviews
- ✅ Testing with friends
- ✅ Learning deployment

### Not Great For:
- ❌ Production apps with real users
- ❌ Apps that need 24/7 uptime
- ❌ High-traffic applications

---

## Upgrading Later

When you have $5-10/month:

### Option 1: Render Paid ($7/month)
- Upgrade to "Starter" plan
- No more sleeping
- Better performance

### Option 2: VPS ($4-6/month)
- Hetzner, DigitalOcean, or Linode
- Run everything with Docker
- Full control

---

## Local Development with Docker

Test everything locally before deploying:

```bash
# Start all services
docker-compose up

# Access:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5004
# - Database: localhost:5432
```

---

## Quick Reference

### Your URLs (after deployment)

| Service | URL |
|---------|-----|
| Frontend | `https://YOUR-PROJECT.pages.dev` |
| Backend | `https://YOUR-SERVICE.onrender.com` |
| API Docs | `https://YOUR-SERVICE.onrender.com/swagger` |

### Environment Variables Checklist

**Backend (Render):**
- [ ] `ConnectionStrings__DefaultConnection`
- [ ] `Jwt__SecretKey`
- [ ] `Cors__AllowedOrigins__0`
- [ ] `Admin__Username`
- [ ] `Admin__Password`

**Frontend (Cloudflare):**
- [ ] `VITE_API_URL`
- [ ] `VITE_HUB_URL`

---

## Need Help?

1. **Render.com docs:** https://render.com/docs
2. **Cloudflare Pages docs:** https://developers.cloudflare.com/pages
3. **Neon.tech docs:** https://neon.tech/docs

---

**Congratulations!** You've deployed a full-stack application for free! 🎉

This is a valuable skill for any developer. Add this to your resume and show it off in interviews!
