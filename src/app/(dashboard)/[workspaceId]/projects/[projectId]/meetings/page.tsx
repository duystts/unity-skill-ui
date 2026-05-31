'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import type { Meeting } from '@/types'

// ── Icons (Phosphor fill style) ───────────────────────────────────────────────
const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24ZM80,112a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,112Zm0,40a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H88A8,8,0,0,1,80,152Z"/>
  </svg>
)

const IconSpark = () => (
  <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor">
    <path d="M197.58,129.06l-51.61-19.85L126.12,57.8a12,12,0,0,0-22.5,0L83.61,109.21,32,129.06a12,12,0,0,0,0,22.5l51.61,19.85,20.08,52.63a12,12,0,0,0,22.5,0l20.08-52.63,51.61-19.85a12,12,0,0,0,0-22.5ZM170,140.65l-44,16.93a12,12,0,0,0-7,7l-16.93,44-16.93-44a12,12,0,0,0-7-7l-44-16.93,44-16.93a12,12,0,0,0,7-7l16.93-44,16.93,44a12,12,0,0,0,7,7ZM148,32a4,4,0,0,1,4-4h12V16a4,4,0,0,1,8,0V28h12a4,4,0,0,1,0,8H172V48a4,4,0,0,1-8,0V36H152A4,4,0,0,1,148,32ZM220,64a4,4,0,0,1,4-4h8V52a4,4,0,0,1,8,0v8h8a4,4,0,0,1,0,8h-8v8a4,4,0,0,1-8,0V72h-8A4,4,0,0,1,220,64Z"/>
  </svg>
)

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/>
  </svg>
)

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>
  </svg>
)

const IconSpinner = () => (
  <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" className="animate-spin">
    <path d="M232,128a104,104,0,0,1-208,0c0-41,23.81-78.36,60.66-95.27a8,8,0,0,1,6.68,14.54C60.15,61.59,40,93.27,40,128a88,88,0,0,0,176,0c0-34.73-20.15-66.41-51.34-80.73a8,8,0,0,1,6.68-14.54C208.19,49.64,232,87,232,128Z"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatScheduledAt(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseActionItems(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [raw] }
}

// ── Create modal ──────────────────────────────────────────────────────────────
function CreateMeetingModal({
  workspaceId,
  projectId,
  onClose,
}: {
  workspaceId: string
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle]             = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [meetingUrl, setMeetingUrl]   = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<{ data: Meeting }>(`/workspaces/${workspaceId}/meetings`, {
          title: title.trim(),
          projectId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          meetingUrl: meetingUrl.trim() || undefined,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all(workspaceId, projectId) })
      toast.success('Meeting scheduled')
      onClose()
    },
    onError: () => toast.error('Failed to schedule meeting'),
  })

  const valid = title.trim().length > 0 && scheduledAt !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cobalt-50 flex items-center justify-center text-cobalt-600">
            <IconCalendar />
          </div>
          <h2 className="text-base font-bold text-gray-900">Schedule Meeting</h2>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint 3 Planning"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Meeting Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/xxx  or  zoom.us/j/..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
            <p className="text-[11px] text-gray-400 mt-1">Google Meet, Zoom, Teams, … paste bất kỳ link nào</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!valid || createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-cobalt-600 rounded-xl hover:bg-cobalt-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditMeetingModal({
  meeting,
  workspaceId,
  projectId,
  onClose,
}: {
  meeting: Meeting
  workspaceId: string
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle]             = useState(meeting.title)
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeValue(meeting.scheduledAt))
  const [meetingUrl, setMeetingUrl]   = useState(meeting.meetingUrl ?? '')

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/workspaces/${workspaceId}/meetings/${meeting.id}`, {
        title:       title.trim() !== meeting.title ? title.trim() : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        meetingUrl:  meetingUrl.trim() !== (meeting.meetingUrl ?? '') ? meetingUrl.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all(workspaceId, projectId) })
      toast.success('Meeting updated')
      onClose()
    },
    onError: () => toast.error('Failed to update meeting'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-base font-bold text-gray-900">Edit Meeting</h2>
          <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date & Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Meeting Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/xxx  or  zoom.us/j/..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cobalt-100 focus:border-cobalt-300 transition"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!title.trim() || updateMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-cobalt-600 rounded-xl hover:bg-cobalt-700 transition disabled:opacity-40"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Meeting card ──────────────────────────────────────────────────────────────
function MeetingCard({
  meeting,
  workspaceId,
  projectId,
}: {
  meeting: Meeting
  workspaceId: string
  projectId: string
}) {
  const queryClient   = useQueryClient()
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded]       = useState(false)
  const [editing, setEditing]         = useState(false)
  const [uploading, setUploading]     = useState(false)

  const { date, time } = formatScheduledAt(meeting.scheduledAt)
  const actionItems    = parseActionItems(meeting.actionItems)
  const isPast         = new Date(meeting.scheduledAt) < new Date()
  const isCompleted    = meeting.status === 'COMPLETED'
  const agendaGenerating      = meeting.agendaStatus === 'GENERATING'
  const transcriptProcessing  = meeting.transcriptStatus === 'PROCESSING' || meeting.transcriptStatus === 'UPLOADED'
  const transcriptDone        = meeting.transcriptStatus === 'PROCESSED'
  const transcriptFailed      = meeting.transcriptStatus === 'FAILED'

  const joinUrl = meeting.meetingUrl || null

  // Generate agenda
  const generateAgendaMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/workspaces/${workspaceId}/meetings/${meeting.id}/agenda/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all(workspaceId, projectId) })
      toast.success('Agenda generation started')
    },
    onError: () => toast.error('Failed to generate agenda'),
  })

  // Upload transcript
  const handleUploadTranscript = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await apiClient.post(
        `/workspaces/${workspaceId}/meetings/${meeting.id}/transcript`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all(workspaceId, projectId) })
      toast.success('Transcript uploaded — AI is processing…')
    } catch {
      toast.error('Failed to upload transcript')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      {editing && (
        <EditMeetingModal
          meeting={meeting}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setEditing(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.vtt,.srt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUploadTranscript(file)
        }}
      />

      <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
        isCompleted ? 'border-emerald-200' : isPast ? 'border-amber-200' : 'border-gray-200'
      }`}>
        {/* ── Card header (clickable to expand) ── */}
        <button
          className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-gray-50/50 transition"
          onClick={() => setExpanded((v) => !v)}
        >
          {/* Status icon */}
          <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isCompleted ? 'bg-emerald-50 text-emerald-600' :
            isPast      ? 'bg-amber-50 text-amber-500'     :
                          'bg-cobalt-50 text-cobalt-600'
          }`}>
            {isCompleted ? <IconCheck /> : <IconClock />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 truncate">{meeting.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                isCompleted ? 'bg-emerald-100 text-emerald-700' :
                isPast      ? 'bg-amber-100 text-amber-700'     :
                              'bg-cobalt-100 text-cobalt-700'
              }`}>
                {isCompleted ? 'Completed' : isPast ? 'Past' : 'Scheduled'}
              </span>
              {meeting.agenda && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-700">
                  Agenda ready
                </span>
              )}
              {transcriptProcessing && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700 flex items-center gap-1">
                  <IconSpinner /> Processing…
                </span>
              )}
              {transcriptDone && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                  Report ready
                </span>
              )}
              {transcriptFailed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                  Report failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
              <IconCalendar />
              <span>{date}</span>
              <span className="text-gray-200">·</span>
              <IconClock />
              <span>{time}</span>
            </div>
          </div>

          {/* Chevron */}
          <svg
            width="14" height="14" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
            className={`shrink-0 mt-2 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* ── Expanded body ── */}
        {expanded && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-5">

            {/* ── Action buttons ── */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Join Meeting */}
              {joinUrl ? (
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M242.26,72.73a16,16,0,0,0-16.65.89L192,96V80a24,24,0,0,0-24-24H40A24,24,0,0,0,16,80V176a24,24,0,0,0,24,24H168a24,24,0,0,0,24-24V160l33.61,22.38A16,16,0,0,0,248,169.13V86.87A16,16,0,0,0,242.26,72.73ZM176,176a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8Zm64-6.87L208,148.42V107.58L240,86.87Z"/>
                  </svg>
                  Join Meeting
                </a>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 border border-dashed border-gray-200 px-3.5 py-1.5 rounded-lg hover:border-gray-300 hover:text-gray-600 transition"
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add meeting link
                </button>
              )}

              {/* Edit */}
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>

              {/* Generate Agenda */}
              {!meeting.agenda && (
                <button
                  onClick={() => generateAgendaMutation.mutate()}
                  disabled={agendaGenerating || generateAgendaMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium text-violet-700 border border-violet-200 bg-violet-50 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition disabled:opacity-50"
                >
                  {agendaGenerating ? <IconSpinner /> : <IconSpark />}
                  {agendaGenerating ? 'Generating…' : 'Generate Agenda (AI)'}
                </button>
              )}

              {/* Upload Transcript */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || transcriptProcessing}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-700 border border-sky-200 bg-sky-50 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition disabled:opacity-50"
              >
                {uploading || transcriptProcessing ? <IconSpinner /> : (
                  <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1-11.32,11.32L136,139.31V184a8,8,0,0,1-16,0V139.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0Z"/>
                  </svg>
                )}
                {uploading ? 'Uploading…' : transcriptProcessing ? 'Processing…' : 'Upload Transcript'}
              </button>
            </div>

            {/* ── Meeting link display ── */}
            {joinUrl && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" className="text-emerald-600 shrink-0">
                  <path d="M242.26,72.73a16,16,0,0,0-16.65.89L192,96V80a24,24,0,0,0-24-24H40A24,24,0,0,0,16,80V176a24,24,0,0,0,24,24H168a24,24,0,0,0,24-24V160l33.61,22.38A16,16,0,0,0,248,169.13V86.87A16,16,0,0,0,242.26,72.73Z"/>
                </svg>
                <p className="text-[11px] text-emerald-700 truncate flex-1 font-medium">{joinUrl}</p>
              </div>
            )}

            {/* ── Transcript upload guide ── */}
            {!meeting.transcriptStatus && (
              <div className="flex items-start gap-2.5 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" className="text-sky-500 mt-0.5 shrink-0">
                  <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a16,16,0,1,1,16,16A16,16,0,0,1,112,84Z"/>
                </svg>
                <p className="text-[11px] text-sky-700 leading-relaxed">
                  After the meeting, export the transcript from Jitsi/Zoom/Meet and upload it here.
                  AI will auto-generate a summary and action items. Accepts <strong>.txt .md .vtt .srt</strong>
                </p>
              </div>
            )}

            {/* ── Agenda ── */}
            {meeting.agenda ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <IconSpark /> AI-Generated Agenda
                </p>
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{meeting.agenda}</pre>
                </div>
              </div>
            ) : agendaGenerating ? (
              <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                <IconSpinner /> AI is generating the agenda…
              </div>
            ) : null}

            {/* ── Transcript processing ── */}
            {transcriptProcessing && (
              <div className="flex items-center gap-2 text-xs text-sky-600 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                <IconSpinner /> AI is analysing the transcript and writing the report…
              </div>
            )}

            {/* ── Summary ── */}
            {meeting.summary && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meeting Summary</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
                </div>
              </div>
            )}

            {/* ── Action items ── */}
            {actionItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action Items</p>
                <ul className="space-y-1.5">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-cobalt-100 text-cobalt-600 flex items-center justify-center shrink-0 font-bold text-[9px]">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>()
  const { workspaceId, projectId } = params
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter]         = useState<'all' | 'upcoming' | 'past'>('all')

  const { data: allMeetings = [], isLoading } = useQuery({
    queryKey: queryKeys.meetings.all(workspaceId, projectId),
    queryFn:  () =>
      apiClient
        .get<{ data: Meeting[] }>(`/workspaces/${workspaceId}/meetings`)
        .then((r) => r.data.data.filter((m) => m.projectId === projectId)),
    // Auto-refetch while any transcript is processing (TanStack Query v5: receives Query object)
    refetchInterval: (query: any) => {
      const data = (query.state?.data ?? []) as Meeting[]
      return data.some(
        (m) => m.transcriptStatus === 'PROCESSING' || m.transcriptStatus === 'UPLOADED' || m.agendaStatus === 'GENERATING'
      ) ? 4000 : false
    },
  })

  const now = new Date()
  const meetings = allMeetings
    .filter((m) => {
      if (filter === 'upcoming') return new Date(m.scheduledAt) >= now
      if (filter === 'past')     return new Date(m.scheduledAt) < now
      return true
    })
    .sort((a, b) => {
      // upcoming first (asc), then past (desc)
      const aUp = new Date(a.scheduledAt) >= now
      const bUp = new Date(b.scheduledAt) >= now
      if (aUp && !bUp) return -1
      if (!aUp && bUp) return 1
      if (aUp) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    })

  const upcomingCount = allMeetings.filter((m) => new Date(m.scheduledAt) >= now).length
  const pastCount     = allMeetings.filter((m) => new Date(m.scheduledAt) < now).length

  return (
    <>
      {showCreate && (
        <CreateMeetingModal
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div className="flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Topbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push(`/${workspaceId}/projects/${projectId}`)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="w-7 h-7 rounded-xl bg-cobalt-50 flex items-center justify-center text-cobalt-600 shrink-0">
            <IconCalendar />
          </div>

          <h1 className="text-sm font-bold text-gray-900 flex-1">Meetings</h1>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cobalt-600 rounded-lg hover:bg-cobalt-700 transition"
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Schedule
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0 bg-white shrink-0 border-b border-gray-100">
          {([
            { key: 'all',      label: 'All',      count: allMeetings.length },
            { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { key: 'past',     label: 'Past',     count: pastCount },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
                filter === key
                  ? 'border-cobalt-600 text-cobalt-700 bg-white'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === key ? 'bg-cobalt-100 text-cobalt-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-cobalt-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-cobalt-50 flex items-center justify-center text-cobalt-300">
                <IconCalendar />
              </div>
              <p className="text-sm text-gray-400 font-medium">
                {filter === 'upcoming' ? 'No upcoming meetings' :
                 filter === 'past'     ? 'No past meetings' :
                                         'No meetings yet'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-xs text-cobalt-600 hover:text-cobalt-700 font-medium hover:underline"
                >
                  + Schedule your first meeting
                </button>
              )}
            </div>
          ) : (
            meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                workspaceId={workspaceId}
                projectId={projectId}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}
