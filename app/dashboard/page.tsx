import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await auth();

  if (!session) redirect("/login");

  const role = session.user.role;

  if (role === "HR") redirect("/hr");
  if (role === "MANAGER") redirect("/manager");

  redirect("/employee");
}