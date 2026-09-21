import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import serviceRoutes from './modules/services/service.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/services', serviceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
