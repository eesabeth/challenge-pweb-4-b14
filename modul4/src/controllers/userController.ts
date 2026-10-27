// src/controllers/userController.ts
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { parseId } from "../utils/parse";
import { sendSuccess } from "../utils/response";

export const createUser = async (req: Request, res: Response) => {
  // Express 5: req.body = undefined jika body tidak ter-parse, jadi beri fallback {}
  const { email, name, password } = req.body ?? {};

  if (!email || !password) {
    throw new HttpError(400, "Email dan password wajib diisi");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "Email sudah terdaftar");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: await bcrypt.hash(password, 10), // jangan pernah simpan password polos
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  sendSuccess(res, 201, "User berhasil dibuat", user);
};

export const getAllUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
  });

  sendSuccess(res, 200, "Berhasil mengambil data users", users);
};

export const getUserById = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      posts: {
        select: { id: true, title: true, published: true, createdAt: true },
      },
    },
  });

  if (!user) throw new HttpError(404, "User tidak ditemukan");

  sendSuccess(res, 200, "Berhasil mengambil data user", user);
};

export const updateUser = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const { email, name } = req.body ?? {};

  // Jika id tidak ada, Prisma melempar error P2025 -> ditangani errorHandler (404)
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(email && { email }),
      ...(name && { name }),
    },
    select: { id: true, email: true, name: true, updatedAt: true },
  });

  sendSuccess(res, 200, "User berhasil diupdate", user);
};

export const deleteUser = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  // Post milik user ikut terhapus karena `onDelete: Cascade` di schema
  await prisma.user.delete({ where: { id } });

  sendSuccess(res, 200, "User berhasil dihapus");
};

// Mengambil postingan berdasarkan ID user dengan pagination & filter published
export const getUserPosts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '10', published } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Menyusun kondisi filter
    const whereClause: any = { authorId: Number(id) };
    if (published !== undefined) {
      whereClause.published = published === 'true';
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      skip: skip,
      take: limitNumber,
      include: { 
        author: { select: { name: true, email: true } } 
      },
    });

    res.status(200).json({ 
      status: true, 
      page: pageNumber, 
      limit: limitNumber, 
      data: posts 
    });
  } catch (error: any) {
    res.status(500).json({ status: false, message: error.message });
  }
};