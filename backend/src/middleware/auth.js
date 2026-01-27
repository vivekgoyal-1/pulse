import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const generateToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      // Fallback for video streaming via <video> tag
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
};

