import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/Providers"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

// Viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
}

export const metadata: Metadata = {
  // Basic metadata
  title: {
    default: "Chittoor Health System - Dashboard & Resident Management",
    template: "%s | Chittoor Health System",
  },
  description:
    "Comprehensive health data management system for Chittoor district. Manage resident information, track health IDs, mobile numbers, and PHC assignments across mandals and secretariats. Streamline healthcare data collection and analytics.",
  applicationName: "Chittoor Health System",
  authors: [{ name: "Chittoor District Health Department" }],
  generator: "Next.js",
  keywords: [
    "Chittoor health system",
    "resident management",
    "health data management",
    "PHC management",
    "mandal health system",
    "secretariat health data",
    "health ID tracking",
    "mobile number verification",
    "healthcare analytics",
    "Chittoor district",
    "field officer dashboard",
    "mandal officer",
    "health data collection",
    "resident database",
    "household management",
  ],
  referrer: "origin-when-cross-origin",
  creator: "Chittoor District Health Department",
  publisher: "Chittoor District Health Department",

  // Robots and indexing
  robots: {
    index: false, // Set to false for internal/private systems
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },

  // Open Graph metadata for social sharing
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://chittoor-health-system.vercel.app",
    siteName: "Chittoor Health System",
    title: "Chittoor Health System - Dashboard & Resident Management",
    description:
      "Comprehensive health data management system for Chittoor district. Manage resident information, track health IDs, mobile numbers, and PHC assignments across mandals and secretariats.",
    images: [
      {
        url: "/og-image.png", // You can create this image later
        width: 1200,
        height: 630,
        alt: "Chittoor Health System Dashboard",
      },
    ],
  },

  // Twitter Card metadata
  twitter: {
    card: "summary_large_image",
    title: "Chittoor Health System - Dashboard & Resident Management",
    description:
      "Comprehensive health data management system for Chittoor district. Manage resident information and track health data across mandals and secretariats.",
    images: ["/twitter-image.png"], // You can create this image later
    creator: "@ChittoorHealth", // Update with actual Twitter handle if available
  },

  // Additional metadata
  category: "Healthcare Management",
  classification: "Healthcare Data Management System",

  // Verification tags (add your verification codes when available)
  // verification: {
  //   google: "your-google-verification-code",
  //   yandex: "your-yandex-verification-code",
  // },

  // App-specific metadata
  other: {
    "application-type": "Healthcare Management System",
    "target-audience": "Healthcare Workers, Administrators",
    "coverage": "Chittoor District, Andhra Pradesh, India",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
