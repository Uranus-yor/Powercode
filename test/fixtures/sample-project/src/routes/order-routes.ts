import { OrderService } from "../services/order-service"
import { UserService } from "../services/user-service"

const userService = new UserService()
const orderService = new OrderService(userService)

export async function handleCreateOrder(req: Request) {
  const { userId, amount } = await req.json()
  const order = await orderService.createOrder(userId, amount)
  return new Response(JSON.stringify(order))
}
