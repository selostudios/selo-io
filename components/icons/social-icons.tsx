import { Twitter, Facebook, Instagram, Linkedin, Youtube, Github, Link } from 'lucide-react'

const iconMap = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  github: Github,
  crunchbase: Link,
} as const

export type SocialPlatform = keyof typeof iconMap

export function SocialIcon({
  platform,
  className,
}: {
  platform: string
  className?: string
}) {
  const Icon = iconMap[platform as SocialPlatform] || Link
  return <Icon className={className} />
}
