import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import 'dotenv/config';
import { Insert } from './mongo';

const app = express();
const PORT = process.env.PORT || 9000;

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

app.use(express.static(__dirname));
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.redirect(`/${process.env.VITE_BASE_PATH}`);
});

app.get(`/${process.env.VITE_BASE_PATH}/*`, (req: Request, res: Response) => {
  const filePath = req.params[0];
  res.sendFile(path.join(__dirname, '..', 'dist', filePath));
});

app.get(`/${process.env.VITE_BASE_PATH}`, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.post(`/${process.env.VITE_BASE_PATH}/submit`, async (req: Request, res: Response) => {
  const data = req.body;
  if (data.action === 'insert') {
    Insert(data.data, data.data.participantID, 'participantID');
    res.end('Data saved!');
  }
});

app.get('/*', (req: Request, res: Response) => {
  res.send('Incorrect URL');
});

server.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
