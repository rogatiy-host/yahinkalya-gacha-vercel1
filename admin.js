import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function normalizeLogin(login = '') {
  return String(login).trim().toLowerCase().replace(/[^a-z0-9_\-.а-яё]/gi, '').slice(0, 24);
}

export function makeReferralCode(login) {
  const tail = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${normalizeLogin(login).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'GACHA'}${tail}`;
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, login: user.login }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function publicUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
