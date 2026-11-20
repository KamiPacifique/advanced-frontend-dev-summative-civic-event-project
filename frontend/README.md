# CivicConnect — Frontend (HTML · Tailwind CSS · jQuery)

The user interface for the **CivicEvents+** API in [`../backend`](../backend). Residents use it to find and register for events, listen to audio announcements, watch captioned promo videos, get in-app notifications and leave feedback. Administrators use it to manage all of that content and the user accounts.

- **Stack:** plain HTML pages, Tailwind CSS (Play CDN, theme in `assets/js/tailwind.config.js`), jQuery 3.7. There is no build step.
- **Design:** "Civic Events — Foundations" tokens (brand `#1D4ED8`, accent `#F59E0B`, Plus Jakarta Sans), WCAG AA text contrast.

---

## 1. Run the backend (API + database)

Full details are in [`backend/README.md`](../backend/README.md). Short version:

```bash
# 1. Create the database (psql or pgAdmin)
createdb -U postgres civic-events-db

# 2. Create the tables
cd backend
psql -U postgres -d civic-events-db -h localhost -p 5432 -f ./migrations/001_create_tables.sql

# 3. Edit backend/.env with your DB credentials
#    NOTE: the backend reads DB_PASS (not DB_PASSWORD)
#    DB_USER=postgres  DB_PASS=<your password>  DB_HOST=localhost  DB_PORT=5432
#    DB_NAME=civic-events-db  JWT_SECRET=<any long random string>

# 4. Install and start
npm install
npm run dev            # → http://localhost:4000  (GET /health returns {"ok":true})
```

### Create an admin account

The signup form always creates normal `user` accounts. The API's signup endpoint accepts a `role` field, so you can create the first admin with one request:

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Jean Kalisa","email":"admin@civic.rw","password":"Admin@1234","role":"admin"}'
```

Or promote an existing account in SQL: `UPDATE users SET role = 'admin' WHERE email = 'you@example.com';`

> `npm run db:seed` refers to `002_seed_data.sql`, which isn't in the repo. Create content through the admin UI instead.

## 2. Run the frontend

Serve the `frontend/` folder with any static web server:

```bash
cd frontend
python3 -m http.server 5500      # or: npx serve -l 5500 .   or VS Code "Live Server"
```

Open **http://localhost:5500** (index redirects to login or to your dashboard).

### Point the UI at the backend

The API base URL defaults to `http://localhost:4000`. It is set in [`assets/js/config.js`](assets/js/config.js) (`DEFAULT_API_BASE_URL`). To change it without editing files, run this in the browser console and reload:

```js
localStorage.setItem('ce.apiBaseUrl', 'http://localhost:4000')
```

No other environment variables are needed. The backend already enables CORS for all origins.

---

## 3. Features → endpoints

| Area | Pages | Endpoints used |
|---|---|---|
| Auth | `login.html`, `signup.html` | `POST /auth/signup`, `POST /auth/login`, `GET /users/profile/me` (blocks disabled accounts) |
| Home (users) | `dashboard.html` | `GET /dashboard/me` + content lists |
| Events | `events.html`, `event.html` | `GET /events`, `GET /events/:id` |
| Registration | event page, `my-registrations.html` | `POST /event-registrations/register`, `POST /event-registrations/cancel`, `GET /event-registrations/my-registrations` |
| Feedback | event page | `POST /event-feedback`, `PUT /event-feedback/:id`, `GET /event-feedback/my-feedback`, `GET /event-feedback/event/:id` (admin) |
| Announcements | `announcements.html`, `announcement.html` | `GET /announcements`, `GET /announcements/:id` |
| Promos | `promos.html`, `promo.html` | `GET /promos`, `GET /promos/:id` |
| Notifications | bell drawer, `notifications.html` | `GET /notifications`, `GET /notifications/:id` |
| Profile | `profile.html` | `GET` / `PATCH /users/profile/me` (409 → "email already in use") |
| Search | `search.html` (header search, press `/`) | searches the cached lists on the client |
| **Admin** dashboard | `admin/index.html` | `GET /dashboard/admin`, attendees per event |
| **Admin** events | `admin/events.html`, `admin/event-form.html` | `POST /events`, `PUT /events/:id` (multipart, `image`), `DELETE /events/:id` |
| **Admin** announcements | `admin/announcements.html` | `POST /announcements` (multipart, `audio`), `PUT`, `PATCH …/publish` / `…/unpublish`, `DELETE` |
| **Admin** promos | `admin/promos.html`, `admin/promo-form.html` | `POST` / `PUT /promos` (multipart, `video` file **or** `video_link` URL, + `caption_text`), publish/unpublish, `DELETE` |
| **Admin** notifications | `admin/notifications.html` | `DELETE /notifications/:id` |
| **Admin** users | `admin/users.html` | `GET /users`, `GET /users/:id`, `PATCH /users/:id/enable` / `/disable` |
| **Admin** registrations | `admin/registrations.html` | `GET /event-registrations/event/:id/attendees`, `GET /event-feedback/event/:id` |

## 4. Auth, tokens & role-based access

- **Token storage** ([`core/auth.js`](assets/js/core/auth.js)): if "Keep me signed in" is checked, the token goes in `localStorage` and survives a browser restart. Otherwise it goes in `sessionStorage` and is cleared when the tab closes. The trade-off with localStorage is that any script on the page could read the token. To limit that risk, all API data is HTML-escaped before it is rendered (`CE.util.esc`).
- **Global auth context:** `CE.auth` holds `{ token, user: { id, full_name, email, role } }`. [`core/api.js`](assets/js/core/api.js) adds `Authorization: Bearer <token>` to every request.
- **Expiry:** the JWT `exp` claim is decoded and an automatic sign-out is scheduled for that time. Any `401` response also signs the user out. Either way the user lands on `login.html?reason=expired` with a message, and is returned to the page they were on after signing in again.
- **Errors:** `4xx` and `5xx` responses are turned into readable messages. Network failures show a **Retry** button. A `403` on an admin page shows a "This area is for administrators" screen.

**Where the role guards live.** Search the code for `ROLE GUARD`:

| File | What it guards |
|---|---|
| `assets/js/core/auth.js` | `requireAuth()`, `requireAdmin()`, `guestOnly()`: the guard functions themselves |
| `assets/js/components/layout.js` | `CE.boot()` runs the guard before any page code. It also hides admin navigation from non-admins and renders the 403 screen. |
| `assets/js/pages/admin-*.js` | every admin page boots with `auth: 'admin'` |
| `assets/js/components/cards.js`, `pages/event.js` | admins see Edit/Delete; users see Register/Cancel |
| `assets/js/components/admin-content.js`, `notifications.js` | publish/delete actions refuse to run for non-admins |
| `assets/js/pages/login.js` | a `?next=admin/...` redirect is ignored for normal users |

These guards only control what the UI shows. The backend enforces the real permissions with `authenticate` and `authorize(['admin'])`.

## 5. How the UI handles the API's limitations

The backend was not modified. These are the gaps and how the frontend deals with them:

- **Lists aren't filtered or paginated on the server.** `GET /events` and `/announcements` return everything, including unpublished items. The UI filters to `published = true` for the public pages and does search, date/location filters, sorting and pagination on the client.
- **Events can't be unpublished.** The API ignores `published` for events, so the toggle on the event form is shown locked on, with an explanation. Promos and announcements have working publish toggles.
- **No mark-as-read or create-notification endpoints.** Read/unread state is stored per user in localStorage. It updates optimistically and is confirmed with `GET /notifications/:id`, and reverted if that fails. Broadcasts are created automatically by the backend whenever an event, announcement or promo is created, so the admin notifications page reviews and deletes them.
- **Feedback lists are admin-only.** The average rating and all reviews show for admins. Normal users see their own review and can edit it. Each user can leave one review per event, which the database also enforces with a unique constraint.
- **You can't register again after cancelling.** The API returns `409`, and the UI explains this before you confirm a cancellation.
- **Events that have registrations can't be deleted.** The database blocks it with a foreign-key error, and the UI shows a readable message instead of the raw error.
- **Captions are stored as `caption_text`, not a file.** The text is converted to WebVTT in the browser and attached as `<track kind="captions" srclang="en" default>`. Plain text is split into timed sentences. A clickable transcript is shown below the video.
- **No duration or transcript fields for announcements.** The length is read from the audio file's metadata.
- **Upload limits match the server's:** images up to 2 MB (jpg, png, gif), audio up to 5 MB (mp3, wav, m4a, ogg), video up to 8 MB (mp4, mov, avi, mkv). Files are checked before uploading.

## 6. UX & accessibility details

- Skeleton loaders while data loads, empty states, error states with Retry, toasts (some with Undo), confirmation dialogs, and upload progress bars. You're warned before leaving a page mid-upload.
- Lists are cached in sessionStorage for 2 minutes and the cache is cleared after any create, update or delete. Promo thumbnails load only when scrolled into view and only fetch metadata.
- Uses semantic landmarks, a skip link, labelled form fields with `aria-invalid` and `aria-describedby`, and modals and drawers that trap focus and close with Esc. Tabs, switches and star ratings work with arrow keys, and focus rings are visible. The audio player can be used with the keyboard (Space, ←/→, ↑/↓, M).
- Mobile-first layout: cards go from 1 to 2 to 3 columns. The navbar and admin sidebar become drawers below `lg`. Wide tables scroll sideways. On mobile, the event page has a sticky Register bar at the bottom.

## 7. Project structure

```
frontend/
├── index.html                  entry → login or dashboard
├── login.html  signup.html
├── dashboard.html              resident home
├── events.html  event.html
├── announcements.html  announcement.html
├── promos.html  promo.html
├── notifications.html  my-registrations.html  profile.html  search.html  help.html
├── admin/                      index, events, event-form, announcements, promos,
│                               promo-form, notifications, users, registrations
└── assets/
    ├── css/app.css             focus rings, skeletons, switches, range inputs
    ├── img/favicon.svg
    └── js/
        ├── config.js           API base URL, upload limits
        ├── tailwind.config.js  design tokens
        ├── core/               utils, icons, auth (context + guards), api, cache, ui kit
        ├── components/         layout, notifications, media, cards, forms,
        │                       events-shared, admin-content
        └── pages/              one controller per page
```
