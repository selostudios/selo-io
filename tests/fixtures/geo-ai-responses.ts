import type { GEOPageAnalysis, GEOBatchAnalysis } from '@/lib/geo/types'

/**
 * Fixture: Real Claude Opus 4.5 response structure
 * This is a saved response from actual API call for testing
 */
export const mockGEOPageAnalysis: GEOPageAnalysis = {
  url: 'https://example.com/guide/seo-basics',
  scores: {
    dataQuality: 75,
    expertCredibility: 82,
    comprehensiveness: 78,
    citability: 85,
    authority: 80,
    overall: 80,
  },
  findings: {
    originalData: {
      present: true,
      count: 5,
      quality: 'good',
      examples: [
        '67% of clicks go to top 5 results (Backlinko study, 2023)',
        '90.63% of pages get zero traffic from Google (Ahrefs)',
        'Average top-ranking page is 3+ years old',
      ],
      issues: ['One statistic lacks source attribution'],
    },
    expertQuotes: {
      present: true,
      count: 3,
      credibility: 'high',
      examples: [
        'Neil Patel, SEO Expert: "Content depth matters more than keyword density"',
        'Brian Dean (Backlinko): "Comprehensive content gets more backlinks"',
      ],
      issues: [],
    },
    comprehensiveness: {
      topicsCovered: [
        'Keyword research fundamentals',
        'On-page optimization',
        'Technical SEO basics',
        'Link building strategies',
        'Content optimization',
      ],
      gapsIdentified: ['Local SEO', 'Mobile-first indexing details', 'Core Web Vitals'],
      depth: 'adequate',
    },
    citableElements: [
      'Clear definition of SEO in first paragraph',
      'Step-by-step keyword research process',
      'Specific statistics with sources',
      'Expert quotes with attribution',
    ],
  },
  recommendations: [
    {
      priority: 'high',
      category: 'Data Quality',
      issue: 'One statistic in the "ranking factors" section lacks source attribution',
      recommendation:
        'Add link to the study claiming "200+ ranking factors" or replace with sourced alternative',
      expectedImpact: 'Increases trustworthiness by 15-20%, higher AI citation probability',
      learnMoreUrl: 'https://www.nngroup.com/articles/citing-sources-credibility/',
    },
    {
      priority: 'medium',
      category: 'Comprehensiveness',
      issue: 'Missing coverage of mobile-first indexing and Core Web Vitals',
      recommendation:
        'Add section on mobile SEO and page speed optimization (300-500 words)',
      expectedImpact: 'Fills content gaps, appeals to broader search queries',
    },
    {
      priority: 'medium',
      category: 'Expert Credibility',
      issue: 'Good expert quotes but could strengthen author credentials',
      recommendation:
        'Add author bio with SEO credentials and link to author profile page',
      expectedImpact: 'Strengthens E-E-A-T signals, increases authority score',
    },
  ],
}

export const mockGEOPageAnalysisThin: GEOPageAnalysis = {
  url: 'https://example.com/contact',
  scores: {
    dataQuality: 20,
    expertCredibility: 15,
    comprehensiveness: 30,
    citability: 25,
    authority: 40,
    overall: 26,
  },
  findings: {
    originalData: {
      present: false,
      count: 0,
      quality: 'none',
      examples: [],
      issues: ['No data points or statistics present'],
    },
    expertQuotes: {
      present: false,
      count: 0,
      credibility: 'none',
      examples: [],
      issues: ['No expert perspectives or quotes'],
    },
    comprehensiveness: {
      topicsCovered: ['Company address', 'Contact form', 'Business hours'],
      gapsIdentified: [],
      depth: 'shallow',
    },
    citableElements: [],
  },
  recommendations: [
    {
      priority: 'low',
      category: 'Content Quality',
      issue: 'Contact page has minimal citable content',
      recommendation:
        'This is expected for a contact page - no action needed unless you want to add FAQ section',
      expectedImpact: 'Low impact for this page type',
    },
  ],
}

export const mockBatchAnalysis: GEOBatchAnalysis = {
  analyses: [mockGEOPageAnalysis, mockGEOPageAnalysisThin],
  batchMetadata: {
    pagesAnalyzed: 2,
    averageScore: 53,
    commonIssues: [
      'Some statistics lack source attribution',
      'Author credentials not prominently displayed',
    ],
  },
}

/**
 * Mock response for AI SDK generateObject
 */
export function createMockGenerateObjectResponse(analysis: GEOBatchAnalysis) {
  return {
    object: analysis,
    usage: {
      inputTokens: 5234,
      outputTokens: 1842,
      totalTokens: 7076,
    },
  }
}

/**
 * Mock response for AI SDK generateText
 */
export function createMockGenerateTextResponse(analysis: GEOBatchAnalysis) {
  return {
    text: JSON.stringify(analysis),
    usage: {
      inputTokens: 5234,
      outputTokens: 1842,
      totalTokens: 7076,
    },
  }
}
