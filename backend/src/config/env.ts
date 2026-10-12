import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://sadiquaparween@localhost:5432/borrowflex',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-borrowflex-key-2026-v1',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
