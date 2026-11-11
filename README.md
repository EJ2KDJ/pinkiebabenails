Guys, gamitin natin yung GitHub Desktop para mas madali and hindi na kailangan mag-command line.

### 1. Install GitHub Desktop

Download and install GitHub Desktop:
https://desktop.github.com/

### 2. Log in

Open GitHub Desktop and log in using the SAME GitHub account na in-add ko sa repository.

### 3. Clone the project

After logging in:

1. Click **Clone a repository**
2. Select our `nail-salon-dynamic` repository
3. Choose kung saan niyo gusto i-save sa PC
4. Click **Clone**

After that, makikita niyo na yung project folder sa computer niyo.

IMPORTANT:
Huwag niyong i-download as ZIP. **Clone** yung gamitin.

Kapag successful, sabihin niyo sa group chat para ma-check natin bago kayo mag-start mag-code.


## BAGO MAG-START: INTINDIHIN MUNA ITO

**Fetch origin** only DOWNLOADS yung info kung ano na yung bago sa GitHub. **HINDI** niya nilalagay yung changes sa files niyo.

Para talagang makuha yung changes, kailangan niyo pang **Pull** o **Merge**.

Dalawang klase ng "update":

1. **Pull origin** = kunin yung updates ng SARILI niyong branch (kung may ibang nag-push sa branch niyo).
2. **Update from main** = kunin yung latest ng `main` papunta sa branch niyo. Dito niyo makukuha yung mga na-merge na PR ng ibang members.

Kung hindi niyo ginawa ito, hindi niyo makikita yung bagong files ng iba.


## EVERY TIME NA MAGCO-CODE KAYO

### STEP 1 — Open GitHub Desktop

Open the GitHub Desktop app.

Make sure yung repository natin yung naka-select.

### STEP 2 — Go to your branch

Sa taas, may makikita kayong **Current Branch**.

Select your assigned branch.

Example:

`EJ-backend`

**I-double check na NASA branch niyo kayo, hindi sa `main`.**

### STEP 3 — Get the latest version

Before you start coding:

1. Click **Fetch origin**.
2. Kung may lumabas na **Pull origin**, i-click ito.
3. Kung may banner na *"The branch main has N new commits"*, i-click yung **Update from main**.

   Kung walang banner, pwede rin: **Branch → Update from main**.

Kapag may lumabas na merge conflict, **STOP** at sabihin sa group chat. Huwag manghula.

### STEP 4 — Code normally

Open the project in VS Code.

Gawin niyo yung assigned task niyo.

### STEP 5 — Save your work

After coding, balik sa GitHub Desktop.

Makikita niya automatically kung ano yung binago niyo.

### STEP 6 — Commit

Sa lower-left side ng GitHub Desktop, may box para sa commit message.

Example:

`Added booking form`

Then click:

**Commit to [your branch]**

Tingnan na yung nakasulat sa button ay yung branch NIYO, hindi `main`.

### STEP 7 — Push

Click:

**Push origin**

Ito yung nag-u-upload ng changes niyo sa GitHub.

### STEP 8 — Create Pull Request

After pushing, may button na:

**Create Pull Request**

Click it.

Then sabihin sa group chat:

> "Naka-PR na yung booking form."

WAIT for someone to check it before merging.

### STEP 9 — Pagkatapos ma-merge yung PR

Bumalik sa GitHub Desktop, i-click ang **Fetch origin**, tapos **Update from main** (STEP 3) para makuha niyo yung latest na kasama na yung changes ng buong team.

---

## IMPORTANT

Huwag niyong i-edit or i-push directly yung `main`.

Huwag niyong i-delete or baguhin yung ibang person's branch.

Kung nag-push kayo sa `main` by mistake, **huwag niyong i-undo mag-isa**. Sabihin agad sa group chat.

Kung may error or hindi niyo alam gagawin:

**STOP muna and send sa group chat.**
Huwag manghula.

## Account authentication setup

The backend account endpoints need a database, a JWT secret, and SMTP settings for password recovery. Add these values to the backend environment (or the hosting provider's environment settings):

- `DATABASE_URL` — PostgreSQL connection URL.
- `JWT_SECRET` — a long, random secret; do not use a sample or commit it.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — SMTP account used to send password reset links.
- `FRONTEND_URL` — public website origin, used to create password reset links. Required in production.

From the `backend` directory, run `npm run migrate` to create or update the account tables before starting the API with `npm start`. Run migrations against the same production database before deploying backend code that expects a schema change. Password reset links expire after one hour. Public signups are customer accounts; admin accounts must be provisioned separately.

### Owner dashboard access

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend `.env` file or hosting environment. Use a unique password of at least 8 characters; it is hashed before being stored in the database. Optionally set `ADMIN_NAME` and `ADMIN_PHONE_NUMBER`.

After migrations are complete, run `npm run provision-admin` from the `backend` directory against the same database used by the app. This creates or updates the owner account and sets its role to `admin`; rerunning it resets that account's password to the current `ADMIN_PASSWORD`. Do not commit `.env` or share its contents.

The owner signs in at `/admin-login.html`. This page uses a dedicated admin-only login endpoint; customer accounts cannot use it, and owner accounts cannot sign in through the public customer login. Share the page link, but never put credentials in the link itself.