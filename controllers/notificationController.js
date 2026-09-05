const { Notification } = require('../models/Schemas');

// 1. Dipanggil oleh manager-service via POST /api/internal/notifications
exports.createInternalNotification = async (req, res) => {
  try {
    const {
      recipientId,
      assignedTechnicianIds,
      technicianId,
      title,
      message,
      workOrderId,
      type
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    // Ekstrak dan gabungkan seluruh kemungkinan ID teknisi penerima
    let recipients = [];
    if (recipientId) recipients.push(recipientId.toString());
    if (technicianId) recipients.push(technicianId.toString());
    if (Array.isArray(assignedTechnicianIds)) {
      assignedTechnicianIds.forEach((id) => recipients.push(id.toString()));
    }

    // Hilangkan ID duplikat
    recipients = [...new Set(recipients)];

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient ID is required.' });
    }

    // Buat dokumen notifikasi untuk setiap teknisi penerima
    const notifications = recipients.map((techId) => ({
      technicianId: techId,
      recipientId: techId, // Simpan kedua field agar kompatibel dengan skema Mongoose
      title,
      message,
      type: type || 'NEW_WORK_ORDER',
      workOrderId: workOrderId || null,
      isRead: false
    }));

    await Notification.insertMany(notifications);

    return res.status(201).json({
      success: true,
      message: 'Notifications stored successfully.',
      count: notifications.length
    });
  } catch (error) {
    console.error('[notificationController] createInternalNotification Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// 2. Diambil oleh Mobile App Teknisi via GET /api/technician/notifications (Adaptive Polling)
exports.getTechnicianNotifications = async (req, res) => {
  try {
    // Ekstrak ID teknisi secara aman dari JWT payload
    const technicianId = req.user?.id || req.user?._id || req.user?.userId;

    if (!technicianId) {
      return res.status(401).json({ error: 'Unauthorized: Technician ID missing from token.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Pencarian fleksibel untuk mencakup field technicianId maupun recipientId
    const query = {
      $or: [
        { technicianId: technicianId.toString() },
        { recipientId: technicianId.toString() }
      ]
    };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, isRead: false })
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
    console.error('[notificationController] getTechnicianNotifications Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// 3. Ditandai Dibaca Satuan via PATCH /api/technician/notifications/:id/read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const technicianId = req.user?.id || req.user?._id || req.user?.userId;

    if (!technicianId) {
      return res.status(401).json({ error: 'Unauthorized: Technician ID missing from token.' });
    }

    const query = {
      _id: id,
      $or: [
        { technicianId: technicianId.toString() },
        { recipientId: technicianId.toString() }
      ]
    };

    const notification = await Notification.findOneAndUpdate(
      query,
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
    const technicianId = req.user?.id || req.user?._id || req.user?.userId;

    if (!technicianId) {
      return res.status(401).json({ error: 'Unauthorized: Technician ID missing from token.' });
    }

    const query = {
      $or: [
        { technicianId: technicianId.toString() },
        { recipientId: technicianId.toString() }
      ],
      isRead: false
    };

    await Notification.updateMany(query, { $set: { isRead: true } });

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
