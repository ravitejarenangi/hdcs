"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { Loader2, Copy, CheckCircle, Key } from "lucide-react"

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

export function ResetPasswordDialog({
  open,
  onOpenChange,
  officer,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [mode, setMode] = useState<"generate" | "custom">("generate")
  const [customPassword, setCustomPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMode("generate")
      setCustomPassword("")
      setConfirmPassword("")
      setNewPassword(null)
      setIsCopied(false)
      setErrors({})
    }
  }, [open])

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

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm password"
    } else if (customPassword !== confirmPassword) {
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

    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/admin/officers/${officer.id}/reset-password`,
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
      toast.error(error instanceof Error ? error.message : "Failed to reset password")
    } finally {
      setIsSubmitting(false)
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
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-600" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Reset password for <span className="font-semibold">{officer?.fullName}</span> (@
            {officer?.username})
          </DialogDescription>
        </DialogHeader>

        {!newPassword ? (
          <div className="space-y-4">
            {/* Mode Selection */}
            <RadioGroup value={mode} onValueChange={(value: "generate" | "custom") => setMode(value)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="generate" id="generate" />
                <Label htmlFor="generate" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Generate Random Password</p>
                    <p className="text-sm text-gray-500">
                      Automatically generate a secure password (Recommended)
                    </p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Set Custom Password</p>
                    <p className="text-sm text-gray-500">
                      Manually enter a new password
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Custom Password Fields */}
            {mode === "custom" && (
              <div className="space-y-4 pt-2">
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
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-orange-500 to-green-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">
                Password has been reset successfully!
              </p>
            </div>

            {/* New Password Display */}
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="flex gap-2">
                <Input
                  value={newPassword}
                  readOnly
                  className="font-mono bg-gray-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  className={isCopied ? "bg-green-50 border-green-300" : ""}
                >
                  {isCopied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Important: Save this password now!
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                This password will not be shown again. Make sure to copy it and share it
                securely with the field officer.
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={handleClose}
                className="bg-gradient-to-r from-orange-500 to-green-600"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

