import { Category, ICategory } from '../models/category';
import slugify from 'slugify';

export class CategoryRepository {
  async findOrCreateCategory(name: string): Promise<ICategory> {
    const slug = slugify(name, { lower: true, strict: true });
    let category = await Category.findOne({ slug }).exec();
    if (!category) {
      category = new Category({ name, slug });
      await category.save();
    }
    return category;
  }
}
