import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { fileIconName, folderIconName } from './material-icon-resolve'
import { useMaterialIcons } from './material-icon-store'

// Why no-inline: 1,251 icons as data URIs would bloat the bundle; each stays its own file.
const ICON_URLS = import.meta.glob<string>(
  '../../../../../node_modules/material-icon-theme/icons/*.svg',
  { eager: true, query: '?no-inline', import: 'default' }
)

const URL_BY_ICON = new Map(
  Object.entries(ICON_URLS).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
    url
  ])
)

export type MaterialIconProps = {
  className?: string
  style?: CSSProperties
  size?: number | string
}

function MaterialIconImage({
  icon,
  fallback,
  className,
  style,
  size
}: MaterialIconProps & { icon: string; fallback: string }): React.JSX.Element {
  const url = URL_BY_ICON.get(icon) ?? URL_BY_ICON.get(fallback)
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-4 shrink-0 select-none', className)}
      style={size === undefined ? style : { width: size, height: size, ...style }}
    />
  )
}

export function MaterialFileIcon({
  path,
  ...props
}: MaterialIconProps & { path: string }): React.JSX.Element {
  const manifest = useMaterialIcons((state) => state.manifest)
  const light = useMaterialIcons((state) => state.light)
  return <MaterialIconImage {...props} icon={fileIconName(manifest, path, light)} fallback="file" />
}

export function MaterialFolderIcon({
  path,
  open,
  ...props
}: MaterialIconProps & { path: string; open: boolean }): React.JSX.Element {
  const manifest = useMaterialIcons((state) => state.manifest)
  const light = useMaterialIcons((state) => state.light)
  return (
    <MaterialIconImage
      {...props}
      icon={folderIconName(manifest, path, open, light)}
      fallback={open ? 'folder-open' : 'folder'}
    />
  )
}
