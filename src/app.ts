import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { ApiError } from './utils/ApiError.js';
import users from './routes/user.routes.js';
import content from './routes/content.routes.js';
import shares from './routes/share.routes.js';
const app = express();
app.disable('x-powered-by'); app.use(helmet());
const allowedOrigins = () => (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { cb(null, !origin || allowedOrigins().includes(origin)); }, credentials: true }));
// Reject cross-origin state-changing requests, including form-based CSRF.
app.use((req, res, next) => { const origin = req.get('origin'); if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && !allowedOrigins().includes(origin)) { res.status(403).json({ success: false, message: 'Origin not allowed' }); return; } next(); });
app.use(express.json({ limit: '32kb' })); app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', users); app.use('/api/content', content); app.use('/api/share', shares);
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found' }));
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) { res.status(400).json({ success: false, message: err.issues.map(i => i.message).join('; ') }); return; }
  if (err instanceof ApiError) { res.status(err.statusCode).json({ success: false, message: err.message }); return; }
  if (err?.code === 11000) { res.status(409).json({ success: false, message: 'A record with this value already exists' }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ success: false, message: 'Invalid JSON' }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ success: false, message: 'Request too large' }); return; }
  console.error('Request failed:', err?.name || 'Error');
  res.status(500).json({ success: false, message: 'Something went wrong' });
};
app.use(errorHandler);
export { app };
