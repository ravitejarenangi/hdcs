"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User, MapPin, Calendar, Phone, CreditCard, Edit2 } from "lucide-react"
import { HouseholdMemberEditForm } from "@/components/forms/HouseholdMemberEditForm"

// Helper function to mask UID (show only last 4 digits)
function maskUID(uid: string | null): string {
  if (!uid) return "Not set"
  if (uid.length <= 4) return uid
  return "*".repeat(uid.length - 4) + uid.slice(-4)
}

// Helper function to format health ID
function formatHealthId(healthId: string | null): string {
  if (!healthId) return ""
  const digits = healthId.replace(/-/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
}

interface HouseholdMember {
  id: string
  residentId: string
  uid: string | null
  hhId: string
  name: string
  dob: Date | null
  gender: string | null
  citizenMobile: string | null
  healthId: string | null
  distName: string | null
  mandalName: string | null
  secName: string | null
  ruralUrban: string | null
  age: number | null
  phcName: string | null
}

interface HouseholdMemberCardProps {
  member: HouseholdMember
  isSelected: boolean
  isEditing: boolean
  isUpdating: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (residentId: string, data: { citizenMobile?: string | null; healthId?: string | null }) => Promise<void>
}

export function HouseholdMemberCard({
  member,
  isSelected,
  isEditing,
  isUpdating,
  onEdit,
  onCancelEdit,
  onUpdate,
}: HouseholdMemberCardProps) {
  const handleSave = async (data: { citizenMobile?: string | null; healthId?: string | null }) => {
    await onUpdate(member.residentId, data)
  }

  return (
    <Card
      className={`${
        isSelected
          ? "border-2 border-orange-500 bg-orange-50/50"
          : "border border-gray-200"
      } transition-all duration-200`}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-orange-600" />
            <span>{member.name}</span>
          </div>
          {isSelected && (
            <Badge variant="default" className="bg-orange-600">
              Searched
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Member Information - Always Visible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600 font-medium">UID</div>
            <div className="font-mono">{maskUID(member.uid)}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium">Age</div>
            <div>{member.age || "N/A"}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium">Gender</div>
            <div>{member.gender || "N/A"}</div>
          </div>
          <div>
            <div className="text-gray-600 font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Secretariat
            </div>
            <div>{member.secName || "N/A"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-gray-600 font-medium">PHC</div>
            <div>{member.phcName || "N/A"}</div>
          </div>
        </div>

        {/* Editable Fields or Display */}
        {isEditing ? (
          <div className="pt-3 border-t">
            <HouseholdMemberEditForm
              member={member}
              isUpdating={isUpdating}
              onSave={handleSave}
              onCancel={onCancelEdit}
            />
          </div>
        ) : (
          <>
            {/* Display Mobile and ABHA ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3 border-t">
              <div>
                <div className="text-gray-600 font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3 text-green-600" />
                  Mobile Number
                </div>
                <div className="font-medium">
                  {member.citizenMobile || <span className="text-gray-400">Not set</span>}
                </div>
              </div>
              <div>
                <div className="text-gray-600 font-medium flex items-center gap-1">
                  <CreditCard className="h-3 w-3 text-blue-600" />
                  ABHA ID
                </div>
                <div className="font-medium font-mono text-sm">
                  {member.healthId ? formatHealthId(member.healthId) : <span className="text-gray-400">Not set</span>}
                </div>
              </div>
            </div>

            {/* Edit Button */}
            <Button
              onClick={() => {
                console.log('🟠 Edit button clicked!')
                onEdit()
              }}
              className="w-full bg-orange-600 hover:bg-orange-700"
              style={{ touchAction: 'manipulation' }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

