/** Runs in the hidden zsh: lets Tab print each candidate instead of inserting or listing it. */
export const ZSH_COMPLETION_INIT = `PROMPT='' RPROMPT=''
builtin unsetopt zle_bracketed_paste 2>/dev/null
builtin autoload -Uz compinit
(( \${+_comps} )) || compinit -C -d "\${ORCA_COMPLETION_DUMP:-\${TMPDIR:-/tmp}/orca-completion-zcompdump}"
builtin bindkey '^U' kill-whole-line
zstyle ':completion:*' list-grouped false
zstyle ':completion:*' insert-tab false
zstyle ':completion:*' list-separator ''
zstyle ':completion:*' menu no
zstyle ':completion:*' matcher-list ''
__orca_completion_idle() { builtin print -rn -- __ORCA_COMPLETION_IDLE__ }
builtin zle -N zle-line-init __orca_completion_idle
__orca_completion_begin() { builtin print -rn -- __ORCA_COMPLETION_BEGIN__ }
__orca_completion_end() {
  builtin print -rn -- __ORCA_COMPLETION_END__
  compstate[insert]=''
  compstate[list]=''
}
# zsh empties compprefuncs and comppostfuncs after each completion, so Tab re-arms them.
__orca_completion_complete() {
  compprefuncs=(__orca_completion_begin)
  comppostfuncs=(__orca_completion_end)
  builtin zle complete-word
}
builtin zle -N __orca_completion_complete
builtin bindkey '^I' __orca_completion_complete
compadd() {
  if [[ \${@[1,(i)(-|--)]} == *-(O|A|D)\\ * ]]; then
    builtin compadd "$@"
    return $?
  fi
  local -a __hits __dscr
  local __tmp
  integer __at=\${@[(I)-[[:alpha:]]#d]}
  if (( __at )); then
    __tmp=\${@[__at+1]}
    if [[ $__tmp == \\(* ]]; then
      eval "__dscr=$__tmp"
    else
      __dscr=("\${(@P)__tmp}")
    fi
  fi
  builtin compadd -A __hits -D __dscr "$@"
  builtin setopt localoptions norcexpandparam extendedglob
  local -A __apre __hpre __hsuf __asuf
  zparseopts -E P:=__apre p:=__hpre S:=__asuf s:=__hsuf
  integer __dirsuffix=0
  if [[ -z $__hsuf && "\${\${@//-default-/}% -# *}" == *-[[:alnum:]]#f* ]]; then
    __dirsuffix=1
  fi
  [[ -n $__hits ]] || return
  local __dsuf __d
  integer __i
  for __i in {1..$#__hits}; do
    (( __dirsuffix )) && [[ -d \${~:-\${__hpre[-p]}$__hits[$__i]} ]] && __dsuf=/ || __dsuf=
    (( $#__dscr >= __i )) && __d=\${\${\${__dscr[$__i]}##$__hits[$__i] #}##-- #} || __d=
    builtin print -rn -- "$IPREFIX$__apre$__hpre$__hits[$__i]$__dsuf$__hsuf$__asuf"$'\\x1f'"$__d"$'\\n'
  done
}
`

/** Reads "cwd\\nline\\n" requests and answers each with the candidates, then a done marker. */
export const ZSH_COMPLETION_DRIVER = `zmodload zsh/zpty || exit 1
zpty z zsh \${=ORCA_COMPLETION_ZSH_ARGS:--i}
zpty -w z 'builtin source \${ORCA_COMPLETION_INIT}'
zpty -r z __out '*__ORCA_COMPLETION_IDLE__*' || exit 1
builtin print -r -- __ORCA_COMPLETION_DONE__
__dir=
while IFS= builtin read -r __cwd && IFS= builtin read -r __line; do
  if [[ $__cwd != $__dir ]]; then
    zpty -w z "builtin cd -q -- \${(q)__cwd} 2>/dev/null"
    zpty -r z __out '*__ORCA_COMPLETION_IDLE__*' || exit 1
    __dir=$__cwd
  fi
  zpty -n -w z "\${__line}"$'\\t'
  zpty -r z __out '*__ORCA_COMPLETION_END__*' || exit 1
  zpty -n -w z $'\\x15'
  __out=\${__out##*__ORCA_COMPLETION_BEGIN__}
  __out=\${__out%%__ORCA_COMPLETION_END__*}
  builtin print -rn -- "\${__out//$'\\r'/}"
  builtin print -r -- __ORCA_COMPLETION_DONE__
done
zpty -d z
`
