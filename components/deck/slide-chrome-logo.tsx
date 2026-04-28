import Image from 'next/image'

export function SlideChromeLogo() {
  return (
    <Image
      src="/selo-logo.jpg.webp"
      alt="Selo Studios"
      width={48}
      height={48}
      data-testid="slide-chrome-logo"
      className="pointer-events-none absolute right-4 bottom-4 z-10 size-8 object-contain opacity-70 md:size-12"
    />
  )
}
