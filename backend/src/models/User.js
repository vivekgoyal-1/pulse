import mongoose from 'mongoose';

export const ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin',
};

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    tenantId: { type: String, required: true }, // simple string tenant/org identifier
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.VIEWER,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;

