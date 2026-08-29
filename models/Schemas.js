const mongoose = require('mongoose');

const WorkOrderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['CHECKUP', 'REPAIR'], required: true },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'InfrastructureManager', required: true },
  assignedTechnicianIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Technician' }],
  warrantPdfUrl: { type: String, required: true },
  currentPictureUrl: { type: String, default: '' },
  progressImages: [{ type: String }],
  status: { 
    type: String, 
    enum: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
    default: 'ASSIGNED' 
  }
}, { timestamps: true });

WorkOrderSchema.index({ assignedTechnicianIds: 1 });

const Report = mongoose.model('Report', new mongoose.Schema({
  status: { type: String, enum: ['unrepaired', 'under_repairment', 'repaired'] }
}, { strict: false }), 'reports');

const WorkOrder = mongoose.model('WorkOrder', WorkOrderSchema, 'work_orders');

module.exports = { WorkOrder, Report };