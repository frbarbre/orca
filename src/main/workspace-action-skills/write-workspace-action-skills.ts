import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  WORKSPACE_ACTION_SKILL_NAMES,
  type WorkspaceActionSkill
} from '../../shared/workspace-action-skills'

const MARKER_FILE = '.orca-generated'

async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function isOrcaOwned(folder: string): Promise<boolean> {
  try {
    const stat = await lstat(folder)
    if (!stat.isDirectory()) {
      return false
    }
  } catch {
    return true
  }
  return (await readIfPresent(join(folder, MARKER_FILE))) !== null
}

async function writeSkill(root: string, skill: WorkspaceActionSkill): Promise<void> {
  const folder = join(root, skill.name)
  if (!(await isOrcaOwned(folder))) {
    return
  }
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, MARKER_FILE), '')
  const skillFile = join(folder, 'SKILL.md')
  if ((await readIfPresent(skillFile)) !== skill.content) {
    await writeFile(skillFile, skill.content)
  }
}

export async function writeWorkspaceActionSkills(
  skills: readonly WorkspaceActionSkill[],
  roots: readonly string[]
): Promise<void> {
  const allowed = new Set<string>(WORKSPACE_ACTION_SKILL_NAMES)
  for (const skill of skills) {
    if (!allowed.has(skill.name)) {
      continue
    }
    for (const root of roots) {
      await writeSkill(root, skill)
    }
  }
}
