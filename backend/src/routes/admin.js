import express from 'express';
import User, { ROLES } from '../models/User.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes here assume authMiddleware has already run.
router.use(requireRole(ROLES.ADMIN));

// List users in current tenant
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({ tenantId: req.user.tenantId }).select(
      'email name tenantId role createdAt'
    );
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// Update user role (same tenant only)
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found in tenant' });
    }

    // Prevent demoting the only admin in a tenant
    if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
      const adminCount = await User.countDocuments({
        tenantId: req.user.tenantId,
        role: ROLES.ADMIN,
      });
      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ message: 'Cannot remove the last admin for this tenant' });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Delete user (same tenant only, cannot delete self)
router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === String(req.user._id)) {
      return res.status(400).json({ message: 'Admins cannot delete themselves' });
    }

    const user = await User.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found in tenant' });
    }

    // Prevent deleting the last admin
    if (user.role === ROLES.ADMIN) {
      const adminCount = await User.countDocuments({
        tenantId: req.user.tenantId,
        role: ROLES.ADMIN,
      });
      if (adminCount <= 1) {
        return res
          .status(400)
          .json({ message: 'Cannot delete the last admin for this tenant' });
      }
    }

    await user.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

