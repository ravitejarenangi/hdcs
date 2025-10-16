"use client"

import React, { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getRoleDisplayName } from "@/lib/roles"
import {
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  Save,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface ProfileData {
  id: string
  username: string
  fullName: string
  mobileNumber: string | null
  role: string
  mandalName: string | null
  assignedSecretariats: string | null
  isActive: boolean
  createdAt: string
  lastLogin: string | null
}

interface PasswordStrength {
  score: number
  message: string
  color: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [fullName, setFullName] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Fetch profile data
  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/settings/profile")
      
      if (!response.ok) {
        throw new Error("Failed to fetch profile")
      }

      const data = await response.json()
      setProfileData(data)
      setFullName(data.fullName)
      setMobileNumber(data.mobileNumber || "")
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast.error("Failed to load profile data")
    } finally {
      setLoading(false)
    }
  }

  // Password strength checker
  const checkPasswordStrength = (password: string): PasswordStrength => {
    if (password.length === 0) {
      return { score: 0, message: "", color: "bg-gray-200" }
    }

    let score = 0
    
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score <= 2) {
      return { score, message: "Weak", color: "bg-red-500" }
    } else if (score <= 4) {
      return { score, message: "Medium", color: "bg-yellow-500" }
    } else {
      return { score, message: "Strong", color: "bg-green-500" }
    }
  }

  const passwordStrength = checkPasswordStrength(newPassword)

  // Validate mobile number
  const validateMobileNumber = (mobile: string): boolean => {
    if (!mobile) return true // Optional field
    const mobileRegex = /^[6-9][0-9]{9}$/
    return mobileRegex.test(mobile)
  }

  // Validate password requirements
  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push("At least 8 characters")
    }
    if (!/[a-z]/.test(password)) {
      errors.push("One lowercase letter")
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("One uppercase letter")
    }
    if (!/[0-9]/.test(password)) {
      errors.push("One number")
    }

    return { valid: errors.length === 0, errors }
  }

  // Handle profile update
  const handleProfileUpdate = async () => {
    // Validate mobile number
    if (mobileNumber && !validateMobileNumber(mobileNumber)) {
      toast.error("Invalid mobile number. Must be 10 digits starting with 6-9")
      return
    }

    try {
      setSavingProfile(true)

      const response = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          mobileNumber: mobileNumber || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update profile")
      }

      const updatedData = await response.json()
      setProfileData(updatedData)
      setIsEditingProfile(false)
      toast.success("Profile updated successfully!")
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle password change
  const handlePasswordChange = async () => {
    // Validate current password
    if (!currentPassword) {
      toast.error("Current password is required")
      return
    }

    // Validate new password
    const { valid, errors } = validatePassword(newPassword)
    if (!valid) {
      toast.error(`Password requirements not met: ${errors.join(", ")}`)
      return
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match")
      return
    }

    try {
      setSavingPassword(true)

      const response = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to change password")
      }

      // Reset form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setIsChangingPassword(false)
      toast.success("Password changed successfully!")
    } catch (error) {
      console.error("Error changing password:", error)
      toast.error(error instanceof Error ? error.message : "Failed to change password")
    } finally {
      setSavingPassword(false)
    }
  }

  // Cancel profile edit
  const handleCancelProfileEdit = () => {
    setFullName(profileData?.fullName || "")
    setMobileNumber(profileData?.mobileNumber || "")
    setIsEditingProfile(false)
  }

  // Cancel password change
  const handleCancelPasswordChange = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setIsChangingPassword(false)
  }

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }

  // Parse assigned secretariats
  const getAssignedSecretariats = () => {
    if (!profileData?.assignedSecretariats) return []
    try {
      return JSON.parse(profileData.assignedSecretariats)
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!profileData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load profile data</p>
            <Button onClick={fetchProfile} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-green-600 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Account Information (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your account details and role information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <Label className="text-gray-600 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </Label>
                <p className="mt-1 font-medium">{profileData.username}</p>
              </div>

              {/* Role */}
              <div>
                <Label className="text-gray-600 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role
                </Label>
                <div className="mt-1">
                  <Badge
                    variant="default"
                    className="bg-gradient-to-r from-orange-500 to-green-600"
                  >
                    {getRoleDisplayName(profileData.role as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER")}
                  </Badge>
                </div>
              </div>

              {/* Mandal Name (if applicable) */}
              {profileData.mandalName && (
                <div>
                  <Label className="text-gray-600 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Mandal
                  </Label>
                  <p className="mt-1 font-medium">{profileData.mandalName}</p>
                </div>
              )}

              {/* Account Status */}
              <div>
                <Label className="text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge variant={profileData.isActive ? "default" : "outline"}>
                    {profileData.isActive ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </Badge>
                </div>
              </div>

              {/* Created At */}
              <div>
                <Label className="text-gray-600 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Created
                </Label>
                <p className="mt-1 text-sm">{formatDate(profileData.createdAt)}</p>
              </div>

              {/* Last Login */}
              <div>
                <Label className="text-gray-600 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last Login
                </Label>
                <p className="mt-1 text-sm">{formatDate(profileData.lastLogin)}</p>
              </div>
            </div>

            {/* Assigned Secretariats (for Field Officers) */}
            {profileData.role === "FIELD_OFFICER" && getAssignedSecretariats().length > 0 && (
              <div className="pt-4 border-t">
                <Label className="text-gray-600 mb-2 block">Assigned Secretariats</Label>
                <div className="flex flex-wrap gap-2">
                  {getAssignedSecretariats().map((sec: { mandalName: string; secName: string }, index: number) => (
                    <Badge key={index} variant="outline">
                      {sec.mandalName} - {sec.secName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Settings (Editable) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-500" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isEditingProfile}
                className="mt-1"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input
                id="mobileNumber"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                disabled={!isEditingProfile}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="mt-1"
              />
              {mobileNumber && !validateMobileNumber(mobileNumber) && (
                <p className="text-sm text-red-500 mt-1">
                  Invalid mobile number (must be 10 digits starting with 6-9)
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {!isEditingProfile ? (
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700"
                >
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleProfileUpdate}
                    disabled={savingProfile || !fullName}
                    className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancelProfileEdit}
                    variant="outline"
                    disabled={savingProfile}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-500" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isChangingPassword ? (
              <Button
                onClick={() => setIsChangingPassword(true)}
                variant="outline"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            ) : (
              <>
                {/* Current Password */}
                <div>
                  <Label htmlFor="currentPassword">Current Password *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword">New Password *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${passwordStrength.color} transition-all`}
                            style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{passwordStrength.message}</span>
                      </div>
                    </div>
                  )}

                  {/* Password Requirements */}
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <p className="font-medium">Password must contain:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li className={newPassword.length >= 8 ? "text-green-600" : ""}>
                        At least 8 characters
                      </li>
                      <li className={/[a-z]/.test(newPassword) ? "text-green-600" : ""}>
                        One lowercase letter
                      </li>
                      <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>
                        One uppercase letter
                      </li>
                      <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>
                        One number
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handlePasswordChange}
                    disabled={
                      savingPassword ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      newPassword !== confirmPassword ||
                      !validatePassword(newPassword).valid
                    }
                    className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700"
                  >
                    {savingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancelPasswordChange}
                    variant="outline"
                    disabled={savingPassword}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

