import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import * as tls from 'tls'

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

export const invalidSslCertificate: AuditCheckDefinition = {
  name: 'invalid_ssl_certificate',
  type: 'technical',
  priority: 'critical',
  description: 'SSL certificate is invalid, expired, or has issues',
  displayName: 'Invalid SSL Certificate',
  displayNamePassed: 'Valid SSL Certificate',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/security',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    // Only check HTTPS sites
    if (url.protocol !== 'https:') {
      return {
        status: 'passed',
        details: { message: 'Site uses HTTP, SSL check not applicable' },
      }
    }

    const certInfo = await getCertificateInfo(url.hostname)

    // Certificate retrieval failed
    if (certInfo.error && !certInfo.validTo) {
      return {
        status: 'failed',
        details: {
          message: `Unable to verify SSL certificate: ${certInfo.error}`,
          error: certInfo.error,
        },
      }
    }

    // Certificate is expired
    if (certInfo.daysUntilExpiry !== undefined && certInfo.daysUntilExpiry <= 0) {
      return {
        status: 'failed',
        details: {
          message: `SSL certificate expired on ${certInfo.validTo?.toLocaleDateString()}. Visitors will see security warnings and browsers may block access to your site.`,
          expiredOn: certInfo.validTo?.toISOString(),
          issuer: certInfo.issuer,
        },
      }
    }

    // Certificate is self-signed
    if (certInfo.selfSigned) {
      return {
        status: 'failed',
        details: {
          message:
            "SSL certificate is self-signed. Browsers will show security warnings. Use a certificate from a trusted Certificate Authority (e.g., Let's Encrypt).",
          issuer: certInfo.issuer,
          selfSigned: true,
        },
      }
    }

    // Certificate has chain/validation issues
    if (certInfo.error) {
      return {
        status: 'failed',
        details: {
          message: `SSL certificate validation failed: ${certInfo.error}. This may cause browser warnings or connection failures.`,
          error: certInfo.error,
          issuer: certInfo.issuer,
          validTo: certInfo.validTo?.toISOString(),
        },
      }
    }

    // Certificate expiring soon (within 30 days) - warning
    if (certInfo.daysUntilExpiry !== undefined && certInfo.daysUntilExpiry <= 30) {
      return {
        status: 'warning',
        details: {
          message: `SSL certificate expires in ${certInfo.daysUntilExpiry} days (${certInfo.validTo?.toLocaleDateString()}). Renew soon to avoid security warnings.`,
          daysUntilExpiry: certInfo.daysUntilExpiry,
          expiresOn: certInfo.validTo?.toISOString(),
          issuer: certInfo.issuer,
        },
      }
    }

    // All good
    return {
      status: 'passed',
      details: {
        message: `SSL certificate is valid and expires in ${certInfo.daysUntilExpiry} days`,
        issuer: certInfo.issuer,
        expiresOn: certInfo.validTo?.toISOString(),
        daysUntilExpiry: certInfo.daysUntilExpiry,
      },
    }
  },
}
