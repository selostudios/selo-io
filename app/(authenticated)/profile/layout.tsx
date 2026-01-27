export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your personal information</p>
      </div>

      {children}
    </div>
  )
}
