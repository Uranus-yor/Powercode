import { UserService } from "../src/services/user-service"

jest.mock("../src/utils/db")

describe("UserService", () => {
  it("should create user", async () => {
    const service = new UserService()
    const user = await service.createUser("test", "test@example.com")
    expect(user.name).toBe("test")
  })
})
