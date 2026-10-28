# شكاوى العاملين — Complaints PWA

Mobile-first Arabic RTL Progressive Web App for factory employee complaints. Brand palette from the provided identity board:
- Deep Black `#1A0F12`
- Burgundy `#8B1E3F`
- Coral Pink `#FF5A7A`
- Gold `#F5C451`
- Light Cream `#F9E6D1`

## Stack
- React + TypeScript + Vite
- Supabase Auth/Postgres for durable employee, complaint, reply and audit data
- Firebase Web SDK scaffold for optional Firebase Cloud Messaging
- Installable PWA via vite-plugin-pwa

## Run locally
1. `cd complaints-app`
2. `npm install`
3. Copy `.env.example` to `.env.local` and set the Supabase publishable key and project URL.
4. `npm run dev`

## Backend setup still required
1. Create/select a **dedicated** Supabase project; do not reuse a production project for another app.
2. Apply `supabase/migrations/202610280001_complaints_schema.sql` to that dedicated project.
3. Provision Supabase Auth users and map each authenticated user to `portal_profiles`. Set the admin role only from a trusted admin process.
4. The UI calls RPCs `employee_portal_lookup`, `employee_submit_complaint`, `admin_portal_login`, `admin_list_complaints`, `admin_reply_to_complaint`, and `admin_update_complaint_status`. These trusted database functions/edge endpoints are not yet implemented; the interface is a scaffold and cannot be considered production-ready until they are implemented and tested.
5. SAP-only access is not secure authentication. Before real employee data is shown, implement a verified identity flow (for example, OTP or a provisioned credential) and enforce it on the server.
6. For Firebase, create a Firebase web app and fill in the `VITE_FIREBASE_*` values. Firebase is currently scaffolded for optional messaging; notifications require a service worker, VAPID key and trusted server-side sender. Do not place Firebase Admin credentials in frontend variables.
7. Import the actual roster workbook after reviewing its sheet names and column headers. Never commit the roster or real complaints to this repository.

## Security
- Do not put Supabase service-role keys, Firebase Admin private keys, employee roster data, passwords or real complaint text in GitHub.
- The SQL enables RLS and restricts row access to authenticated mapped employees/admins. It deliberately does not provide a public SAP lookup function.
- This repository is public at the moment. Keep it code-only; use private repository settings if source confidentiality is required.
