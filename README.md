# 🐾 MeowMetrics

A self-hosted, mobile-first web tracker (PWA) for seamless documentation and analysis of feedings and vomiting incidents in cats.

![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Frontend-38BDF8?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Selfhosted-2496ED?logo=docker&logoColor=white)

<!-- TODO: add screenshots once the design is finalized
![Screenshot](docs/screenshot.png)
-->

---

## 📖 Table of Contents

- [Features](#-features)
- [Navigation](#-navigation)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Build from Source](#-build-from-source)
- [First Run](#-first-run)
- [Installing as an App (PWA)](#-installing-as-an-app-pwa)
- [Usage](#-usage)
- [Exports & Reports](#-exports--reports)
- [Configuration](#-configuration)
- [Data & Backup](#-data--backup)
- [Updating](#-updating)
- [Security Notice](#-security-notice)
- [Privacy](#-privacy)
- [API](#-api)
- [Local Development](#-local-development)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Disclaimer](#-disclaimer)

---

## ✨ Features

- **🥣 Quick Feeding Logging:** Select one or more cats per meal and rate each cat individually on a three-level acceptance scale. Add optional notes and adjust date and time if needed.
- **🤮 Vomit Tracker with 12h Correlation:** Document vomiting incidents with an optional photo, a category and notes. For food-relevant incidents, the app looks up which meals the cat was fed in the **previous 12 hours** and flags the connection. Over time, this helps to detect and document food intolerances.
- **📊 Analysis & Statistics:** Rankings of favorite food varieties (with acceptance rate) and evaluation of how well each food is tolerated.
- **📋 Complete History & Master Data:** Filter, edit or delete meals, and manage cats, manufacturers and food varieties. New entries can also be created on the fly in the selection form.
- **🌍 Bilingual:** German and English interface, selectable on first start and in the settings.
- **🏷️ Custom Rating Labels:** Rename the three acceptance levels to whatever suits you (defaults: *Inhaled / Okay / Refused*).
- **📤 Export:** Full CSV export plus a printable report (save it as PDF) with an all-time food matrix per cat and the last 30 days of vomiting incidents and meals.
- **🏷️ Renamable:** Set `APP_NAME` at the top of `app/main.py` (or as environment variable) – used for the browser tab, home-screen name, reports and push messages.
- **🩺 Health data & birthdays:** Per-animal health values (height, weight, temperature, custom fields). The birthday is asked when adding an animal and can only be edited in the master data.
- **💊 Medication & supplements ("Präparate"):** Quickly log tablets, pastes, powders or flea treatment per animal with a dose and an optional "given together with feeding" flag. Entries show up in the history and the report; the catalog (with default doses) is maintained in the master data.
- **🐾 Animal profiles:** *Settings → Animals* manages name, species, numeric position, birthday, avatar color, breed, color, sex/neutering status, markings and chip details (number, date, site).
- **🚑 Medical & vaccination record:** *Health → Medical* (highlighted emergency box for allergies, chronic conditions, permanent medication), *Vaccines* (table with expiry status) and *Values* (charts and custom measurements). Vaccinations expiring within 30 days trigger a push reminder (30 days, 7 days, expiry day).
- **📈 Trend charts:** *Health → Values* shows a real line chart (axes, dates, markers) for any measurement over 3/6/12 months or all time, with change, monthly trend, min/max, a normal-range band for temperature and hints for noticeable weight changes (≥ 5 %) or elevated temperature. The PDF report uses the same chart style.
- **🩺 Treatment / post-op mode:** Start a treatment per animal (title, start time, reminder interval, vet instructions) under *Health → Medical*. While active, a highlighted banner at the top of the Health tab shows the running time and next reminder, with one-tap log entries (medication, wound check, food intake, general condition). Completing archives it; all entries are grouped under the treatment title in the report. Overdue intervals trigger a push reminder.
- **📸 Incidents ("Vorfall"):** The former *Vomit* tab now has three sub-tabs: *Vomit*, *Stool* (Bristol scale 1–7, blood/mucus/worm flags, up to 4 photos) and *Observations* (skin, wounds, ears, other – with location and photos). Entries are timestamped, shown in the history (with photo thumbnails, editable) and available as report categories.
- **👥 Multiple users:** Every entry (feedings, vomiting, stool/findings, medication, health values, vaccinations, treatments and their log entries) records which user created it; it is shown in the history, the report and the CSV export once more than one user exists. Every user also has their own view: features, design, colors and language are stored per account, and each new user runs the feature wizard on first login.
- **⚡ Performance:** The app loads all its data with one gzip-compressed request (`/api/bootstrap`), the database uses WAL mode plus indexes for the feeding/vomit lookups, and the history renders the latest 60 entries with a "Show more" button.
- **🏥 Vet address book & smart report sharing:** *Settings → Vet clinics* holds a central address book (name, address, phone, e-mail); each animal gets a clinic and an attending doctor under *Settings → Animals*. *Health → Medical* shows them with quick actions (call, e-mail, start navigation). *Create report* offers: save as PDF, print directly, or send by e-mail via the Web Share API (the PDF is generated on the server; with several clinics you choose the recipients; browsers without file sharing get a download plus a `mailto:` link). PDF export needs WeasyPrint (included in the Dockerfile).
- **🎛️ Switchable features:** *Settings → Features* shows every function grouped by tab (Feed: food, snacks, drinks, medication · Incident: vomit, stool, findings · Health: medical, vaccinations, measurements, treatments · Analysis & reports · Push reminders). A switch only hides the function in the UI; all stored data is kept. On first login every user is asked which features to use, with a short explanation and a pointer to the later activation. Hidden features also stop their push reminders.
- **🔔 Push reminders:** Feeding reminders plus birthday messages (14 days ahead and on the birthday at 09:00 local time, with varying texts).
- **📑 Custom report:** Multi-select categories (food, snacks, drinks, vomiting, health), animals and period (default 30 days). Each animal's age is shown once (as of export day).
- **🕒 Automatic Timestamps:** Date and time are recorded for every entry.
- **📱 PWA (Progressive Web App):** Installs seamlessly on your smartphone's home screen and feels like a native app.
- **🔒 Local Data Sovereignty:** Runs entirely self-hosted in a single Docker container, with no cloud involved.

### Vomit categories

| Category               | Counts as food-relevant? |
|------------------------|:------------------------:|
| Undigested food        | ✅                       |
| Other / unclear        | ✅                       |
| Bile / foam / grass    | ❌                       |
| Hairball               | ❌                       |

Only food-relevant incidents are used for the intolerance analysis in the exports.

---

## 🧭 Navigation

The bottom bar has four destinations and one prominent action: **Today · History · ＋ Add entry · Animals · More**.

```text
Today      greeting, quick actions, running treatments, due items, "today so far" per animal
History    list with animal/category filters · analytics · report (PDF / print / mail to clinic)
＋ Add     feeding (several animals, optional medication) · medication separately · incident
           (vomit / stool / finding, one animal) · measurement · treatment log entry
Animals    animal cards → animal record: profile · vaccinations · values & trend · treatments
More       catalog · vet clinics · reminders · features · appearance · data & backup · account
```

- **Medication** can be marked directly while feeding ("given together with this feeding") or logged separately, with its own time and an optional "with feeding" flag.
- **Photos** can be taken directly with the camera (or picked from the gallery) and open full-screen with a tap.
- **Animal info** (master data, vaccination status, emergency info, vet) is available read-only straight from the add menu, and a treatment can be started there. Both can be switched off per user.
- **Vaccinations**: *Basic immunisation* and *Rabies* are fixed types, all others are user-defined. A vaccination can have *no expiry date*, and future vaccinations can be planned with push reminders.
- **Animals** can have a photo instead of the initial avatar (shown in the animals tab) and cats a lifestyle (indoor / outdoor).
- **Colour themes** inspired by Material Design, with every colour still adjustable.
- **Medication** has a fixed unit per product (e.g. *tablet* or *mg*); when logging you only adjust the amount.
- **Administrators** manage all accounts under *More → Account & users* (rename, new password, admin right, delete).
- **Offline mode:** new entries (feeding, medication, incident, measurement, treatment log) made without a connection are stored on the device and sent automatically once the server is reachable again; a message confirms the synchronisation. Every entry carries a unique ID, so nothing is stored twice. Editing, deleting and master data need a connection. The offline start of the app (service worker) requires **HTTPS**; the entry queue itself also works over plain HTTP while the app is open. See *More → Synchronisation*.
- **Switchable features** are respected everywhere: tiles in the add sheet, cards on *Today*, tabs of the animal record, filters, catalog sections and navigation items disappear when the function is switched off. Stored data is never touched.

---

## 🧰 Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Python 3.12, FastAPI, Uvicorn           |
| Database  | SQLite                                  |
| Frontend  | Vanilla JS modules + CSS, no build step (PWA) |
| Packaging | Docker, GitHub Actions (prebuilt image) |

---

## 🚀 Quick Start

The easiest way to run the tracker is the prebuilt image from the GitHub Container Registry.

1. **Create a `docker-compose.yml`:**

   ```yaml
   services:
     meowmetrics:
       image: ghcr.io/grosserlacher/meowmetrics:latest
       container_name: meowmetrics
       restart: unless-stopped
       ports:
         - "8000:8000"
       environment:
         - TZ=Europe/Berlin   # set your own time zone
       volumes:
         - ./data:/app/data
   ```

2. **Start the container:**

   ```bash
   docker compose up -d
   ```

3. **Health check:**

   Verify that the container started and is running smoothly:

   ```bash
   docker ps
   docker logs meowmetrics
   ```

4. **Open the app:**

   By default, the app is available at `http://<your-server-ip>:8000` (or behind your reverse proxy / Nginx Proxy Manager with a local AdGuard/DNS rewrite).

---

## 🔨 Build from Source

If you prefer to build the image yourself:

```bash
git clone https://github.com/GrosserLacher/meowmetrics.git
cd meowmetrics
docker compose up -d --build
```

---

## 👋 First Run

On the first start, a short setup asks for:

1. your preferred **language** (German or English), and
2. the **names of your cats** (at least one).

The app also comes with a few example manufacturers and food varieties, which you can edit or delete in the master data at any time.

---

## 📱 Installing as an App (PWA)

Open the tracker in your phone's browser, then:

- **iOS (Safari):** Tap the *Share* button → *Add to Home Screen*.
- **Android (Chrome):** Open the menu (⋮) → *Install app* / *Add to Home screen*.

> **Note:** Most mobile browsers require **HTTPS** for installing PWAs and for camera access. If you access the app via a plain `http://` address in your local network, these features may not be available. Use a reverse proxy with a valid certificate to enable them.

---

## 🐱 Usage

### Logging a feeding

1. Select one or more cats.
2. Select the manufacturer and food. New ones can be created directly in the selection form or in the master data.
3. Rate how well the food was accepted by each cat (three levels, editable in the settings).
4. Optionally add a note and adjust date/time, then save.

Cats fed in the same round are stored as one meal, so they can be edited or deleted together.

### Logging a vomiting incident

1. Select the cat (or *Unknown* if you did not see who it was).
2. Choose the category (see [Vomit categories](#vomit-categories)).
3. Optionally take or upload a photo and add a note.
4. Save. For food-relevant incidents, the meals of the previous 12 hours are looked up and shown with the entry. For *Unknown*, the meals of all cats are considered.

### Master data

Manage cats, manufacturers and food varieties under *Master Data*:

- Renaming a cat, manufacturer or food also updates the existing history.
- Deleting a cat only removes it from the active selection; its history is kept.
- Deleting a manufacturer also removes its food varieties from the selection; past meals keep their recorded names.

---

## 📤 Exports & Reports

- **CSV:** Complete export of all feedings. Semicolon-separated with a UTF-8 BOM, so it opens directly in Excel. Each row contains date, time, batch ID, manufacturer, food, cat, rating (score and label), notes and a flag showing whether a food-relevant vomiting incident followed within 12 hours.
- **PDF report:** Opens a print-optimized page and starts the print dialog; choose *Save as PDF*. It contains:
  1. an all-time food matrix with the average acceptance per cat and the number of food-related vomiting incidents within 12 hours of a meal,
  2. all vomiting incidents of the last 30 days,
  3. all meals of the last 30 days, grouped by feeding round.

  Handy for veterinary visits. Add `?hide_deleted=true` to the report URL to exclude cats that have been removed from the active selection.

---

## ⚙️ Configuration

Most settings are made in the app itself:

| Setting          | Where            | Default                          |
|------------------|------------------|----------------------------------|
| Language         | Settings         | `de` (chosen on first start)     |
| App name         | `APP_NAME` in `app/main.py` or env var | `MeowMetrics` |
| Rating labels    | Settings         | Inhaled / Okay / Refused         |

Container options:

| Option           | How                                   | Default      |
|------------------|---------------------------------------|--------------|
| Port             | `ports` in `docker-compose.yml`       | `8000`       |
| Time zone        | `TZ` environment variable             | container time (UTC) |
| Data directory   | volume mounted to `/app/data`         | `./data`     |

> **Tip:** Set `TZ` so that automatically generated timestamps match your local time.

---

## 💾 Data & Backup

All persistent data lives in the mounted `./data` directory:

| Path                | Content                |
|---------------------|------------------------|
| `data/tracker.db`   | SQLite database        |
| `data/uploads/`     | Uploaded vomit photos  |

**Backup:** Stop the container (recommended for a consistent database state) and copy the whole `data` folder:

```bash
docker compose stop
cp -r ./data ./data-backup-$(date +%F)
docker compose start
```

**Restore:** Put the backed-up `data` folder back in place and restart the container.

**Backup from the app:** *Overview → Export → Back up database* downloads a consistent copy of the SQLite database (`.db`, administrators only; includes user accounts). To restore it, stop the container, replace `data/tracker.db` with the downloaded file and start again. Photos in `data/uploads/` must be backed up separately.

Database changes between versions are applied automatically on startup.

---

## 🔄 Updating

```bash
docker compose pull
docker compose up -d
```

Your data in `./data` is preserved.

---

## ⚠️ Security Notice

Access requires an account: the first user created on first start becomes the administrator and can add more users under *More → Account*. Sessions are stored in an HttpOnly cookie, passwords are hashed with scrypt.

Still, do **not** expose the app directly to the internet without HTTPS. Use a reverse proxy with TLS (and ideally rate limiting on `/api/login`) or a VPN.

---

## 🔒 Privacy

Personal data, the local SQLite database and uploaded vomit photos stay exclusively on your home server and are excluded from public upload via `.gitignore`.

---

## 🔌 API

The app is built on a REST API. Interactive documentation (Swagger UI) is available at `http://localhost:8000/docs`.

| Area           | Endpoints                                                      |
|----------------|----------------------------------------------------------------|
| Settings/Setup | `GET/PUT /api/settings`, `POST /api/setup`                     |
| Cats           | `GET/POST /api/cats`, `PUT/DELETE /api/cats/{id}`              |
| Manufacturers  | `GET/POST /api/manufacturers`, `PUT/DELETE /api/manufacturers/{id}` |
| Foods          | `GET/POST /api/foods`, `PUT/DELETE /api/foods/{id}`            |
| Feedings       | `GET/POST /api/feedings`, `PUT/DELETE /api/feedings/batch/{batch_id}` |
| Vomits         | `GET/POST /api/vomits`, `DELETE /api/vomits/{id}`              |
| Export         | `GET /api/export/csv`, `GET /api/export/pdf`, `GET /api/export/report` (`kinds`, `animals`, `unknown`, `days` or `date_from`/`date_to`, `lang`) |
| Health         | `/api/health/*` (overview, birthday, fields, values)           |
| Push           | `/api/push/*` (status, subscribe, test, `?kind=birthday`)      |

---

## 🛠️ Local Development

Running without Docker works with a recent Python version (3.12 recommended). The app stores its data in the directory given by the `DATA_DIR` environment variable (default: `/app/data`).

```bash
git clone https://github.com/GrosserLacher/meowmetrics.git
cd meowmetrics
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATA_DIR="$PWD/data"
uvicorn app.main:app --reload --port 8000
```

Then open `http://localhost:8000`.

---

## 🗂️ Project Structure

```text
meowmetrics/
├── app/
│   ├── main.py          # FastAPI app (APP_NAME at the top), API, exports
│   ├── extras.py, health.py, cats.py, meds.py, findings.py, features.py, vets.py, audit.py, push.py, report.py
│   └── static/          # Frontend (no build step)
│       ├── index.html, styles.css, i18n.js, manifest.json, sw.js
│       ├── icons.js, api.js, state.js, hero.js, app.js
│       └── views/       # common, sheet (add entry), today, history, pets, more
├── data/                # Created at runtime
│   ├── tracker.db       # SQLite database
│   └── uploads/         # Uploaded photos
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## 🤝 Contributing

Contributions are always welcome! Feel free to:

- open an [issue](https://github.com/GrosserLacher/meowmetrics/issues) for bugs or feature ideas,
- fork the repository and submit a pull request.

There is no fixed roadmap; new features are added as they come up.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🩺 Disclaimer

This tool is meant for documentation purposes only and does **not** replace veterinary advice. If your cat vomits frequently or shows other signs of illness, please consult a veterinarian.
