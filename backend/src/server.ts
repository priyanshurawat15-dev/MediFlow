import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase } from './database/db.js';

import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import patientRoutes from './routes/patient.routes.js';
import emergencyRoutes from './routes/emergency.routes.js';
import ambulanceRoutes from './routes/ambulance.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import bedRoutes from './routes/bed.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import staffRoutes from './routes/staff.routes.js';
import billingRoutes from './routes/billing.routes.js';
import reportRoutes from './routes/report.routes.js';

dotenv.config();

// Initialize Database schema
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'MediFlow – Smart Hospital & Emergency Management System API',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend build if in production
const frontendDist = path.resolve(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendDist));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(frontendDist, 'index.html');
    return res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('MediFlow Backend API Server Running. Please start frontend in dev mode on port 3000.');
      }
    });
  }
  next();
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🏥 MediFlow Hospital Management Backend active on http://localhost:${PORT}`);
});

export default app;
