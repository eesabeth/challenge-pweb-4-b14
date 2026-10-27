import { Request, Response } from 'express';
import prisma from '../config/prisma';

// 1. Create Comment
export const createComment = async (req: Request, res: Response) => {
  try {
    const { content, postId, authorId } = req.body;
    const comment = await prisma.comment.create({
      data: { content, postId, authorId },
    });
    res.status(201).json({ status: true, data: comment });
  } catch (error: any) {
    res.status(400).json({ status: false, message: error.message });
  }
};

// 2. Get Comments by Post
export const getCommentsByPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { postId: Number(postId) },
      include: { author: { select: { name: true } } },
    });
    res.status(200).json({ status: true, data: comments });
  } catch (error: any) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// 3. Delete Comment
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.comment.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ status: true, message: 'Komentar berhasil dihapus' });
  } catch (error: any) {
    res.status(400).json({ status: false, message: error.message });
  }
};