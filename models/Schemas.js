const mongoose = require('mongoose');

// 1. Skema Work Order
const WorkOrderSchema = new mongoose.Schema({
  woCode: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['CHECKUP', 'REPAIR'], required: true },
  locationName: { type: String, required: true },
  executionDate: { type: Date, default: Date.now },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'InfrastructureManager', required: true },
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
    enum: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
    default: 'ASSIGNED' 
  }
}, { timestamps: true });

WorkOrderSchema.index({ assignedTechnicianIds: 1 });
WorkOrderSchema.index({ 'technicians.technicianId': 1 });

// 2. Skema Notifikasi (In-App Notification Stateless)
const NotificationSchema = new mongoose.Schema({
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'NEW_WORK_ORDER' },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.index({ technicianId: 1, createdAt: -1 });

// 3. Model Report
const Report = mongoose.model('Report', new mongoose.Schema({
  status: { type: String, enum: ['unrepaired', 'under_repairment', 'repaired'] }
}, { strict: false }), 'reports');

const WorkOrder = mongoose.model('WorkOrder', WorkOrderSchema, 'work_orders');
const Notification = mongoose.model('Notification', NotificationSchema, 'notifications');

module.exports = { WorkOrder, Report, Notification };
