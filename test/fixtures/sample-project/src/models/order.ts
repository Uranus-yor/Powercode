import { User } from "./user"

export class Order {
  constructor(
    public id: string,
    public user: User,
    public amount: number
  ) {}
}
