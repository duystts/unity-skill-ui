'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiClient } from '@/lib/apiClient'
import { queryKeys } from '@/lib/queryKeys'
import type { WorkflowStage, AutoTriggerRule, Project } from '@/types'
import axios from 'axios'

// ── Stage templates ────────────────────────────────────────────────────────────
type TemplateStage = { name: string; isClosedState: boolean }

interface StageTemplate {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  stages: TemplateStage[]
}

// Phosphor-style SVG icons (24px viewBox, stroke-based)
const IconSquaresFour = () => (
  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,16V120H136V48Zm-88,72H48V48h72ZM48,208V136h72v72Zm88,0V136h72v72Z"/>
  </svg>
)

const IconArrowsClockwise = () => (
  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16h28.69L195.88,79.19a96,96,0,1,0,2.54,136.86,8,8,0,1,1,11.42,11.2A112,112,0,1,1,212.37,60.37L228,76V56a8,8,0,1,1,16,0Z"/>
  </svg>
)

const IconGitBranch = () => (
  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M240,64a32,32,0,1,0-40,31v17a8,8,0,0,1-8,8H96a24,24,0,0,0-24,24V128a32,32,0,1,0,16,0V144a8,8,0,0,1,8,8h96a24,24,0,0,0,24-24V95A32,32,0,0,0,240,64ZM64,192a16,16,0,1,1-16-16A16,16,0,0,1,64,192ZM208,80a16,16,0,1,1,16-16A16,16,0,0,1,208,80Zm-96,0a32,32,0,1,0-32,32A32,32,0,0,0,112,80ZM80,80a16,16,0,1,1,16,16A16,16,0,0,1,80,80Z"/>
  </svg>
)

const IconBug = () => (
  <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M224,112h-28.43A68,68,0,0,0,196,96l19.31-19.31a12,12,0,0,0-16.97-16.97L179,79.06A67.6,67.6,0,0,0,156,68.43V40a12,12,0,0,0-24,0V68.43A67.6,67.6,0,0,0,109,79.06L89.66,59.72A12,12,0,0,0,72.69,76.69L92,96a68,68,0,0,0,.43,16H64A12,12,0,0,0,64,136H92.67A68.15,68.15,0,0,0,108,158.6V176H96a12,12,0,0,0,0,24h12v8a12,12,0,0,0,24,0v-8h12a12,12,0,0,0,0-24H132V158.6A68.15,68.15,0,0,0,147.33,136H176a12,12,0,0,0,0-24Z"/>
  </svg>
)

const STAGE_TEMPLATES: StageTemplate[] = [
  {
    id: 'basic',
    label: 'Basic',
    description: 'Simple 3-column board for small teams',
    icon: <IconSquaresFour />,
    color: 'indigo',
    stages: [
      { name: 'To Do',       isClosedState: false },
      { name: 'In Progress', isClosedState: false },
      { name: 'Done',        isClosedState: true  },
    ],
  },
  {
    id: 'scrum',
    label: 'Scrum',
    description: 'Sprint-style with backlog and review',
    icon: <IconArrowsClockwise />,
    color: 'violet',
    stages: [
      { name: 'Backlog',     isClosedState: false },
      { name: 'To Do',       isClosedState: false },
      { name: 'In Progress', isClosedState: false },
      { name: 'In Review',   isClosedState: false },
      { name: 'Done',        isClosedState: true  },
    ],
  },
  {
    id: 'devflow',
    label: 'Dev Workflow',
    description: 'Full software dev cycle with testing',
    icon: <IconGitBranch />,
    color: 'emerald',
    stages: [
      { name: 'Backlog',      isClosedState: false },
      { name: 'To Do',        isClosedState: false },
      { name: 'In Progress',  isClosedState: false },
      { name: 'Code Review',  isClosedState: false },
      { name: 'Testing',      isClosedState: false },
      { name: 'Done',         isClosedState: true  },
    ],
  },
  {
    id: 'bugtrack',
    label: 'Bug Tracker',
    description: 'Focused on triage and verification',
    icon: <IconBug />,
    color: 'rose',
    stages: [
      { name: 'New',          isClosedState: false },
      { name: 'Triaged',      isClosedState: false },
      { name: 'In Progress',  isClosedState: false },
      { name: 'Verify Fix',   isClosedState: false },
      { name: 'Closed',       isClosedState: true  },
    ],
  },
]

const COLOR_MAP: Record<string, { card: string; badge: string; btn: string }> = {
  indigo:  { card: 'border-indigo-200 bg-indigo-50/60',  badge: 'bg-indigo-100 text-indigo-700',  btn: 'bg-indigo-600 hover:bg-indigo-700' },
  violet:  { card: 'border-violet-200 bg-violet-50/60',  badge: 'bg-violet-100 text-violet-700',  btn: 'bg-violet-600 hover:bg-violet-700' },
  emerald: { card: 'border-emerald-200 bg-emerald-50/60', badge: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  rose:    { card: 'border-rose-200 bg-rose-50/60',      badge: 'bg-rose-100 text-rose-700',      btn: 'bg-rose-600 hover:bg-rose-700' },
}

const stageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  position: z.coerce.number().int().min(0, 'Position must be a non-negative integer'),
  isClosedState: z.boolean(),
})

type StageForm = z.infer<typeof stageSchema>

const TRIGGER_LABELS: Record<string, string> = {
  PR_OPENED: 'PR Opened',
  PR_MERGED: 'PR Merged',
  PR_CLOSED: 'PR Closed',
  PR_REVIEWED: 'PR Reviewed',
}

const TRIGGER_TYPES = ['PR_OPENED', 'PR_MERGED', 'PR_CLOSED', 'PR_REVIEWED'] as const

export default function ProjectSettingsPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>()
  const { workspaceId, projectId } = params
  const router = useRouter()
  const queryClient = useQueryClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [connectingGithub, setConnectingGithub] = useState(false)

  // --- Project detail query ---
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: Project }>(`/workspaces/${workspaceId}/projects/${projectId}`)
        .then(r => r.data.data),
  })

  // --- GitHub Connection ---
  const { data: githubConn, refetch: refetchGithub } = useQuery({
    queryKey: ['github', workspaceId, projectId],
    queryFn: () =>
      apiClient
        .get<{ data: { connected: boolean; repoFullName: string | null } }>(
          `/workspaces/${workspaceId}/projects/${projectId}/github`
        )
        .then(r => r.data.data),
    retry: false,
  })

  const connectGithub = async () => {
    setConnectingGithub(true)
    try {
      const res = await apiClient.get<{ data: { authUrl: string } }>(
        `/auth/github?projectId=${projectId}&workspaceId=${workspaceId}`
      )
      window.location.href = res.data.data.authUrl
    } catch {
      toast.error('Failed to initiate GitHub connection')
      setConnectingGithub(false)
    }
  }

  const webhookMutation = useMutation({
    mutationFn: (repoFullName: string) =>
      apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/github/webhook`, { repoFullName }),
    onSuccess: () => {
      refetchGithub()
      setRepoInput('')
      toast.success('Webhook activated — trigger rules are now live!')
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Failed to register webhook')
        : 'Failed to register webhook'
      toast.error(msg)
    },
  })

  // --- Archive / Unarchive ---
  const archiveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/workspaces/${workspaceId}/projects/${projectId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(workspaceId, projectId) })
      toast.success('Project archived')
      router.push(`/${workspaceId}/projects`)
    },
    onError: () => toast.error('Failed to archive project'),
  })

  const unarchiveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/workspaces/${workspaceId}/projects/${projectId}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.archived(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(workspaceId, projectId) })
      toast.success('Project restored')
      setConfirmArchive(false)
    },
    onError: () => toast.error('Failed to restore project'),
  })

  // --- Stages query ---
  const { data: stages = [], isLoading } = useQuery({
    queryKey: queryKeys.projects.stages(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: WorkflowStage[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/stages`
        )
        .then(r => r.data.data),
  })

  // --- Triggers query ---
  const { data: rules = [] } = useQuery({
    queryKey: queryKeys.projects.triggers(workspaceId, projectId),
    queryFn: () =>
      apiClient
        .get<{ data: AutoTriggerRule[] }>(
          `/workspaces/${workspaceId}/projects/${projectId}/triggers`
        )
        .then(r => r.data.data),
  })

  const invalidateStages = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.stages(workspaceId, projectId) })

  const invalidateTriggers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.triggers(workspaceId, projectId) })

  // --- Stage Create ---
  const {
    register: registerCreate,
    handleSubmit: handleCreate,
    reset: resetCreate,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<StageForm>({
    resolver: zodResolver(stageSchema),
    defaultValues: { isClosedState: false, position: stages.length },
  })

  const createMutation = useMutation({
    mutationFn: (data: StageForm) =>
      apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/stages`, data),
    onSuccess: () => {
      invalidateStages()
      resetCreate()
      toast.success('Stage created')
    },
    onError: () => toast.error('Failed to create stage'),
  })

  // --- Stage Update ---
  const {
    register: registerEdit,
    handleSubmit: handleEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isUpdating },
  } = useForm<StageForm>({ resolver: zodResolver(stageSchema) })

  const updateMutation = useMutation({
    mutationFn: ({ stageId, data }: { stageId: string; data: StageForm }) =>
      apiClient.put(`/workspaces/${workspaceId}/projects/${projectId}/stages/${stageId}`, data),
    onSuccess: () => {
      invalidateStages()
      setEditingId(null)
      toast.success('Stage updated')
    },
    onError: () => toast.error('Failed to update stage'),
  })

  // --- Stage Delete ---
  const deleteMutation = useMutation({
    mutationFn: (stageId: string) =>
      apiClient.delete(`/workspaces/${workspaceId}/projects/${projectId}/stages/${stageId}`),
    onSuccess: () => {
      invalidateStages()
      setConfirmDeleteId(null)
      toast.success('Stage deleted')
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error === 'STAGE_HAS_ACTIVE_TICKETS') {
        toast.error('Stage has active tickets — reassign first')
      } else {
        toast.error('Failed to delete stage')
      }
      setConfirmDeleteId(null)
    },
  })

  // --- Trigger Create ---
  const [newRule, setNewRule] = useState({
    sourceStageId: '',
    triggerType: 'PR_OPENED',
    targetStageId: '',
  })

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof newRule) =>
      apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/stages/${data.sourceStageId}/triggers`,
        { triggerType: data.triggerType, targetStageId: data.targetStageId }
      ),
    onSuccess: () => {
      invalidateTriggers()
      setNewRule({ sourceStageId: '', triggerType: 'PR_OPENED', targetStageId: '' })
      toast.success('Trigger rule added')
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error === 'INVALID_TRIGGER') {
        toast.error('Trigger references a stage in a different project')
      } else {
        toast.error('Failed to add trigger rule')
      }
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      apiClient.delete(`/workspaces/${workspaceId}/projects/${projectId}/triggers/${ruleId}`),
    onSuccess: () => {
      invalidateTriggers()
      toast.success('Trigger rule deleted')
    },
    onError: () => toast.error('Failed to delete trigger rule'),
  })

  const applyTemplate = async (template: StageTemplate) => {
    setApplyingTemplate(template.id)
    try {
      await Promise.all(
        template.stages.map((s, idx) =>
          apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/stages`, {
            name: s.name,
            position: idx,
            isClosedState: s.isClosedState,
          })
        )
      )
      invalidateStages()
      setShowTemplates(false)
      toast.success(`"${template.label}" template applied — ${template.stages.length} stages created`)
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setApplyingTemplate(null)
    }
  }

  const stageName = (id: string | null) =>
    id ? (stages.find(s => s.id === id)?.name ?? id.slice(0, 8)) : '(any stage)'

  const startEdit = (stage: WorkflowStage) => {
    setEditingId(stage.id)
    resetEdit({ name: stage.name, position: stage.position, isClosedState: stage.isClosedState })
  }

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRule.sourceStageId || !newRule.targetStageId) {
      toast.error('Select both source and target stages')
      return
    }
    createRuleMutation.mutate(newRule)
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">Project Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage workflow stages and trigger rules for this project.</p>

      {/* Stage List */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Workflow Stages</h2>
          <div className="flex-1" />
          {stages.length > 0 && (
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 hover:border-gray-300 transition font-medium"
            >
              <span>⚡</span>
              {showTemplates ? 'Hide templates' : 'Load template'}
            </button>
          )}
        </div>

        {/* ── Template picker ── */}
        {(stages.length === 0 || showTemplates) && !isLoading && (
          <div className={`mb-6 ${stages.length === 0 ? '' : 'border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50'}`}>
            {stages.length === 0 && (
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-sm font-semibold text-indigo-800 mb-0.5">Get started with a template</p>
                <p className="text-xs text-indigo-600">Pick a preset to create all stages instantly, or add them manually below.</p>
              </div>
            )}
            {stages.length > 0 && (
              <p className="text-xs text-gray-400 mb-3 font-medium">
                ⚠️ Applying a template will add these stages on top of existing ones.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {STAGE_TEMPLATES.map((tpl) => {
                const c = COLOR_MAP[tpl.color]
                const isApplying = applyingTemplate === tpl.id
                return (
                  <div
                    key={tpl.id}
                    className={`border rounded-xl p-4 ${c.card} transition`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.badge}`}>
                          {tpl.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{tpl.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => applyTemplate(tpl)}
                        disabled={applyingTemplate !== null}
                        className={`shrink-0 text-xs text-white px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${c.btn}`}
                      >
                        {isApplying ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                    {/* Stage chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.stages.map((s) => (
                        <span
                          key={s.name}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.isClosedState
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.badge
                          }`}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading stages...</p>
        ) : stages.length === 0 ? (
          <p className="text-gray-400 text-sm mb-4">No stages yet — apply a template above or add one below.</p>
        ) : (
          <ul className="space-y-2">
            {stages.map(stage => (
              <li key={stage.id} className="border rounded p-4 bg-white">
                {editingId === stage.id ? (
                  <form
                    onSubmit={handleEdit(data => updateMutation.mutate({ stageId: stage.id, data }))}
                    className="space-y-3"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input
                          {...registerEdit('name')}
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Stage name"
                        />
                        {editErrors.name && (
                          <p className="text-red-500 text-xs mt-0.5">{editErrors.name.message}</p>
                        )}
                      </div>
                      <div className="w-24">
                        <input
                          {...registerEdit('position', { valueAsNumber: true })}
                          type="number"
                          className="w-full border rounded px-2 py-1 text-sm"
                          placeholder="Position"
                        />
                        {editErrors.position && (
                          <p className="text-red-500 text-xs mt-0.5">{editErrors.position.message}</p>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" {...registerEdit('isClosedState')} />
                      Closed state (tickets here are considered done)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono w-5">{stage.position}</span>
                      <span className="font-medium text-sm">{stage.name}</span>
                      {stage.isClosedState && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(stage)} className="text-xs text-blue-600 hover:underline">
                        Edit
                      </button>
                      {confirmDeleteId === stage.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-gray-600">Delete?</span>
                          <button
                            onClick={() => deleteMutation.mutate(stage.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:underline">
                            No
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(stage.id)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add Stage Form */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Add Stage</h2>
        <form
          onSubmit={handleCreate(data => createMutation.mutate(data))}
          className="space-y-3 border rounded p-4 bg-white"
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                {...registerCreate('name')}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="e.g. In Progress"
              />
              {createErrors.name && (
                <p className="text-red-500 text-xs mt-0.5">{createErrors.name.message}</p>
              )}
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium mb-1">
                Position <span className="text-red-500">*</span>
              </label>
              <input
                {...registerCreate('position', { valueAsNumber: true })}
                type="number"
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="0"
              />
              {createErrors.position && (
                <p className="text-red-500 text-xs mt-0.5">{createErrors.position.message}</p>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...registerCreate('isClosedState')} />
            Closed state (tickets here are considered done)
          </label>
          <button
            type="submit"
            disabled={isCreating || createMutation.isPending}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {createMutation.isPending ? 'Adding...' : 'Add Stage'}
          </button>
        </form>
      </section>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-red-600 mb-1">Danger Zone</h2>
        <p className="text-gray-500 text-xs mb-4">These actions affect the project's availability to your team.</p>

        <div className="border border-red-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-white">
            <div>
              {project?.archivedAt ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">Restore this project</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Make this project active again. Archived on{' '}
                    {new Date(project.archivedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800">Archive this project</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Hide the project from the active list. Tickets and data are preserved.
                  </p>
                </>
              )}
            </div>

            {project?.archivedAt ? (
              /* ── Unarchive flow ── */
              confirmArchive ? (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-600">Restore project?</span>
                  <button
                    onClick={() => unarchiveMutation.mutate()}
                    disabled={unarchiveMutation.isPending}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {unarchiveMutation.isPending ? 'Restoring…' : 'Yes, restore'}
                  </button>
                  <button
                    onClick={() => setConfirmArchive(false)}
                    className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmArchive(true)}
                  className="shrink-0 text-xs border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Restore project
                </button>
              )
            ) : (
              /* ── Archive flow ── */
              confirmArchive ? (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-600">Archive project?</span>
                  <button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                    className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {archiveMutation.isPending ? 'Archiving…' : 'Yes, archive'}
                  </button>
                  <button
                    onClick={() => setConfirmArchive(false)}
                    className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmArchive(true)}
                  className="shrink-0 text-xs border border-red-300 text-red-600 hover:bg-red-50 px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Archive project
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── GitHub Connection ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">GitHub Connection</h2>
        <p className="text-gray-500 text-xs mb-4">
          Connect a GitHub repository so trigger rules can respond to PR events.
        </p>

        {!githubConn?.connected ? (
          /* Not connected */
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-[#24292F] rounded-2xl flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">GitHub not connected</p>
            <p className="text-xs text-gray-400 mb-5 max-w-xs">
              Authorize unity_skill to access your GitHub account. You will be redirected to GitHub.
            </p>
            <button
              onClick={connectGithub}
              disabled={connectingGithub}
              className="inline-flex items-center gap-2 bg-[#24292F] hover:bg-gray-700 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              {connectingGithub ? 'Redirecting to GitHub…' : 'Connect GitHub'}
            </button>
          </div>
        ) : !githubConn.repoFullName ? (
          /* Connected via OAuth, but webhook not yet registered */
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                <span className="text-sm font-semibold text-amber-800">GitHub authorized — webhook pending</span>
              </div>
              {/* Reconnect button — use if webhook keeps failing (re-auth with new scope) */}
              <button
                onClick={connectGithub}
                disabled={connectingGithub}
                className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                title="Re-authorize GitHub to refresh permissions"
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reconnect GitHub
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Enter the full name of the repository you want to connect (e.g. <code className="bg-amber-100 px-1 rounded">owner/repo-name</code>).
              unity_skill will register a webhook automatically.
            </p>
            <div className="flex gap-2">
              <input
                value={repoInput}
                onChange={e => setRepoInput(e.target.value)}
                placeholder="owner/repo-name"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={() => webhookMutation.mutate(repoInput.trim())}
                disabled={!repoInput.includes('/') || webhookMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 whitespace-nowrap"
              >
                {webhookMutation.isPending ? 'Activating…' : 'Activate Webhook'}
              </button>
            </div>
          </div>
        ) : (
          /* Fully connected */
          <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#24292F] rounded-xl flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{githubConn.repoFullName}</p>
                <p className="text-xs text-green-700 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                  Webhook active · Trigger rules are live
                </p>
              </div>
            </div>
            <a
              href={`https://github.com/${githubConn.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-700 transition"
            >
              View on GitHub →
            </a>
          </div>
        )}
      </section>

      {/* Trigger Rules */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">Trigger Rules</h2>
        <p className="text-gray-500 text-xs mb-4">
          Automatically move tickets between stages when PR events occur.
          {githubConn && !githubConn.repoFullName && (
            <span className="ml-1 text-amber-600 font-medium">⚠ Connect GitHub first to enable trigger rules.</span>
          )}
        </p>

        {rules.length === 0 ? (
          <p className="text-gray-400 text-sm mb-4">No trigger rules yet.</p>
        ) : (
          <table className="w-full text-sm mb-4 border rounded overflow-hidden">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Source Stage</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Event</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Target Stage</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-t">
                  <td className="px-3 py-2">{stageName(rule.sourceStageId)}</td>
                  <td className="px-3 py-2">
                    <span className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded font-mono">
                      {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
                    </span>
                  </td>
                  <td className="px-3 py-2">{stageName(rule.targetStageId)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      disabled={deleteRuleMutation.isPending}
                      className="text-red-400 hover:text-red-600 text-xs font-medium transition disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add Trigger Form */}
        <form onSubmit={handleAddRule} className="border rounded p-4 bg-white space-y-3">
          <h3 className="text-sm font-medium">Add Trigger Rule</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Source Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={newRule.sourceStageId}
                onChange={e => setNewRule(r => ({ ...r, sourceStageId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                <option value="">Select stage</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Event <span className="text-red-500">*</span>
              </label>
              <select
                value={newRule.triggerType}
                onChange={e => setNewRule(r => ({ ...r, triggerType: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                {TRIGGER_TYPES.map(t => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Target Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={newRule.targetStageId}
                onChange={e => setNewRule(r => ({ ...r, targetStageId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                <option value="">Select stage</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={createRuleMutation.isPending}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {createRuleMutation.isPending ? 'Adding...' : 'Add Trigger'}
          </button>
        </form>
      </section>
    </div>
  )
}
