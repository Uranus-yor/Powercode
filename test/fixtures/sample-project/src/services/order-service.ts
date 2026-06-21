import { Order } from "../models/order"
import { UserService } from "./user-service"
import { query } from "../utils/db"

export class OrderService {
  constructor(private userService: UserService) {}

  async createOrder(userId: string, amount: number): Promise<Order> {
    const user = await this.userService.getUser(userId)
    if (!user) throw new Error("User not found")
    const result = await query("INSERT INTO orders ...", [userId, amount])
    return new Order(result.id, user, amount)
  }
}
