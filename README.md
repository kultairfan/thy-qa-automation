# QA Automation (Playwright + Gherkin)

BDD (Gherkin) UI testleri. Kişisel QA sandbox projesi.

> turkishairlines.com otomasyonu engellediği (bot koruması) için koşumlar **blazedemo.com** demo uçuş sitesine karşı yapılıyor.
> Jira story'leri: `THY-23` (uçuş arama) ve `THY-24` (uçuş satın alma).

## Yapı

```
features/            Gherkin senaryoları (bir story = bir dosya, ör. THY-1.feature)
steps/               Step tanımları (fixtures.ts + *.steps.ts)
pages/               Page Object'ler (BlazeDemoPages.ts)
STEP_LIBRARY.md      AI'ın kullanabileceği hazır step listesi
scripts/notify-n8n.mjs  Sonuç özetini n8n webhook'una gönderir
.github/workflows/   GitHub Actions koşumu
```

## 1. Lokal kurulum (VS Code)

```bash
npm install
npx playwright install chromium
```

Önerilen VS Code eklentileri: **Playwright Test for VSCode**, **Cucumber (Gherkin) Full Support**.

## 2. Testleri koşma

```bash
npm test                         # tüm senaryolar
npm run test:story -- @THY-23    # sadece bir story
npm run test:headed              # tarayıcıyı görerek
npm run report                   # Playwright HTML raporu
open cucumber-report/index.html  # Cucumber HTML raporu
```

Sonuç özeti (n8n'e gidecek JSON):

```bash
npm run notify
```

## 3. GitHub Actions

```bash
git init && git add . && git commit -m "THY BDD tests"
git branch -M main
git remote add origin https://github.com/<kullanici-adin>/thy-qa-automation.git
git push -u origin main
```

GitHub → **Actions** → **BDD Tests** → **Run workflow** (issue_key: `THY-23` ya da boş).
Raporlar koşumun altındaki **Artifacts** bölümünde.

## 4. n8n bağlantısı (sonraki adım)

Repo → Settings → Secrets and variables → Actions → **Secrets** → `N8N_WEBHOOK_URL` = n8n Webhook node adresi.
Koşum bitince özet bu adrese gönderilir; n8n Jira'ya yorum yazar / bug açar.
