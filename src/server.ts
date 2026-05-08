import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import 'dotenv/config';
import { InsertTrial } from './mongo';

const app = express();
const PORT = process.env.PORT || 9000;

// BASE_PATH: set in .env when running behind nginx with a path prefix (e.g. "study").
// Leave unset or empty for local development — the app is then served at /.
const prefix = process.env.BASE_PATH ? `/${process.env.BASE_PATH}` : '';

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the built frontend from dist/ (produced by `npm run build`).
// Vite's base: './' means asset paths are relative, so this works at any prefix.
app.use(prefix || '/', express.static(path.join(__dirname, '..', 'dist')));

// When a prefix is set, redirect bare / to the prefixed URL.
if (prefix) {
  app.get('/', (_req: Request, res: Response) => res.redirect(prefix + '/'));
}

// Save participant data to MongoDB.
app.post(`${prefix}/submit`, async (req: Request, res: Response) => {
  InsertTrial(req.body.trial);
  res.end('Data saved!');
});

// Redirect to Prolific completion page. Set PROLIFIC_COMPLETION_CODE in .env.
app.get(`${prefix}/prolific`, (_req: Request, res: Response) => {
  res.redirect(`https://app.prolific.com/submissions/complete?cc=${process.env.PROLIFIC_COMPLETION_CODE}`);
});

// Redirect to SONA credit-granting URL.
// Set SONA_BASE_URL, SONA_EXPERIMENT_ID, and SONA_CREDIT_TOKEN in .env.
// SONA passes ?code=XXX in the URL when the participant starts — forwarded here.
app.get(`${prefix}/sona`, (req: Request, res: Response) => {
  const { SONA_BASE_URL, SONA_EXPERIMENT_ID, SONA_CREDIT_TOKEN } = process.env;
  res.redirect(`${SONA_BASE_URL}?experiment_id=${SONA_EXPERIMENT_ID}&credit_token=${SONA_CREDIT_TOKEN}&survey_code=${req.query.code}`);
});

// Use HTTPS in production (set ENVIRONMENT=production and point CREDENTIALS_PATH
// to a folder containing ssl_key.pem and ssl_cert.pem).
// Falls back to plain HTTP for local development.
let server;
if (process.env.ENVIRONMENT === 'production') {
  const credentials = process.env.CREDENTIALS_PATH || 'credentials/';
  const options = {
    key: fs.readFileSync(`${credentials}ssl_key.pem`),
    cert: fs.readFileSync(`${credentials}ssl_cert.pem`),
  };
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
