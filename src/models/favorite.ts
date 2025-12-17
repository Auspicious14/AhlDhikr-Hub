import { Document, Schema, model } from "mongoose";

export interface IFavorite extends Document {
  userId: string;
  answerSlug: string;
  createdAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: String, required: true, index: true },
    answerSlug: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Create compound index to prevent duplicate favorites
FavoriteSchema.index({ userId: 1, answerSlug: 1 }, { unique: true });

export const Favorite = model<IFavorite>("Favorite", FavoriteSchema);
