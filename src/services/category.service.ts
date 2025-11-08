import { CategoryRepository } from '../repositories/category.repository';
import { ICategory } from '../models/category';

export class CategoryService {
  private categoryRepository: CategoryRepository;

  constructor(categoryRepository: CategoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async findOrCreateCategory(name: string): Promise<ICategory> {
    return this.categoryRepository.findOrCreateCategory(name);
  }
}
