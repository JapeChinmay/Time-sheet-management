"use client";

import { useEffect, useState } from "react";
import DashboardClient from "@/components/DashboardClient";

export default function EmployeeDashboard() {
  const [name, setName] = useState("User");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

  
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setName(payload.name || "User");
    } catch {
      setName("User");
    }
  }, []);

  return <DashboardClient name={name} />;
}