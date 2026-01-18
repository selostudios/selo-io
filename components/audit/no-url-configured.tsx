export function NoUrlConfigured() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">No website URL configured</h1>
      <p className="text-muted-foreground mt-2">
        Please configure your website URL in organization settings to run site audits.
      </p>
    </div>
  )
}
