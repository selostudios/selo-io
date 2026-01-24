'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus, Globe, Check } from 'lucide-react'

const LAST_PROJECT_KEY = 'seo-last-project-id'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProjectDialog } from './project-dialog'

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

  // Restore last selected project from localStorage if none selected
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const lastProjectId = localStorage.getItem(LAST_PROJECT_KEY)
      if (lastProjectId) {
        // Only redirect if the stored project still exists
        const projectExists = projects.some((p) => p.id === lastProjectId)
        if (projectExists) {
          const params = new URLSearchParams(searchParams.toString())
          params.set('project', lastProjectId)
          router.replace(`${basePath}?${params.toString()}`)
        }
      }
    }
  }, [selectedProjectId, projects, basePath, router, searchParams])

  const handleSelectProject = (projectId: string) => {
    // Store selection in localStorage
    localStorage.setItem(LAST_PROJECT_KEY, projectId)
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
    // Navigate to the newly created project (also stores in localStorage)
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
                <Globe className="text-muted-foreground h-4 w-4 flex-shrink-0" />
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
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{project.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {getDomain(project.url)}
                    </span>
                  </div>
                  {project.id === selectedProjectId && (
                    <Check className="text-primary h-4 w-4 flex-shrink-0" />
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
