"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { Copy, Check } from "lucide-react"

interface Officer {
  id: string
  username: string
  fullName: string
}

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  officer: Officer | null
  onSuccess: () => void
}

export default function ResetPasswordDialog({
  open,
  onOpenChange,
  officer,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [mode, setMode] = useState<"generate" | "custom">("generate")
  const [customPassword, setCustomPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateCustomPassword = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!customPassword) {
      newErrors.customPassword = "Password is required"
    } else if (customPassword.length < 8) {
      newErrors.customPassword = "Password must be at least 8 characters"
    } else if (!/[A-Z]/.test(customPassword)) {
      newErrors.customPassword = "Password must contain at least one uppercase letter"
    } else if (!/[0-9]/.test(customPassword)) {
      newErrors.customPassword = "Password must contain at least one number"
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(customPassword)) {
      newErrors.customPassword = "Password must contain at least one special character"
    }

    if (customPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleResetPassword = async () => {
    if (!officer) return

    // Validate custom password if in custom mode
    if (mode === "custom" && !validateCustomPassword()) {
      return
    }

    try {
      setLoading(true)

      const response = await fetch(
        `/api/panchayat/officers/${officer.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generateRandom: mode === "generate",
            newPassword: mode === "custom" ? customPassword : undefined,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reset password")
      }

      const data = await response.json()
      setNewPassword(data.newPassword)
      toast.success("Password reset successfully")
      onSuccess()
    } catch (error) {
      console.error("Reset password error:", error)
      toast.error(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!newPassword) return

    try {
      await navigator.clipboard.writeText(newPassword)
      setIsCopied(true)
      toast.success("Password copied to clipboard")
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy password")
    }
  }

  const handleClose = () => {
    setMode("generate")
    setCustomPassword("")
    setConfirmPassword("")
    setNewPassword("")
    setErrors({})
    setIsCopied(false)
    onOpenChange(false)
  }

  if (!officer) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Officer Info */}
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">Officer</p>
            <p className="font-semibold">{officer.fullName}</p>
            <p className="text-sm text-gray-600">@{officer.username}</p>
          </div>

          {!newPassword ? (
            <>
              {/* Mode Selection */}
              <div className="space-y-3">
                <Label>Password Reset Mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as "generate" | "custom")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="generate" id="generate" />
                    <Label htmlFor="generate" className="cursor-pointer">
                      Generate Random Password
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="cursor-pointer">
                      Set Custom Password
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Custom Password Fields */}
              {mode === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="customPassword">
                      New Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customPassword"
                      type="password"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter new password"
                      className={errors.customPassword ? "border-red-500" : ""}
                    />
                    {errors.customPassword && (
                      <p className="text-sm text-red-500">{errors.customPassword}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Min 8 chars, 1 uppercase, 1 number, 1 special character
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={errors.confirmPassword ? "border-red-500" : ""}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-500 to-green-600 text-white"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* New Password Display */}
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-700 font-semibold mb-2">
                    Password reset successfully!
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newPassword}
                      readOnly
                      className="font-mono bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopyPassword}
                      className={isCopied ? "bg-green-100" : ""}
                    >
                      {isCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Important:</strong> Make sure to save this password. It will not be
                    shown again.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleClose} className="bg-gradient-to-r from-orange-500 to-green-600 text-white">
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

