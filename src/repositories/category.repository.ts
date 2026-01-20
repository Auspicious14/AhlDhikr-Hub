import { ICategory } from "../models/category";
import slugify from "slugify";
import { getPrismaClient } from "../services/prisma.service";
import { Category as PrismaCategory } from "@prisma/client";

export class CategoryRepository {
  async findOrCreateCategory(name: string): Promise<ICategory> {
    const prisma = getPrismaClient();
    const slug = slugify(name, { lower: true, strict: true });

    const existing: PrismaCategory | null = await prisma.category.findUnique({
      where: {
        slug,
      },
    });

    if (existing) {
      return {
        name: existing.name,
        slug: existing.slug,
      };
    }

    const created: PrismaCategory = await prisma.category.upsert({
      where: {
        slug,
      },
      create: {
        name,
        slug,
      },
      update: {
        name,
      },
    });

    return {
      name: created.name,
      slug: created.slug,
    };
  }
}
