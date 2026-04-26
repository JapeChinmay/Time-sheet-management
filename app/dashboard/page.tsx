"use client";

import { useEffect } from "react";

export default function DashboardRedirect() {
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role = payload.role?.toUpperCase();

      // 🔥 FIXED ROLE HANDLING
      if (role === "SUPERADMIN" || role === "ADMIN") {
        window.location.href = "/admin";
      } else if (role === "MANAGER") {
        window.location.href = "/manager";
      } else if (role === "HR") {
        window.location.href = "/hr";
      } else {
        window.location.href = "/employee";
      }

    } catch {
      window.location.href = "/login";
    }
  }, []);

  return null;
}