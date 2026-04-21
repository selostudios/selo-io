/**
 * Global print styles shared by all slide decks (reports and reviews).
 *
 * A deck renders two copies of its content: the interactive transform-based
 * track (`.screen-only`) and a stacked print-only list (`.print-only`). These
 * rules hide/show the right one for each medium and force each print slide
 * onto its own A4 landscape page.
 */
export function DeckPrintStyles() {
  return (
    <style jsx global>{`
      .print-only {
        display: none;
      }

      @media print {
        @page {
          size: A4 landscape;
          margin: 0;
        }

        .screen-only,
        .print\\:hidden {
          display: none !important;
        }

        .print-only {
          display: block !important;
        }

        html,
        body {
          width: 100%;
          height: 100%;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .print-slide {
          width: 100%;
          height: 100vh;
          min-height: 100vh;
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
          box-sizing: border-box;
        }

        .print-slide:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
      }
    `}</style>
  )
}
