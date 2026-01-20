export interface IUser {
  email: string;
  password?: string;
  name?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}
