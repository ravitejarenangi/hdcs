"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Loader2, AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ExportProgress {
  sessionId: string
  totalRecords: number
  processedRecords: number
  currentBatch: number
  totalBatches: number
  status: "initializing" | "processing" | "completed" | "error"
  message?: string
  startTime: number
  lastUpdateTime: number
}

interface ExportProgressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
  totalRecords: number
}

export function ExportProgressModal({
  open,
  onOpenChange,
  sessionId,
}: ExportProgressModalProps) {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !sessionId) {
      setProgress(null)
      setError(null)
      return
    }

    // Connect to SSE endpoint for progress updates
    const eventSource = new EventSource(`/api/admin/export/progress/${sessionId}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.error) {
          setError(data.error)
          eventSource.close()
          return
        }

        setProgress(data)

        // Close connection when export is completed or errored
        if (data.status === "completed" || data.status === "error") {
          setTimeout(() => {
            eventSource.close()
          }, 2000)
        }
      } catch (err) {
        console.error("Failed to parse progress data:", err)
      }
    }

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err)
      setError("Lost connection to progress updates")
      eventSource.close()
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [open, sessionId])

  // Calculate percentage
  const percentage = progress
    ? Math.round((progress.processedRecords / progress.totalRecords) * 100)
    : 0

  // Calculate elapsed time
  const elapsedTime = progress
    ? Math.floor((Date.now() - progress.startTime) / 1000)
    : 0

  // Estimate remaining time
  const estimatedRemainingTime = progress && progress.processedRecords > 0
    ? Math.floor(
        (elapsedTime / progress.processedRecords) *
          (progress.totalRecords - progress.processedRecords)
      )
    : 0

  // Format time in MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleClose = () => {
    // Allow closing at any time
    // The download will continue in the background
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress?.status === "completed" ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Export Complete
              </>
            ) : progress?.status === "error" || error ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                Export Failed
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                Exporting CSV
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {progress?.status === "completed"
              ? "Your CSV file has been downloaded successfully."
              : progress?.status === "error" || error
              ? "An error occurred during the export."
              : "Please wait while we export your data. This may take several minutes for large datasets."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Batch Information */}
          {progress && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Batch</span>
                <span className="font-medium">
                  {progress.currentBatch} of {progress.totalBatches}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Records</span>
                <span className="font-medium">
                  {progress.processedRecords.toLocaleString()} of{" "}
                  {progress.totalRecords.toLocaleString()}
                </span>
              </div>
              {progress.status === "processing" && estimatedRemainingTime > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Elapsed Time</span>
                    <span className="font-medium">{formatTime(elapsedTime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. Remaining</span>
                    <span className="font-medium">{formatTime(estimatedRemainingTime)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Status Message */}
          {progress?.message && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
          )}

          {/* Error Message */}
          {(error || progress?.status === "error") && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {error || progress?.message || "An unknown error occurred"}
              </p>
            </div>
          )}

          {/* Download Icon for Completed */}
          {progress?.status === "completed" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
              <Download className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Check your Downloads folder
              </span>
            </div>
          )}

          {/* Info for ongoing export */}
          {progress?.status === "processing" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-center text-sm text-blue-800">
                You can close this dialog. The download will continue in the background.
              </p>
            </div>
          )}

          {/* Close Button - Always available */}
          <Button onClick={handleClose} className="w-full" variant={progress?.status === "processing" ? "outline" : "default"}>
            {progress?.status === "processing" ? "Close (Download Continues)" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

