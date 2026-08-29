const jwt = require('jsonwebtoken');

const verifyTechnicianToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'TECHNICIAN') {
      return res.status(403).json({ error: "Forbidden: Only Technicians can access this endpoint." });
    }
    req.user = decoded; // Contains id, role, collection
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

module.exports = verifyTechnicianToken;