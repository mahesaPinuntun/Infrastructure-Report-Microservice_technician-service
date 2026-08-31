require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('../config/db');
const { upload } = require('../config/cloudinary');
const verifyTechnicianToken = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Rule #18: Security Headers
app.use(helmet());

// Rule #11: Rate Limiter Perangkat Teknisi (Maksimal 60 request per 15 menit)
const technicianLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak aktivitas dari perangkat teknisi. Silakan tunggu 15 menit.' }
});

app.use('/api/technician', technicianLimiter);
app.use(cors());
app.use(express.json());

connectDB();

// Inject Socket.io ke dalam Request Object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Technician Routes
app.get('/api/technician/jobs', verifyTechnicianToken, technicianController.getAssignedJobs);
app.patch('/api/technician/jobs/:workOrderId/status', verifyTechnicianToken, technicianController.updateJobStatus);
app.post(
  '/api/technician/jobs/:workOrderId/progress',
  verifyTechnicianToken,
  upload.array('progressPhotos', 5),
  technicianController.uploadProgressPhoto
);
app.get('/', (req, res) => {
  res.json({ status: "Technician Service Active", port: process.env.PORT || 8004 });
});

app.get('/api/technician/health', (req, res) => {
  res.json({ status: "Technician Service Active", port: process.env.PORT || 8004 });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8004;
  server.listen(PORT, () => console.log(`Technician Service running on port ${PORT}`));
}

module.exports = app;
