import { describe, expect, it } from 'vitest'
import {
  GEOPageAnalysisSchema,
  GEOBatchAnalysisSchema,
  type GEOPageAnalysis,
  type GEOBatchAnalysis,
} from '@/lib/geo/types'

describe('GEO Types', () => {
  describe('GEOPageAnalysisSchema', () => {
    it('should validate a complete, valid GEO page analysis', () => {
      const validAnalysis: GEOPageAnalysis = {
        url: 'https://example.com/page',
        scores: {
          dataQuality: 75,
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: true,
            count: 3,
            quality: 'good',
            examples: ['25% increase in conversion', 'Study of 1,000 users'],
            issues: ['Missing source links'],
          },
          expertQuotes: {
            present: true,
            count: 2,
            credibility: 'high',
            examples: ['John Doe, CEO: "This is transformative"'],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: ['Introduction', 'Implementation', 'Best practices'],
            gapsIdentified: ['Advanced use cases', 'Troubleshooting'],
            depth: 'adequate',
          },
          citableElements: [
            'Original research data on user behavior',
            'Expert quotes from industry leaders',
          ],
        },
        recommendations: [
          {
            priority: 'high',
            category: 'Data Quality',
            issue: 'Statistics lack source attribution',
            recommendation: 'Add links to original research for all data points',
            expectedImpact: 'Increases trustworthiness by 40%',
            learnMoreUrl: 'https://www.nngroup.com/articles/citing-sources-credibility/',
          },
        ],
      }

      const result = GEOPageAnalysisSchema.safeParse(validAnalysis)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.url).toBe('https://example.com/page')
        expect(result.data.scores.overall).toBe(75)
        expect(result.data.findings.originalData.quality).toBe('good')
      }
    })

    it('should reject invalid URL', () => {
      const invalid = {
        url: 'not-a-url',
        scores: {
          dataQuality: 75,
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: false,
            count: 0,
            quality: 'none',
            examples: [],
            issues: [],
          },
          expertQuotes: {
            present: false,
            count: 0,
            credibility: 'none',
            examples: [],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: [],
            gapsIdentified: [],
            depth: 'shallow',
          },
          citableElements: [],
        },
        recommendations: [],
      }

      const result = GEOPageAnalysisSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject scores outside 0-100 range', () => {
      const invalid = {
        url: 'https://example.com',
        scores: {
          dataQuality: 150, // Invalid: > 100
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: false,
            count: 0,
            quality: 'none',
            examples: [],
            issues: [],
          },
          expertQuotes: {
            present: false,
            count: 0,
            credibility: 'none',
            examples: [],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: [],
            gapsIdentified: [],
            depth: 'shallow',
          },
          citableElements: [],
        },
        recommendations: [],
      }

      const result = GEOPageAnalysisSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should enforce maximum 3 examples for originalData', () => {
      const invalid = {
        url: 'https://example.com',
        scores: {
          dataQuality: 75,
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: true,
            count: 5,
            quality: 'excellent',
            examples: ['Example 1', 'Example 2', 'Example 3', 'Example 4'], // Too many
            issues: [],
          },
          expertQuotes: {
            present: false,
            count: 0,
            credibility: 'none',
            examples: [],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: [],
            gapsIdentified: [],
            depth: 'shallow',
          },
          citableElements: [],
        },
        recommendations: [],
      }

      const result = GEOPageAnalysisSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should enforce maximum 10 recommendations', () => {
      const recommendations = Array.from({ length: 11 }, (_, i) => ({
        priority: 'medium' as const,
        category: 'Test',
        issue: `Issue ${i}`,
        recommendation: `Recommendation ${i}`,
        expectedImpact: 'Some impact',
      }))

      const invalid = {
        url: 'https://example.com',
        scores: {
          dataQuality: 75,
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: false,
            count: 0,
            quality: 'none',
            examples: [],
            issues: [],
          },
          expertQuotes: {
            present: false,
            count: 0,
            credibility: 'none',
            examples: [],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: [],
            gapsIdentified: [],
            depth: 'shallow',
          },
          citableElements: [],
        },
        recommendations, // 11 recommendations (too many)
      }

      const result = GEOPageAnalysisSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate enum values for quality, credibility, and depth', () => {
      const validQualities: Array<'excellent' | 'good' | 'poor' | 'none'> = [
        'excellent',
        'good',
        'poor',
        'none',
      ]
      const validCredibilities: Array<'high' | 'medium' | 'low' | 'none'> = [
        'high',
        'medium',
        'low',
        'none',
      ]
      const validDepths: Array<'comprehensive' | 'adequate' | 'shallow'> = [
        'comprehensive',
        'adequate',
        'shallow',
      ]

      for (const quality of validQualities) {
        for (const credibility of validCredibilities) {
          for (const depth of validDepths) {
            const analysis = {
              url: 'https://example.com',
              scores: {
                dataQuality: 75,
                expertCredibility: 80,
                comprehensiveness: 70,
                citability: 72,
                authority: 78,
                overall: 75,
              },
              findings: {
                originalData: {
                  present: true,
                  count: 1,
                  quality,
                  examples: [],
                  issues: [],
                },
                expertQuotes: {
                  present: true,
                  count: 1,
                  credibility,
                  examples: [],
                  issues: [],
                },
                comprehensiveness: {
                  topicsCovered: [],
                  gapsIdentified: [],
                  depth,
                },
                citableElements: [],
              },
              recommendations: [],
            }

            const result = GEOPageAnalysisSchema.safeParse(analysis)
            expect(result.success).toBe(true)
          }
        }
      }
    })

    it('should validate optional learnMoreUrl in recommendations', () => {
      const withUrl = {
        url: 'https://example.com',
        scores: {
          dataQuality: 75,
          expertCredibility: 80,
          comprehensiveness: 70,
          citability: 72,
          authority: 78,
          overall: 75,
        },
        findings: {
          originalData: {
            present: false,
            count: 0,
            quality: 'none',
            examples: [],
            issues: [],
          },
          expertQuotes: {
            present: false,
            count: 0,
            credibility: 'none',
            examples: [],
            issues: [],
          },
          comprehensiveness: {
            topicsCovered: [],
            gapsIdentified: [],
            depth: 'shallow',
          },
          citableElements: [],
        },
        recommendations: [
          {
            priority: 'high',
            category: 'Test',
            issue: 'Test issue',
            recommendation: 'Test recommendation',
            expectedImpact: 'Test impact',
            learnMoreUrl: 'https://example.com/learn',
          },
        ],
      }

      const withoutUrl = {
        ...withUrl,
        recommendations: [
          {
            priority: 'high',
            category: 'Test',
            issue: 'Test issue',
            recommendation: 'Test recommendation',
            expectedImpact: 'Test impact',
            // No learnMoreUrl
          },
        ],
      }

      expect(GEOPageAnalysisSchema.safeParse(withUrl).success).toBe(true)
      expect(GEOPageAnalysisSchema.safeParse(withoutUrl).success).toBe(true)
    })
  })

  describe('GEOBatchAnalysisSchema', () => {
    it('should validate a complete batch analysis', () => {
      const validBatch: GEOBatchAnalysis = {
        analyses: [
          {
            url: 'https://example.com/page1',
            scores: {
              dataQuality: 75,
              expertCredibility: 80,
              comprehensiveness: 70,
              citability: 72,
              authority: 78,
              overall: 75,
            },
            findings: {
              originalData: {
                present: true,
                count: 3,
                quality: 'good',
                examples: [],
                issues: [],
              },
              expertQuotes: {
                present: true,
                count: 2,
                credibility: 'high',
                examples: [],
                issues: [],
              },
              comprehensiveness: {
                topicsCovered: [],
                gapsIdentified: [],
                depth: 'adequate',
              },
              citableElements: [],
            },
            recommendations: [],
          },
          {
            url: 'https://example.com/page2',
            scores: {
              dataQuality: 80,
              expertCredibility: 75,
              comprehensiveness: 85,
              citability: 78,
              authority: 82,
              overall: 80,
            },
            findings: {
              originalData: {
                present: false,
                count: 0,
                quality: 'none',
                examples: [],
                issues: [],
              },
              expertQuotes: {
                present: false,
                count: 0,
                credibility: 'none',
                examples: [],
                issues: [],
              },
              comprehensiveness: {
                topicsCovered: [],
                gapsIdentified: [],
                depth: 'comprehensive',
              },
              citableElements: [],
            },
            recommendations: [],
          },
        ],
        batchMetadata: {
          pagesAnalyzed: 2,
          averageScore: 77.5,
          commonIssues: ['Missing source attribution', 'Insufficient expert quotes'],
        },
      }

      const result = GEOBatchAnalysisSchema.safeParse(validBatch)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.analyses).toHaveLength(2)
        expect(result.data.batchMetadata.pagesAnalyzed).toBe(2)
        expect(result.data.batchMetadata.averageScore).toBe(77.5)
      }
    })

    it('should allow empty analyses array', () => {
      const emptyBatch = {
        analyses: [],
        batchMetadata: {
          pagesAnalyzed: 0,
          averageScore: 0,
          commonIssues: [],
        },
      }

      const result = GEOBatchAnalysisSchema.safeParse(emptyBatch)
      expect(result.success).toBe(true)
    })

    it('should reject batch with invalid analyses', () => {
      const invalidBatch = {
        analyses: [
          {
            url: 'not-a-url', // Invalid URL
            scores: {
              dataQuality: 75,
              expertCredibility: 80,
              comprehensiveness: 70,
              citability: 72,
              authority: 78,
              overall: 75,
            },
            findings: {
              originalData: {
                present: false,
                count: 0,
                quality: 'none',
                examples: [],
                issues: [],
              },
              expertQuotes: {
                present: false,
                count: 0,
                credibility: 'none',
                examples: [],
                issues: [],
              },
              comprehensiveness: {
                topicsCovered: [],
                gapsIdentified: [],
                depth: 'shallow',
              },
              citableElements: [],
            },
            recommendations: [],
          },
        ],
        batchMetadata: {
          pagesAnalyzed: 1,
          averageScore: 75,
          commonIssues: [],
        },
      }

      const result = GEOBatchAnalysisSchema.safeParse(invalidBatch)
      expect(result.success).toBe(false)
    })
  })
})
