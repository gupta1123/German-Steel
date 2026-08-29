import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Global calendar styles for attendance hover/tooltip
import "@/components/custom-calendar.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "German Steels Sales",
    template: "%s | German Steels",
  },
  description: "German Steels field sales and customer operations dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <ThemeProvider
          defaultTheme="system"
        >
          <UnsavedChangesProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </UnsavedChangesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
