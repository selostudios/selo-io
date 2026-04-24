'use client'

import { Area, AreaChart, YAxis } from 'recharts'

interface DeckSparklineProps {
  data: Array<{ date: string; value: number }>
  /** Stable id used for the SVG gradient's fill. Must be unique per rendered sparkline on the page. */
  gradientId: string
}

const WIDTH = 96
const HEIGHT = 40

/**
 * Minimal sparkline used in metric strip tiles on the performance review deck.
 * Renders an indigo→purple area chart with no axes, grid, or tooltip — purely
 * decorative trajectory for the big-number tile. Returns null when there aren't
 * enough points to draw a line.
 */
export function DeckSparkline({ data, gradientId }: DeckSparklineProps) {
  if (!data || data.length < 2) return null

  return (
    <div className="pointer-events-none" style={{ width: WIDTH, height: HEIGHT }}>
      <AreaChart
        width={WIDTH}
        height={HEIGHT}
        data={data}
        margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-indigo-500)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-purple-600)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-indigo-500)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  )
}
