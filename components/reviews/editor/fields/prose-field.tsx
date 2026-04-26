'use client'

import { NarrativeFieldBase, type NarrativeFieldProps } from './narrative-field-base'

export function ProseField(props: NarrativeFieldProps) {
  return <NarrativeFieldBase {...props} rows={6} />
}
