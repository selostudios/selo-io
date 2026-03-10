import * as tls from 'tls'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

interface CertificateInfo {
  valid: boolean
  issuer?: string
  subject?: string
  validFrom?: Date
  validTo?: Date
  daysUntilExpiry?: number
  error?: string
  selfSigned?: boolean
}

async function getCertificateInfo(hostname: string): Promise<CertificateInfo> {
  return new Promise((resolve) => {
    const options = {
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false, // We want to inspect even invalid certs
    }

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate()

      if (!cert || Object.keys(cert).length === 0) {
        socket.destroy()
        resolve({ valid: false, error: 'No certificate returned' })
        return
      }

      const validFrom = new Date(cert.valid_from)
      const validTo = new Date(cert.valid_to)
      const now = new Date()
      const daysUntilExpiry = Math.floor(
        (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Check if self-signed (issuer matches subject)
      const issuerCN = cert.issuer?.CN || ''
      const subjectCN = cert.subject?.CN || ''
      const selfSigned = issuerCN === subjectCN && !cert.issuer?.O

      // Check if the certificate is authorized (valid chain)
      const authorized = socket.authorized

      socket.destroy()

      resolve({
        valid: authorized && !selfSigned && daysUntilExpiry > 0,
        issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
        subject: subjectCN || hostname,
        validFrom,
        validTo,
        daysUntilExpiry,
        selfSigned,
        error: !authorized ? socket.authorizationError?.toString() : undefined,
      })
    })

    socket.on('error', (err) => {
      socket.destroy()
      resolve({ valid: false, error: err.message })
    })

    socket.setTimeout(10000, () => {
      socket.destroy()
      resolve({ valid: false, error: 'Connection timeout' })
    })
  })
}

export const sslCertificate: AuditCheckDefinition = {
  name: 'ssl_certificate',
  category: CheckCategory.Security,
  priority: CheckPriority.Critical,
  description: 'Site must use HTTPS with a valid SSL certificate for security and SEO ranking',
  displayName: 'SSL Certificate Issues',
  displayNamePassed: 'Valid SSL Certificate',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/security',
  isSiteWide: true,
  fixGuidance:
    "Enable HTTPS on your server with a valid SSL certificate from a trusted Certificate Authority (e.g., Let's Encrypt).",
  feedsScores: [ScoreDimension.SEO, ScoreDimension.Performance],

  async run(context: CheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    // Check 1: Is the site using HTTPS?
    if (url.protocol !== 'https:') {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Site is served over HTTP instead of HTTPS. HTTPS is required for security and is a Google ranking factor. Enable SSL/TLS encryption on your server.',
          issue: 'missing_https',
        },
      }
    }

    // Check 2: Validate the SSL certificate
    const certInfo = await getCertificateInfo(url.hostname)

    // Certificate retrieval failed
    if (certInfo.error && !certInfo.validTo) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Unable to verify SSL certificate: ${certInfo.error}`,
          issue: 'certificate_error',
          error: certInfo.error,
        },
      }
    }

    // Certificate is expired
    if (certInfo.daysUntilExpiry !== undefined && certInfo.daysUntilExpiry <= 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `SSL certificate expired on ${certInfo.validTo?.toLocaleDateString()}. Visitors will see security warnings and browsers may block access to your site.`,
          issue: 'expired',
          expiredOn: certInfo.validTo?.toISOString(),
          issuer: certInfo.issuer,
        },
      }
    }

    // Certificate is self-signed
    if (certInfo.selfSigned) {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            "SSL certificate is self-signed. Browsers will show security warnings. Use a certificate from a trusted Certificate Authority (e.g., Let's Encrypt).",
          issue: 'self_signed',
          issuer: certInfo.issuer,
        },
      }
    }

    // Certificate has chain/validation issues
    if (certInfo.error) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `SSL certificate validation failed: ${certInfo.error}. This may cause browser warnings or connection failures.`,
          issue: 'validation_error',
          error: certInfo.error,
          issuer: certInfo.issuer,
          validTo: certInfo.validTo?.toISOString(),
        },
      }
    }

    // Certificate expiring soon (within 30 days) - warning
    if (certInfo.daysUntilExpiry !== undefined && certInfo.daysUntilExpiry <= 30) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `SSL certificate expires in ${certInfo.daysUntilExpiry} days (${certInfo.validTo?.toLocaleDateString()}). Renew soon to avoid security warnings.`,
          issue: 'expiring_soon',
          daysUntilExpiry: certInfo.daysUntilExpiry,
          expiresOn: certInfo.validTo?.toISOString(),
          issuer: certInfo.issuer,
        },
      }
    }

    // All good
    return {
      status: CheckStatus.Passed,
      details: {
        message: `SSL certificate is valid and expires in ${certInfo.daysUntilExpiry} days`,
        issuer: certInfo.issuer,
        expiresOn: certInfo.validTo?.toISOString(),
        daysUntilExpiry: certInfo.daysUntilExpiry,
      },
    }
  },
}
