'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus, Globe, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProjectDialog } from './project-dialog'
import type { SeoProject } from '@/lib/seo/actions'

// Minimal project type for display - allows both full SeoProject and simpler objects
interface ProjectForDisplay {
  id: string
  name: string
  url: string
}

interface ProjectSelectorProps {
  projects: ProjectForDisplay[]
  selectedProjectId?: string
  basePath: string // e.g., '/seo/site-audit' or '/seo/page-speed'
}

export function ProjectSelector({ projects, selectedProjectId, basePath }: ProjectSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectForDisplay | null>(null)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  const handleSelectProject = (projectId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('project', projectId)
    router.push(`${basePath}?${params.toString()}`)
  }

  const handleAddProject = () => {
    setEditingProject(null)
    setDialogOpen(true)
  }

  const handleProjectCreated = (project: ProjectForDisplay) => {
    setDialogOpen(false)
    // Navigate to the newly created project
    handleSelectProject(project.id)
  }

  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-between">
            {selectedProject ? (
              <span className="flex items-center gap-2 truncate">
                <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedProject.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a project</span>
            )}
            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          {projects.length > 0 ? (
            <>
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium truncate">{project.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {getDomain(project.url)}
                    </span>
                  </div>
                  {project.id === selectedProjectId && (
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={handleAddProject}>
            <Plus className="mr-2 h-4 w-4" />
            Add new project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
        onSuccess={handleProjectCreated}
      />
    </>
  )
}
