# 📊 Google Sheets Automatski Upload Setup

## 🎯 Cilj
Automatski upload CSV podataka na Google Sheets na nalog `aleksacoach@gmail.com` svaki put kada se submit-uje response.

## 🔧 Korak 1: Kreiranje Google Service Account

### 1.1 Idi na Google Cloud Console
- Otvori [Google Cloud Console](https://console.cloud.google.com/)
- Uloguj se sa `aleksacoach@gmail.com`

### 1.2 Kreiraj novi projekat
- Klikni na dropdown sa imenom projekta (gore levo)
- Klikni "New Project"
- Ime: `Wellness Monitor`
- Klikni "Create"

### 1.3 Kreiraj Service Account
- Idi na "IAM & Admin" → "Service Accounts"
- Klikni "Create Service Account"
- **Service account name:** `wellness-monitor-service`
- **Description:** `Service account for wellness monitor app`
- Klikni "Create and Continue"

### 1.4 Dodaj permissions
- **Role:** `Editor` (za Google Sheets pristup)
- Klikni "Continue"
- Klikni "Done"

## 🔑 Korak 2: Kreiranje JSON ključa

### 2.1 Generiši ključ
- Klikni na kreirani Service Account
- Idi na "Keys" tab
- Klikni "Add Key" → "Create new key"
- **Key type:** JSON
- Klikni "Create"
- **Download-uj JSON fajl** (važno!)

### 2.2 Izvuci podatke iz JSON-a
Iz JSON fajla trebaš:
- `client_email` (Service Account email)
- `private_key` (Private key)

## 📊 Korak 3: Kreiranje Google Sheets

### 3.1 Kreiraj spreadsheet
- Idi na [Google Sheets](https://sheets.google.com)
- Klikni "Blank" da kreiraš novi spreadsheet
- **Ime:** `Wellness Monitor Data - aleksacoach@gmail.com`

### 3.2 Share sa Service Account
- Klikni "Share" (gore desno)
- **Dodaj email:** `your-service-account@wellness-monitor.iam.gserviceaccount.com`
- **Permission:** Editor
- Klikni "Send"

### 3.3 Kopiraj Spreadsheet ID
- Iz URL-a: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
- Kopiraj `SPREADSHEET_ID` deo

## ⚙️ Korak 4: Podešavanje Environment Variables

### 4.1 Lokalno (.env fajl)
```bash
# Google Sheets Integration
ENABLE_GOOGLE_SHEETS=true
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@wellness-monitor.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
```

### 4.2 Vercel (Production)
- Idi na Vercel Dashboard
- Idi na tvoj projekat
- Idi na "Settings" → "Environment Variables"
- Dodaj sve 4 varijable:
  - `ENABLE_GOOGLE_SHEETS` = `true`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `your-service-account@...`
  - `GOOGLE_PRIVATE_KEY` = `-----BEGIN PRIVATE KEY-----\n...`
  - `GOOGLE_SPREADSHEET_ID` = `your_spreadsheet_id`

## 🚀 Korak 5: Testiranje

### 5.1 Lokalno testiranje
```bash
npm run dev
```
- Idi na admin panel
- Idi na survey results
- Klikni "Export to Google Sheets"
- Proveri da li se podaci pojavljuju u Google Sheets

### 5.2 Automatski upload
- Submit-uj novi response
- Proveri da li se automatski dodaje u Google Sheets

## 📋 Struktura podataka u Google Sheets

### Kolone:
1. **Survey ID** - ID surveya
2. **Survey Title** - Naziv surveya
3. **Player ID** - ID igrača
4. **Player Name** - Ime igrača
5. **Player Email** - Email igrača
6. **Submitted At** - Datum i vreme submit-a
7. **Question Answers** - Odgovori na pitanja
8. **Body Map Data** - Podaci o body map-u (300+ kolona za sve regije)

### Sheet naming:
- Svaki survey dobija svoj sheet: `Survey_[SURVEY_ID]`
- Headers se automatski postavljaju
- Podaci se dodaju na dno

## 🔄 Automatska sinhronizacija

### Kada se pokreće:
- **Automatski:** Svaki put kada se submit-uje response
- **Ručno:** Klikom na "Export to Google Sheets" dugme

### Filtering:
- Samo aktivni igrači (iz "Manage Players")
- Samo validni responses
- Dnevna logika (jedan response po danu po igraču)

## 🛠️ Troubleshooting

### Problem: "Permission denied"
- Proveri da li je Service Account share-ovan sa spreadsheet-om
- Proveri da li je `GOOGLE_SERVICE_ACCOUNT_EMAIL` tačan

### Problem: "Invalid credentials"
- Proveri da li je `GOOGLE_PRIVATE_KEY` tačno kopiran
- Proveri da li su `\n` karakteri u private key-u

### Problem: "Spreadsheet not found"
- Proveri da li je `GOOGLE_SPREADSHEET_ID` tačan
- Proveri da li spreadsheet postoji

### Problem: "No data uploaded"
- Proveri da li je `ENABLE_GOOGLE_SHEETS=true`
- Proveri console logs za greške

## 📞 Support

Ako imaš problema:
1. Proveri console logs u browser-u
2. Proveri Vercel logs
3. Proveri da li su svi environment variables postavljeni
4. Testiraj lokalno pre nego što deploy-uješ

---

**🎉 Kada sve bude podešeno, podaci će se automatski upload-ovati na Google Sheets svaki put kada igrač submit-uje response!**