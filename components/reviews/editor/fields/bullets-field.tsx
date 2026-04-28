'use client'

import { NarrativeFieldBase, type NarrativeFieldProps } from './narrative-field-base'

export function BulletsField(props: NarrativeFieldProps) {
  return <NarrativeFieldBase {...props} rows={6} placeholder="• One bullet per line" />
}
