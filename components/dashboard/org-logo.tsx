import Image from 'next/image'

interface OrgLogoProps {
  logoUrl: string | null
  orgName: string
  primaryColor?: string
  size?: number
}

export function OrgLogo({ logoUrl, orgName, primaryColor, size = 40 }: OrgLogoProps) {
  const initial = orgName.charAt(0).toUpperCase()

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${orgName} logo`}
        width={size}
        height={size}
        className="rounded-lg object-contain"
      />
    )
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: primaryColor || '#6B7280',
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  )
}
