# CivicEvent+ Project

- **[`backend/`](backend/)**: the provided Node.js + Express + PostgreSQL API (unchanged).
- **[`frontend/`](frontend/)**: CivicConnect, the HTML + Tailwind CSS + jQuery user interface. See **[frontend/README.md](frontend/README.md)** for setup, how to connect it to the backend, and the role-guard documentation.
- **[`video-demo/`](video-demo/)**: walkthrough video.

Quick start: start the API (`cd backend && npm install && npm run dev` → http://localhost:4000), then serve the UI (`cd frontend && python3 -m http.server 5500`) and open http://localhost:5500.
