import { Request, Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { OAuth2Client } from "google-auth-library";

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

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(409)
          .json({ success: false, message: "User already exists" });
      }

      const hashedPassword = await argon2.hash(password);

      const user = new User({
        email,
        password: hashedPassword,
        name,
      });

      await user.save();

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        token,
        user: { id: user._id, email: user.email, name: user.name },
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

      const user = await User.findOne({ email });
      if (!user || !user.password) {
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
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        success: true,
        token,
        user: { id: user._id, email: user.email, name: user.name },
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

      let user = await User.findOne({ email });

      if (user) {
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }
      } else {
        user = new User({
          email,
          name,
          googleId,
        });
        await user.save();
      }

      const jwtToken = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        success: true,
        token: jwtToken,
        user: { id: user._id, email: user.email, name: user.name },
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
      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
