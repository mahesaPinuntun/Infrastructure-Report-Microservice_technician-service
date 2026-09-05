const { WorkOrder, Report, Notification } = require('../models/Schemas'); // 🟢 Tambahkan Notification
const { cloudinary } = require('../config/cloudinary');

// 1. Ambil daftar Job Order / Mission List Teknisi (Paginated + Populate Report)
exports.getAssignedJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // 🟢 Safe Optional Chaining untuk ekstrak ID & Email Teknisi
    const technicianId = req.user?.id || req.user?._id || req.user?.userId;
    const technicianEmail = req.user?.email || '';

    if (!technicianId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload.' });
    }

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
        .populate('reportId') // 🟢 DIBERSIHKAN: Hapus .populate('managerId') untuk cegah Error 500
        .lean(),
      WorkOrder.countDocuments(query)
    ]);

    return res.json({
      data: jobs,
      meta: {
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('[technician-service] getAssignedJobs Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// 2. Terima atau Ubah Status Job Order (ACCEPTED, IN_PROGRESS, COMPLETED)
exports.updateJobStatus = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status state transition.' });
    }

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ error: 'Work Order not found.' });

    const technicianId = req.user?.id || req.user?._id || req.user?.userId;
    const technicianEmail = req.user?.email || '';

    // Lock Record Access
    const isAssigned =
      workOrder.assignedTechnicianIds?.some((id) => id.toString() === technicianId?.toString()) ||
      workOrder.technicians?.some(
        (t) => t.email === technicianEmail || t.technicianId?.toString() === technicianId?.toString()
      );

    if (!isAssigned) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this job order.' });
    }

    workOrder.status = status;
    await workOrder.save();

    if (status === 'COMPLETED' && workOrder.reportId) {
      await Report.findByIdAndUpdate(workOrder.reportId, { status: 'repaired' });
    }

    return res.json({ message: `Job order status updated to ${status}.`, workOrder });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Upload Foto Progress Perbaikan ke Cloudinary
exports.uploadProgressPhoto = async (req, res) => {
  try {
    const { workOrderId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one progress image is required.' });
    }

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return res.status(404).json({ error: 'Work Order not found.' });

    const technicianId = req.user?.id || req.user?._id || req.user?.userId;
    const technicianEmail = req.user?.email || '';

    // Lock Record Access
    const isAssigned =
      workOrder.assignedTechnicianIds?.some((id) => id.toString() === technicianId?.toString()) ||
      workOrder.technicians?.some(
        (t) => t.email === technicianEmail || t.technicianId?.toString() === technicianId?.toString()
      );

    if (!isAssigned) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this job order.' });
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

    return res.json({
      message: 'Progress photos uploaded successfully.',
      progressImages: workOrder.progressImages
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 🟢 4. Ambil Daftar Notifikasi Teknisi (Diperlukan oleh Mobile App Polling - Cegah Error 404)
exports.getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const recipientId = req.user?.id || req.user?._id || req.user?.userId;

    const query = { recipientId };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId, isRead: false })
    ]);

    return res.json({
      data: notifications,
      meta: {
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        unreadCount
      }
    });
  } catch (error) {
    console.error('[technician-service] getNotifications Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
