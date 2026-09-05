const { Notification } = require('../models/Schemas');

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'super-secret-key-123';

// 1. Dipanggil oleh manager-service via POST /api/internal/notifications
exports.createInternalNotification = async (req, res) => {
  try {
    // Validasi rahasia internal antar-service Vercel
    const secretHeader = req.headers['x-internal-secret'];
    if (!secretHeader || secretHeader !== INTERNAL_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid internal secret.' });
    }

    const { assignedTechnicianIds, title, message, workOrderId, type } = req.body;

    if (!assignedTechnicianIds || !Array.isArray(assignedTechnicianIds) || assignedTechnicianIds.length === 0) {
      return res.status(400).json({ error: 'assignedTechnicianIds array is required.' });
    }

    const notifications = assignedTechnicianIds.map((techId) => ({
      technicianId: techId,
      title,
      message,
      type: type || 'NEW_WORK_ORDER',
      workOrderId: workOrderId || null,
      isRead: false
    }));

    await Notification.insertMany(notifications);

    return res.status(201).json({ success: true, message: 'Notifications stored successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Diambil oleh Mobile App Teknisi via GET /api/technician/notifications (Digunakan untuk Adaptive Polling)
exports.getTechnicianNotifications = async (req, res) => {
  try {
    const technicianId = req.user.id || req.user._id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ technicianId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ technicianId }),
      Notification.countDocuments({ technicianId, isRead: false })
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
    return res.status(500).json({ error: error.message });
  }
};

// 3. Ditandai Dibaca Satuan via PATCH /api/technician/notifications/:id/read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const technicianId = req.user.id || req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, technicianId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    return res.json({ message: 'Notification marked as read.', notification });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Ditandai Dibaca Semua via PATCH /api/technician/notifications/read-all
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const technicianId = req.user.id || req.user._id;

    await Notification.updateMany(
      { technicianId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
