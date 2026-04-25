"use client";

import "./globals.css";
import { SessionProvider } from "next-auth/react";
import React from "react"; // Import React to use ReactNode
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});


export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en" className={inter.variable} >
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}