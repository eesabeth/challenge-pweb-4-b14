// src/controllers/postController.ts
import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { parseId } from "../utils/parse";
import { sendSuccess } from "../utils/response";

const authorSelect = { select: { id: true, name: true, email: true } };

export const createPost = async (req: Request, res: Response) => {
  const { title, content, authorId } = req.body ?? {};

  if (!title || !authorId) {
    throw new HttpError(400, "Title dan authorId wajib diisi");
  }

  const author = await prisma.user.findUnique({
    where: { id: parseId(authorId) },
  });
  if (!author) throw new HttpError(404, "User tidak ditemukan");

  const post = await prisma.post.create({
    data: { title, content, authorId: author.id },
    include: { author: authorSelect },
  });

  sendSuccess(res, 201, "Post berhasil dibuat", post);
};

// GET /api/posts?page=1&limit=5&search=eco&published=true
export const getAllPosts = async (req: Request, res: Response) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const published =
    req.query.published === undefined
      ? undefined
      : req.query.published === "true";

  const where = {
    ...(search && { title: { contains: search, mode: "insensitive" as const } }),
    ...(published !== undefined && { published }),
  };

  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect },
    }),
    prisma.post.count({ where }),
  ]);

  sendSuccess(res, 200, "Berhasil mengambil data posts", posts, {
    currentPage: page,
    limit,
    totalItems: total,
    totalPages: Math.ceil(total / limit),
  });
};

export const getPostStats = async (_req: Request, res: Response) => {
  const [overall, perAuthor] = await Promise.all([
    prisma.post.aggregate({
      _count: { id: true },
      _sum: { views: true },
      _avg: { views: true },
      _max: { views: true },
    }),
    prisma.post.groupBy({
      by: ["authorId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  sendSuccess(res, 200, "Berhasil mengambil statistik posts", {
    overall,
    perAuthor,
  });
};

export const getPostById = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: authorSelect },
  });
  if (!post) throw new HttpError(404, "Post tidak ditemukan");

  sendSuccess(res, 200, "Berhasil mengambil data post", post);
};

export const updatePost = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const { title, content, published } = req.body ?? {};

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(content !== undefined && { content }),
      ...(published !== undefined && { published }),
    },
    include: { author: authorSelect },
  });

  sendSuccess(res, 200, "Post berhasil diupdate", post);
};

export const deletePost = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  await prisma.post.delete({ where: { id } });

  sendSuccess(res, 200, "Post berhasil dihapus");
};

export const getDailyPostStats = async (req: Request, res: Response) => {
  try {
    // Menjalankan raw query PostgreSQL untuk menghitung jumlah post per hari berdasarkan createdAt
    const stats = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
      FROM "Post"
      GROUP BY date
      ORDER BY date DESC;
    `;

    // Mengonversi BigInt dari hasil COUNT SQL agar bisa di-serialize ke JSON oleh Express
    const serializedStats = JSON.parse(
      JSON.stringify(stats, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value
      )
    );

    res.status(200).json({ status: true, data: serializedStats });
  } catch (error: any) {
    res.status(500).json({ status: false, message: error.message });
  }
};

export const bulkCreatePosts = async (req: Request, res: Response) => {
  try {
    const postsData = req.body; // Diharapkan berupa array data postingan

    // Validasi sederhana memastikan body yang dikirim adalah array
    if (!Array.isArray(postsData) || postsData.length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: 'Format data harus berupa array dan tidak boleh kosong.' 
      });
    }

    // Menggunakan createMany untuk menyimpan banyak data sekaligus
    const result = await prisma.post.createMany({
      data: postsData,
      skipDuplicates: true, // Opsional: mengabaikan data duplikat jika ada
    });

    res.status(201).json({ 
      status: true, 
      message: `Berhasil menambahkan ${result.count} postingan sekaligus.`,
      count: result.count 
    });
  } catch (error: any) {
    res.status(500).json({ status: false, message: error.message });
  }
};