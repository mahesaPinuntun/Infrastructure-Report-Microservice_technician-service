const { WorkOrder, Report } = require('../models/Schemas');
const { cloudinary } = require('../config/cloudinary');

// Helper untuk mengirimkan notifikasi Socket.IO ke room personal setiap teknisi
const notifyAssignedTechnicians = (io, workOrder, eventData = {}) => {
  if (!io || !workOrder) return;

  const assignedIds = workOrder.assignedTechnicianIds || [];
  assignedIds.forEach((techId) => {
    const roomId = `technician_${techId.toString()}`;
    io.to(roomId).emit('TECHNICIAN_WORK_ORDER_UPDATED', {
      workOrderId: workOrder._id,
      woCode: workOrder.woCode,
      locationName: workOrder.locationName,
      status: workOrder.status,
      executionDate: workOrder.executionDate,
      updatedAt: new Date(),
      ...eventData
    });
  });
};

// 1. Ambil daftar Job Order / Mission List Teknisi (Paginated + Populate Infrastructure Report)
exports.getAssignedJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const technicianId = req.user.id || req.user._id;
    const technicianEmail = req.user.email;

    // Filter misi berdasarkan assignedTechnicianIds ATAU sub-document technicians
    const query = {
      $or: [
        { assignedTechnicianIds: technicianId },
        { 'technicians.technicianId': technicianId },
        { 'technicians.email': technicianEmail }
      ]
    };

    if (req.query.status) {
      query.status = req.query.status.toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      WorkOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('managerId', 'name department email')
        .populate('reportId') // Populasikan data penuh Laporan Infrastruktur
        .lean(),
      WorkOrder.countDocuments(query)
    ]);

    res.json({
      data: jobs,
      meta: { 
        currentPage: page, 
        pageSize: limit, 
        totalPages: Math.ceil(total / limit), 
        totalRecords: total 
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Terima atau Ubah Status Job Order (ACCEPTED, IN_PROGRESS, COMPLETED)
exports.updateJobStatus = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status state transition." });
    }

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ error: "Work Order not found." });

    const technicianId = req.user.id || req.user._id;
    const technicianEmail = req.user.email;

    // Lock Record Access
    const isAssigned =
      workOrder.assignedTechnicianIds?.some((id) => id.toString() === technicianId.toString()) ||
      workOrder.technicians?.some((t) => t.email === technicianEmail || t.technicianId?.toString() === technicianId.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: "Forbidden: You are not assigned to this job order." });
    }

    workOrder.status = status;
    await workOrder.save();

    if (status === 'COMPLETED' && workOrder.reportId) {
      await Report.findByIdAndUpdate(workOrder.reportId, { status: 'repaired' });
    }

    // Kirim notifikasi Socket.IO ke room personal teknisi & dashboard
    notifyAssignedTechnicians(req.io, workOrder, {
      type: 'STATUS_CHANGED',
      updatedBy: technicianId
    });
    req.io.emit('WORK_ORDER_STATUS_UPDATED', { workOrderId, status, updatedBy: technicianId });

    res.json({ message: `Job order status updated to ${status}.`, workOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Upload Foto Progress Perbaikan ke Cloudinary
exports.uploadProgressPhoto = async (req, res) => {
  try {
    const { workOrderId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one progress image is required." });
    }

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ error: "Work Order not found." });

    const technicianId = req.user.id || req.user._id;
    const technicianEmail = req.user.email;

    // Lock Record Access
    const isAssigned =
      workOrder.assignedTechnicianIds?.some((id) => id.toString() === technicianId.toString()) ||
      workOrder.technicians?.some((t) => t.email === technicianEmail || t.technicianId?.toString() === technicianId.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: "Forbidden: You are not assigned to this job order." });
    }

    for (const file of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'technician_progress' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });
      workOrder.progressImages.push(uploadResult.secure_url);
    }

    await workOrder.save();

    // Kirim notifikasi Socket.IO ke room personal teknisi & dashboard
    notifyAssignedTechnicians(req.io, workOrder, {
      type: 'PROGRESS_PHOTO_ADDED',
      progressImages: workOrder.progressImages
    });
    req.io.emit('PROGRESS_PHOTO_ADDED', { workOrderId, progressImages: workOrder.progressImages });

    res.json({ message: "Progress photos uploaded successfully.", progressImages: workOrder.progressImages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
