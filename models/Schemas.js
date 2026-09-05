const mongoose = require('mongoose');

// 1. Skema Work Order (Disesuaikan agar fleksibel dengan data dari manager-service)
const WorkOrderSchema = new mongoose.Schema({
  woCode: { type: String },
  title: { type: String, required: false },
  description: { type: String },
  type: { type: String, required: false },
  locationName: { type: String },
  executionDate: { type: Date, default: Date.now },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'InfrastructureManager', required: false },
  assignedTechnicianIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Technician' }],
  technicians: [
    {
      technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
      name: String,
      email: String,
      fee: Number
    }
  ],
  warrantPdfUrl: { type: String },
  currentPictureUrl: { type: String, default: '' },
  progressImages: [{ type: String }],
  status: { 
    type: String, 
    default: 'ASSIGNED' 
  }
}, { 
  timestamps: true,
  strict: false // 🟢 Mencegah Mongoose menolak field dinamis antar microservice
});

WorkOrderSchema.index({ assignedTechnicianIds: 1 });
WorkOrderSchema.index({ 'technicians.technicianId': 1 });

// 2. Skema Notifikasi (Mendukung technicianId & recipientId)
const NotificationSchema = new mongoose.Schema({
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: false },
  recipientId: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'NEW_WORK_ORDER' },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
  isRead: { type: Boolean, default: false }
}, { 
  timestamps: true,
  strict: false 
});

NotificationSchema.index({ technicianId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// 3. Model Report & Export
const Report = mongoose.models.Report || mongoose.model('Report', new mongoose.Schema({
  status: { type: String }
}, { strict: false }), 'reports');

const WorkOrder = mongoose.models.WorkOrder || mongoose.model('WorkOrder', WorkOrderSchema, 'work_orders');
const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema, 'notifications');

module.exports = { WorkOrder, Report, Notification };
