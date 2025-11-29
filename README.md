Nexa Chat (local demo)

Quick start

1. Open a terminal in this folder (g:\nexaweb).
2. Install dependencies:

   npm install

3. Start the server:

   npm start

4. Open http://localhost:3000 in your browser.

Notes and security

- This demo stores credentials in an in-memory object inside `server.js`. This is only for local testing. Do NOT store plaintext passwords in source control or in code for production.
- For production use:
  - Store users in a proper database (Postgres, MySQL, MongoDB, etc.).
  - Hash passwords with bcrypt before storing them.
  - Keep secrets (session secret, DB credentials) in environment variables or a secrets manager.
  - Use HTTPS.

If you want, I can:
- Replace the in-memory users with a tiny SQLite DB and add bcrypt password hashing.
- Replace inline form styles in `index.html` with classes in `css/common.css`.
- Add a simple registration page.
