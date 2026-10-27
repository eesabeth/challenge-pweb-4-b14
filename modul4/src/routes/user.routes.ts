// src/routes/user.routes.ts
import { Router } from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser,
  getUserPosts,
} from "../controllers/userController";

const router = Router();

router.post("/", createUser);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.delete("/:id", deleteUser);
router.get('/:id/posts', getUserPosts);

export default router;