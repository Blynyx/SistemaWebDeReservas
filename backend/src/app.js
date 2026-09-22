import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import appointmentRoutes from './modules/appointments/appointment.routes.js';
import availabilityRoutes from './modules/availability/availability.routes.js';
import clientRoutes from './modules/clients/client.routes.js';
import professionalRoutes from './modules/professionals/professional.routes.js';
import selfRoutes from './modules/self/self.routes.js';
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
app.use('/api/v1/professionals', professionalRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/me', selfRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
