import express from 'express';
import bcrypt from 'bcryptjs';
import User, { ROLES } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, tenantId, role } = req.body;
    if (!email || !password || !name || !tenantId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      name,
      tenantId,
      role: role && Object.values(ROLES).includes(role) ? role : ROLES.EDITOR,
    });

    const token = generateToken(user);
    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

