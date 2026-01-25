import { StyleSheet } from '@react-pdf/renderer'

// Selo brand colors
export const colors = {
  primary: '#1a1a1a',
  secondary: '#f5f5f0',
  accent: '#666666',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  muted: '#999999',
  border: '#eeeeee',
  white: '#ffffff',
  text: '#333333',
  textLight: '#666666',
}

// Typography
export const fonts = {
  base: 'Helvetica',
  bold: 'Helvetica-Bold',
}

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
}

// Score color helper
export function getScoreColor(score: number | null, thresholds = { good: 80, fair: 60 }): string {
  if (score === null) return colors.muted
  if (score >= thresholds.good) return colors.success
  if (score >= thresholds.fair) return colors.warning
  return colors.error
}

// Shared base styles
export const baseStyles = StyleSheet.create({
  // Page layouts
  page: {
    padding: spacing.xl,
    fontFamily: fonts.base,
    backgroundColor: colors.white,
    fontSize: 10,
    lineHeight: 1.5,
  },
  coverPage: {
    padding: spacing.xl,
    fontFamily: fonts.base,
    backgroundColor: colors.primary,
    color: colors.white,
  },
  coverPageLight: {
    padding: spacing.xl,
    fontFamily: fonts.base,
    backgroundColor: colors.white,
    color: colors.primary,
  },

  // Cover page elements
  coverContent: {
    marginTop: 160,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.xl,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.white,
  },
  coverSubtitle: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 30,
    left: spacing.xl,
    right: spacing.xl,
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 9,
  },

  // Section headers
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },

  // Score cards row
  scoreCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.lg,
  },
  scoreCard: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  scoreLabel: {
    fontSize: 9,
    color: colors.textLight,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textLight,
  },

  // Text styles
  bodyText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: colors.text,
    marginBottom: spacing.md,
  },
  smallText: {
    fontSize: 9,
    color: colors.textLight,
  },

  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 30,
    left: spacing.xl,
    right: spacing.xl,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },

  // Issue card styles
  issueCard: {
    padding: 12,
    marginBottom: spacing.sm,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  issueCardCritical: {
    backgroundColor: '#fef2f2',
    borderLeftColor: colors.error,
  },
  issueCardWarning: {
    backgroundColor: '#fffbeb',
    borderLeftColor: colors.warning,
  },
  issueName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  issueDescription: {
    fontSize: 10,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 1.4,
  },
  issueFixGuidance: {
    fontSize: 9,
    color: colors.textLight,
    lineHeight: 1.4,
  },
  issuePriority: {
    fontSize: 8,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },

  // Action list styles
  actionList: {
    marginTop: spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 10,
  },
  actionNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
    width: 20,
  },
  actionText: {
    fontSize: 10,
    color: colors.text,
    flex: 1,
    lineHeight: 1.5,
  },

  // Contact info box
  contactBox: {
    backgroundColor: colors.secondary,
    padding: 20,
    borderRadius: 6,
    marginTop: 20,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
  },
  contactItem: {
    fontSize: 11,
    color: colors.text,
    marginBottom: 6,
  },

  // Passed checks summary
  passedSummary: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 4,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passedText: {
    fontSize: 10,
    color: colors.success,
    marginLeft: spacing.sm,
  },

  // Compact table styles for issues
  table: {
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowCritical: {
    backgroundColor: '#fef2f2',
  },
  tableRowWarning: {
    backgroundColor: '#fffbeb',
  },
  tableRowOptional: {
    backgroundColor: colors.white,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.primary,
  },
  tableCellSmall: {
    fontSize: 8,
    color: colors.textLight,
  },
  // Column widths for issue table
  colIssue: { width: '45%' },
  colPriority: { width: '15%' },
  colPages: { width: '12%', textAlign: 'right' as const },
  colFix: { width: '28%' },
})
