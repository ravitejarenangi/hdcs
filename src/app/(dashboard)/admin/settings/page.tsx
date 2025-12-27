"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Save, Info, CheckCircle2, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DashboardLayout } from "@/components/layout/DashboardLayout"

export default function AdminSettingsPage() {
    const [date, setDate] = useState<Date | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [disableDialogOpen, setDisableDialogOpen] = useState(false)
    const [currentSetting, setCurrentSetting] = useState<{
        cutoffDate: string | null
        updatedAt: string | null
    } | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/admin/settings")
            if (response.ok) {
                const data = await response.json()
                setCurrentSetting(data)
                if (data.cutoffDate) {
                    setDate(new Date(data.cutoffDate))
                }
            } else {
                toast.error("Failed to load settings")
            }
        } catch (error) {
            toast.error("Network error")
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!date) {
            toast.error("Please select a date")
            return
        }

        setSaving(true)
        try {
            const response = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cutoffDate: date.toISOString() }),
            })

            if (response.ok) {
                toast.success("Settings updated successfully")
                await fetchSettings()
            } else {
                toast.error("Failed to save settings")
            }
        } catch (error) {
            toast.error("Network error")
        } finally {
            setSaving(false)
        }
    }

    const handleDisable = async () => {
        setSaving(true)
        try {
            const response = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cutoffDate: null }),
            })

            if (response.ok) {
                toast.success("Data locking disabled")
                setDate(undefined)
                await fetchSettings()
                setDisableDialogOpen(false)
            } else {
                toast.error("Failed to disable locking")
            }
        } catch (error) {
            toast.error("Network error")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <DashboardLayout requiredRole="ADMIN">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">
                            System Settings
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Manage application-wide configurations and data controls
                        </p>
                    </div>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-blue-600" />
                                Resident Data Locking
                            </CardTitle>
                            <CardDescription>
                                Configure the cutoff date to lock historical resident data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertTitle>How Locking Works</AlertTitle>
                                <AlertDescription className="mt-2 text-blue-700">
                                    Residents will be locked from editing if they meet <strong>ALL</strong> of the following criteria:
                                    <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                                        <li>Last updated <strong>before</strong> the selected date.</li>
                                        <li>Has a valid <strong>Mobile Number</strong> (and &le; 5 duplicates).</li>
                                        <li>Has a valid <strong>ABHA ID</strong> (and is unique).</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <div className="grid gap-2 max-w-sm">
                                <Label>Cutoff Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={setDate}
                                            initialFocus
                                            disabled={(date) => date > new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Set to <strong>today</strong> to lock all completed historical data immediately.
                                </p>
                            </div>

                            {currentSetting?.cutoffDate && (
                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-100">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Current Cutoff: <strong>{format(new Date(currentSetting.cutoffDate), "PPP")}</strong>
                                </div>
                            )}

                            <Separator />

                            <div className="flex justify-end gap-3">
                                {currentSetting?.cutoffDate && (
                                    <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                            >
                                                Disable Locking
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-md shadow-xl border-0 ring-1 ring-black/5">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2 text-red-600">
                                                    <AlertTriangle className="h-5 w-5" />
                                                    Disable Data Locking?
                                                </DialogTitle>
                                                <DialogDescription asChild className="pt-2">
                                                    <div className="text-sm text-muted-foreground">
                                                        Are you sure you want to disable data locking?
                                                        <br /><br />
                                                        This action will:
                                                        <ul className="list-disc list-inside mt-1 space-y-1 text-sm text-gray-600">
                                                            <li>Clear the current cutoff date ({date ? format(date, "PPP") : "set date"}).</li>
                                                            <li>Make <strong>all</strong> historical resident data editable again.</li>
                                                        </ul>
                                                    </div>
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter className="gap-2 sm:gap-0 mt-4">
                                                <Button variant="outline" onClick={() => setDisableDialogOpen(false)} disabled={saving}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleDisable}
                                                    disabled={saving}
                                                    className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                                                >
                                                    {saving ? "Disabling..." : "Yes, Disable Locking"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                                <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700">
                                    {saving ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Settings
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
