const { WorkOrder, Report } = require('../models/Schemas');
const { cloudinary } = require('../config/cloudinary');

// 1. Ambil daftar Job Order yang ditugaskan ke Teknisi ini (#7, #21)
exports.getAssignedJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10)); // #17 Trim API response
    const skip = (page - 1) * limit;

    const query = { assignedTechnicianIds: req.user.id };

    const [jobs, total] = await Promise.all([
      WorkOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('managerId', 'name department email')
        .lean(),
      WorkOrder.countDocuments(query)
    ]);

    res.json({
      data: jobs,
      meta: { currentPage: page, pageSize: limit, totalPages: Math.ceil(total / limit), totalRecords: total }
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

    // Lock Record Access (#7) - Pastikan teknisi memang ditugaskan pada pekerjaan ini
    const isAssigned = workOrder.assignedTechnicianIds.some(
      (techId) => techId.toString() === req.user.id
    );
    if (!isAssigned) {
      return res.status(403).json({ error: "Forbidden: You are not assigned to this job order." });
    }

    workOrder.status = status;
    await workOrder.save();

    // Jika pekerjaan selesai, otomatis ubah status laporan publik menjadi 'repaired'
    if (status === 'COMPLETED' && workOrder.reportId) {
      await Report.findByIdAndUpdate(workOrder.reportId, { status: 'repaired' });
    }

    // Emit event live update ke Admin & Manager Web Dashboard
    req.io.emit('WORK_ORDER_STATUS_UPDATED', { workOrderId, status, updatedBy: req.user.id });

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

    // Lock Record Access (#7)
    const isAssigned = workOrder.assignedTechnicianIds.some(
      (techId) => techId.toString() === req.user.id
    );
    if (!isAssigned) {
      return res.status(403).json({ error: "Forbidden: You are not assigned to this job order." });
    }

    // Upload images to Cloudinary
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

    req.io.emit('PROGRESS_PHOTO_ADDED', { workOrderId, progressImages: workOrder.progressImages });

    res.json({ message: "Progress photos uploaded successfully.", progressImages: workOrder.progressImages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};