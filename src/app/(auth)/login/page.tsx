"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { User, Lock, LogIn, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid username or password")
      } else {
        const session = await getSession()
        if (session?.user?.role === "ADMIN") {
          router.push("/admin")
        } else {
          router.push("/field-officer")
        }
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Animated Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-200/30 to-orange-300/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-200/30 to-green-300/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Login Container */}
      <div className="relative w-full max-w-md px-6 animate-fade-in">
        {/* Government Header */}
        <div className="text-center mb-8 space-y-4">
          {/* Emblem/Logo Placeholder */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-500 via-white to-green-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-scale-in">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-blue-900" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                  </svg>
                </div>
              </div>
              {/* Rotating Ring */}
              <div className="absolute inset-0 border-4 border-orange-400/30 rounded-full animate-spin-slow"></div>
            </div>
          </div>

          {/* Government Title */}
          <div className="space-y-2">
            <h1 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
              Government of Andhra Pradesh
            </h1>
            <h2 className="text-xs font-medium text-gray-600">
              Department of Health, Medical & Family Welfare
            </h2>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-orange-500 via-white to-green-600 rounded-full"></div>
          </div>

          {/* System Title */}
          <div className="mt-6">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-blue-700 to-green-600 bg-clip-text text-transparent">
              Chittoor District
            </h3>
            <p className="text-lg font-semibold text-gray-800 mt-1">
              Health Data Collection System
            </p>
          </div>
        </div>

        {/* Login Card with Glassmorphism */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl shadow-2xl border border-white/50 p-8 space-y-6 animate-slide-up">
          {/* Welcome Text */}
          <div className="text-center">
            <h4 className="text-xl font-bold text-gray-800">Welcome Back</h4>
            <p className="text-sm text-gray-600 mt-1">Sign in to access your dashboard</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/80 focus:bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm hover:bg-white/80 focus:bg-white text-gray-900 placeholder-gray-500"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-slide-down">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-orange-500 via-blue-600 to-green-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              Authorized personnel only. All activities are monitored and logged.
            </p>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-600">
            © 2025 Government of Andhra Pradesh. All rights reserved.
          </p>
        </div>
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.2s both;
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.6s ease-out 0.1s both;
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .delay-500 {
          animation-delay: 0.5s;
        }

        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  )
}
