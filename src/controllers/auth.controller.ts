import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { getPrismaClient } from "../services/prisma.service";
import { User as PrismaUser } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-it";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ success: false, message: "Email and password are required" });
      }

      const prisma = getPrismaClient();

      const existing = await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (existing) {
        return res
          .status(409)
          .json({ success: false, message: "User already exists" });
      }

      const hashedPassword = await argon2.hash(password);

      const user: PrismaUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        },
      });

      const token = jwt.sign(
        { userId: user.id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const prisma = getPrismaClient();

      const user: PrismaUser | null = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      if (!user.password) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      const isValid = await argon2.verify(user.password, password);
      if (!isValid) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async googleLogin(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return res
          .status(400)
          .json({ success: false, message: "Google token required" });
      }

      if (!GOOGLE_CLIENT_ID) {
        return res
          .status(500)
          .json({ success: false, message: "Google auth not configured" });
      }

      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Google token" });
      }

      const { email, name, sub: googleId } = payload;

      const prisma = getPrismaClient();

      let user: PrismaUser | null = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (user) {
        if (!user.googleId) {
          user = await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              googleId,
              name: name || user.name,
            },
          });
        }
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name: name || null,
            googleId,
          },
        });
      }

      const jwtToken = jwt.sign(
        { userId: user.id.toString(), email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        success: true,
        token: jwtToken,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      console.error("Google login error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getMe(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      const prisma = getPrismaClient();

      const user = await prisma.user.findUnique({
        where: {
          id: BigInt(userId),
        },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
