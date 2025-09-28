# 🚀 Wellness Monitor - Deployment Guide

## ✅ Pre-Deployment Checklist

### 1. **Build Status** ✅
- ✅ Build je uspešan (`npm run build`)
- ✅ Sve TypeScript greške su rešene
- ✅ ESLint warnings su prihvatljivi (samo warnings, nema errors)

### 2. **Dependencies** ✅
- ✅ Sve potrebne dependencies su instalirane
- ✅ `@types/qrcode` je dodat za QR code funkcionalnost
- ✅ Prisma client je konfigurisan

### 3. **Database Schema** ✅
- ✅ Prisma schema je kompletna
- ✅ Svi modeli su definisani (Player, Survey, Question, Response, Answer)
- ✅ RPE question type je dodat
- ✅ Recurring survey funkcionalnost je implementirana

## 🗄️ Database Setup

### Opcija 1: Supabase (Preporučeno za production)

1. **Kreiraj novi Supabase projekat:**
   - Idi na [supabase.com](https://supabase.com)
   - Klikni "New Project"
   - Izaberi organizaciju i unesi ime projekta
   - Izaberi region (najbliži tvojoj lokaciji)
   - Postavi lozinku za bazu

2. **Dobij connection string:**
   - Idi u Settings → Database
   - Kopiraj "Connection string" (URI format)
   - Zameni `[YOUR-PASSWORD]` sa tvojom lozinkom

3. **Environment variables:**
   ```bash
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

### Opcija 2: Vercel Postgres (Alternativa)

1. **Kreiraj Vercel Postgres:**
   - Idi u Vercel dashboard
   - Storage → Create Database → Postgres
   - Izaberi plan (Hobby je besplatan)

2. **Environment variables:**
   ```bash
   DATABASE_URL="postgres://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]"
   ```

## 🚀 Vercel Deployment

### 1. **Priprema za deployment:**

```bash
# 1. Kreiraj .env.production fajl
echo 'DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"' > .env.production

# 2. Testiraj build lokalno
npm run build

# 3. Commit sve promene
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. **Vercel Setup:**

1. **Konektuj GitHub repo:**
   - Idi na [vercel.com](https://vercel.com)
   - Klikni "New Project"
   - Importuj tvoj GitHub repo

2. **Environment Variables:**
   - U Vercel dashboard, idi u Settings → Environment Variables
   - Dodaj:
     ```
     DATABASE_URL = postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```

3. **Build Settings:**
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### 3. **Database Migration:**

```bash
# 1. Instaliraj Vercel CLI
npm i -g vercel

# 2. Login u Vercel
vercel login

# 3. Link projekat
vercel link

# 4. Push Prisma schema
npx prisma db push

# 5. Generate Prisma client
npx prisma generate
```

## 🔧 Post-Deployment Setup

### 1. **Database Setup:**
```bash
# U Vercel terminal ili lokalno sa production DATABASE_URL
npx prisma db push
npx prisma generate
```

### 2. **Testiranje:**
- Idi na tvoj Vercel URL
- Testiraj kreiranje survey-a
- Testiraj dodavanje igrača
- Testiraj kiosk mode
- Testiraj QR code generisanje

### 3. **Power BI Setup (Opciono):**
- Dodaj `POWER_BI_REPORT_URL` environment variable u Vercel
- Postavi URL na tvoj Power BI report

## 📱 Kiosk Mode Setup

### 1. **QR Code:**
- Idi na `/admin/qr-code`
- Download QR code
- Print i postavi u tvoju ustanovu

### 2. **Short URLs:**
- `/k` - kratka verzija za kiosk mode
- `/kiosk` - puna verzija

## 🔍 Troubleshooting

### Common Issues:

1. **Database Connection Error:**
   ```bash
   # Proveri DATABASE_URL format
   # Proveri da li je Supabase projekat aktivan
   ```

2. **Build Fails:**
   ```bash
   # Proveri da li su sve dependencies instalirane
   npm install
   npm run build
   ```

3. **Prisma Client Error:**
   ```bash
   # Regenerate Prisma client
   npx prisma generate
   ```

4. **Environment Variables:**
   - Proveri da li su sve env vars postavljene u Vercel
   - Proveri da li su u pravom formatu

## 📊 Features Overview

### ✅ Implemented Features:
- ✅ Survey creation and management
- ✅ Player management
- ✅ Recurring surveys with time-based activation
- ✅ Kiosk mode for easy access
- ✅ QR code generation
- ✅ RPE (Rating of Perceived Exertion) questions
- ✅ Body Map questions
- ✅ Power BI integration
- ✅ CSV export
- ✅ Admin dashboard
- ✅ Daily response logic (one response per day per player)

### 🎯 Ready for Production:
- ✅ Responsive design
- ✅ Error handling
- ✅ Type safety
- ✅ Database optimization
- ✅ Security considerations

## 🚀 Go Live!

Tvoja aplikacija je spremna za deployment! Sledi korake iznad i imaćeš potpuno funkcionalnu wellness monitoring aplikaciju.

**URLs nakon deployment-a:**
- Main app: `https://your-app.vercel.app`
- Admin: `https://your-app.vercel.app/admin`
- Kiosk: `https://your-app.vercel.app/k`
- QR Code: `https://your-app.vercel.app/admin/qr-code`

**Srećno sa deployment-om! 🎉**
