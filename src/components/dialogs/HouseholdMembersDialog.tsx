"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Home, Loader2 } from "lucide-react"
import { HouseholdMemberCard } from "@/components/cards/HouseholdMemberCard"
import { useIsMobile } from "@/hooks/use-media-query"

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

interface HouseholdMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedResident: {
    hhId: string
    name: string
  } | null
  householdMembers: HouseholdMember[]
  isLoading: boolean
  editingResidentId: string | null
  updatingResidentId: string | null
  onEdit: (residentId: string) => void
  onCancelEdit: () => void
  onUpdate: (residentId: string, data: { citizenMobile?: string | null; healthId?: string | null }) => Promise<void>
}

export function HouseholdMembersDialog({
  open,
  onOpenChange,
  selectedResident,
  householdMembers,
  isLoading,
  editingResidentId,
  updatingResidentId,
  onEdit,
  onCancelEdit,
  onUpdate,
}: HouseholdMembersDialogProps) {
  const isMobile = useIsMobile()

  const content = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {householdMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No household members found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {householdMembers.map((member) => (
                <HouseholdMemberCard
                  key={member.residentId}
                  member={member}
                  isSelected={false}
                  isEditing={editingResidentId === member.residentId}
                  isUpdating={updatingResidentId === member.residentId}
                  onEdit={() => onEdit(member.residentId)}
                  onCancelEdit={onCancelEdit}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  // Mobile: Use Sheet (bottom drawer)
  if (isMobile) {
    console.log('🔵 Rendering Sheet for mobile - UPDATED VERSION 3.0 - UID SEARCH FIX')
    return (
      <Sheet open={open} onOpenChange={onOpenChange} modal={true}>
        <SheetContent
          side="bottom"
          className="h-[90vh] p-0 flex flex-col"
        >
          {/* Header Section - Sticky */}
          <div className="flex-shrink-0 p-4 border-b bg-white">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-left">
                <Home className="h-5 w-5 text-orange-600 flex-shrink-0" />
                Household Information
              </SheetTitle>
            </SheetHeader>

            {/* Household Info Cards */}
            {selectedResident && (
              <div className="space-y-3">
                {/* Household ID Card */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="text-gray-500 text-xs font-medium mb-1.5">Household ID</div>
                  <div className="font-mono text-sm break-all text-gray-900 leading-relaxed">
                    {selectedResident.hhId}
                  </div>
                </div>

                {/* Total Members Card - Orange Highlighted */}
                <div className="bg-orange-50 p-3 rounded-lg border-2 border-orange-400">
                  <div className="text-orange-700 text-xs font-medium mb-1.5">Total Members</div>
                  <div className="font-bold text-2xl text-orange-600">
                    {householdMembers.length}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Use Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-orange-600" />
            Household Information
          </DialogTitle>
          {selectedResident && (
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <div><strong>Household ID:</strong> {selectedResident.hhId}</div>
              <div><strong>Total Members:</strong> {householdMembers.length}</div>
            </div>
          )}
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}

