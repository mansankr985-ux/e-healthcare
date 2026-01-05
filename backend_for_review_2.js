const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = path.join(__dirname, 'data.db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Setup DB
const db = new sqlite3.Database(DB_FILE);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT,
    specialization TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient TEXT,
    patientEmail TEXT,
    doctor TEXT,
    date TEXT,
    time TEXT,
    reason TEXT,
    status TEXT,
    notes TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    value TEXT
  )`);

  // seed data only if tables empty
  const usersCount = (await all('SELECT COUNT(*) as c FROM users'))[0].c;
  if (usersCount === 0) {
    await run('INSERT INTO users (name, email, role, specialization) VALUES (?,?,?,?)', ['Admin User','admin@example.com','Admin','']);
    await run('INSERT INTO users (name, email, role, specialization) VALUES (?,?,?,?)', ['Dr. Alice','alice@clinic.com','Doctor','Cardiology']);
    await run('INSERT INTO users (name, email, role, specialization) VALUES (?,?,?,?)', ['Dr. Bob','bob@clinic.com','Doctor','Dermatology']);
    await run('INSERT INTO users (name, email, role, specialization) VALUES (?,?,?,?)', ['John Patient','john@patient.com','Patient','']);
  }

  const apptCount = (await all('SELECT COUNT(*) as c FROM appointments'))[0].c;
  if (apptCount === 0) {
    await run('INSERT INTO appointments (patient, patientEmail, doctor, date, time, reason, status, notes) VALUES (?,?,?,?,?,?,?,?)',
      ['John Patient','john@patient.com','Dr. Alice','2026-01-10','10:00','Chest pain','Scheduled','']);
    await run('INSERT INTO appointments (patient, patientEmail, doctor, date, time, reason, status, notes) VALUES (?,?,?,?,?,?,?,?)',
      ['Jane Doe','jane@patient.com','Dr. Bob','2026-01-12','15:00','Skin rash','Scheduled','']);
  }
}

// API endpoints
app.get('/api/users', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM users ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
  const { name, email, role, specialization } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'Missing fields' });
  try {
    const info = await run('INSERT INTO users (name,email,role,specialization) VALUES (?,?,?,?)',[name,email,role,specialization||'']);
    const user = (await all('SELECT * FROM users WHERE id=?',[info.lastID]))[0];
    res.status(201).json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await run('DELETE FROM users WHERE id=?',[id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM appointments ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/appointments', async (req, res) => {
  const { patient, patientEmail, doctor, date, time, reason } = req.body;
  if (!patient || !patientEmail || !doctor || !date || !time) return res.status(400).json({ error: 'Missing fields' });
  try {
    const info = await run('INSERT INTO appointments (patient,patientEmail,doctor,date,time,reason,status,notes) VALUES (?,?,?,?,?,?,?,?)', [patient, patientEmail, doctor, date, time, reason||'', 'Scheduled','']);
    const appt = (await all('SELECT * FROM appointments WHERE id=?',[info.lastID]))[0];
    res.status(201).json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/appointments/:id', async (req, res) => {
  const id = req.params.id;
  const { status, notes } = req.body;
  try {
    await run('UPDATE appointments SET status=?, notes=? WHERE id=?',[status||'', notes||'', id]);
    const appt = (await all('SELECT * FROM appointments WHERE id=?',[id]))[0];
    res.json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings', async (req, res) => {
  try { const rows = await all('SELECT * FROM settings ORDER BY id'); res.json(rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    const info = await run('INSERT INTO settings (key,value) VALUES (?,?)',[key,value||'']);
    const s = (await all('SELECT * FROM settings WHERE id=?',[info.lastID]))[0];
    res.status(201).json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// simple health
app.get('/api/health', (req,res) => res.json({ ok: true }));

// start
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => { console.error('DB init failed', err); process.exit(1); });
