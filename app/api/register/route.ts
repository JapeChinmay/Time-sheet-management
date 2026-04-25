import { NextResponse } from "next/server";

export const users: any[] = [
  {
    id: "1",
    name: "Admin",
    email: "admin@test.com",
    password: "1234",
    role: "HR",
  },
];

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  const exists = users.find((u) => u.email === email);

  if (exists) {
    return NextResponse.json(
      { message: "User already exists" },
      { status: 400 }
    );
  }

  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    password,
    role: "EMPLOYEE",
  };

  users.push(newUser);

  return NextResponse.json({ message: "User created" });
}