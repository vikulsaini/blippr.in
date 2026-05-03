import jwt from 'jsonwebtoken';

export function signJwt(user) {
  return jwt.sign({ sub: user._id.toString(), phone: user.phone }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}
