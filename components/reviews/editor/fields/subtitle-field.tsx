'use client'

import { NarrativeFieldBase, type NarrativeFieldProps } from './narrative-field-base'

export function SubtitleField(props: NarrativeFieldProps) {
  return <NarrativeFieldBase {...props} rows={2} />
}
