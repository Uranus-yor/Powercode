import { UserService } from "../services/user-service"

const userService = new UserService()

export async function handleCreateUser(req: Request) {
  const { name, email } = await req.json()
  const user = await userService.createUser(name, email)
  return new Response(JSON.stringify(user))
}

export async function handleGetUser(req: Request) {
  const url = new URL(req.url)
  const id = url.pathname.split("/").pop()
  if (!id) return new Response("Missing id", { status: 400 })
  const user = await userService.getUser(id)
  if (!user) return new Response("Not found", { status: 404 })
  return new Response(JSON.stringify(user))
}
