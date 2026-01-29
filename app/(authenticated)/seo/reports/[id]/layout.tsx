export default function ReportDetailLayout({ children }: { children: React.ReactNode }) {
  // Remove padding for report presentation view
  return <div className="-m-8">{children}</div>
}
