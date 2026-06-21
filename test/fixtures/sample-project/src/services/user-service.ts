import { User } from "../models/user"
import { query } from "../utils/db"

export class UserService {
  async createUser(name: string, email: string): Promise<User> {
    const result = await query("INSERT INTO users ...", [name, email])
    return new User(result.id, name, email)
  }

  async getUser(id: string): Promise<User | null> {
    const result = await query("SELECT * FROM users WHERE id = ?", [id])
    return result ? new User(result.id, result.name, result.email) : null
  }
}
