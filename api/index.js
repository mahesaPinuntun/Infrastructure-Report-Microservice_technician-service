require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('../config/db');
const { upload } = require('../config/cloudinary');
const verifyTechnicianToken = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');
const notificationController = require('../controllers/notificationController');

const app = express();

// Security & Base Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database Connection
connectDB();

// Rate Limiter Perangkat Teknisi (Ditingkatkan ke 1200 req / 15 min untuk mendukung Adaptive Polling)
const technicianLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak aktivitas dari perangkat teknisi. Silakan tunggu beberapa saat.' }
});

// Middleware Proteksi Header Internal Secret (Khusus dipanggil oleh manager-service)
const verifyInternalSecret = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_SECRET || 'super-secret-key-123';
  if (!secret || secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized internal service request.' });
  }
  next();
};

// =============================================================================
// 1. ENDPOINT INTERNAL (Dipanggil oleh manager-service dari Vercel)
// =============================================================================
app.post(
  '/api/internal/notifications',
  verifyInternalSecret,
  notificationController.createInternalNotification
);

// =============================================================================
// 2. ENDPOINT TECHNICIAN (Dipanggil oleh Mobile App Teknisi)
// =============================================================================
app.use('/api/technician', technicianLimiter);

// Job Order Routes
app.get('/api/technician/jobs', verifyTechnicianToken, technicianController.getAssignedJobs);
app.patch('/api/technician/jobs/:workOrderId/status', verifyTechnicianToken, technicianController.updateJobStatus);
app.post(
  '/api/technician/jobs/:workOrderId/progress',
  verifyTechnicianToken,
  upload.array('progressPhotos', 5),
  technicianController.uploadProgressPhoto
);

// In-App Notification Routes (Mendukung Polling, Mark Read Satuan & Massal)
app.get('/api/technician/notifications', verifyTechnicianToken, notificationController.getTechnicianNotifications);
app.patch('/api/technician/notifications/read-all', verifyTechnicianToken, notificationController.markAllNotificationsAsRead);
app.patch('/api/technician/notifications/:id/read', verifyTechnicianToken, notificationController.markNotificationAsRead);

// Health Check & Root
app.get('/', (req, res) => {
  res.json({ 
    serviceName: "Infrastructure-Report Technician Service",
    status: "Technician Service Active", 
    port: process.env.PORT || "",
    serviceRole: "Technician",
    versionType: "alpha",
    versionNumber: "0.0.1"
  });
});

app.get('/api/technician/health', (req, res) => {
  res.json({ status: "Technician Service Active", port: process.env.PORT || 8004 });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8004;
  app.listen(PORT, () => console.log(`Technician Service running on port ${PORT}`));
}

module.exports = app;
