// Imported first by the server so .env is loaded before any module reads process.env.
// Real environment variables take precedence over .env values.
try { process.loadEnvFile(); } catch { /* No .env file: run with defaults. */ }
