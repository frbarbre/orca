import React from 'react'
import { ChevronDown, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

export function RerunChecksMenu({
  rerunning,
  onRerun
}: {
  rerunning: boolean
  onRerun: (failedOnly: boolean) => void
}): React.JSX.Element {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="xs" disabled={rerunning}>
          {rerunning ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {translate('auto.components.PullRequestPage.522d9353e1', 'Rerun')}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onRerun(true)}>
          <RefreshCw className="size-4" />
          {translate('auto.components.PullRequestPage.68605516dd', 'Rerun failed checks')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRerun(false)}>
          <RefreshCw className="size-4" />
          {translate('auto.components.PullRequestPage.54cddd1858', 'Rerun all checks')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
