import { useEffect, useReducer, useRef } from 'react'
import './ConnectionGraphic.css'



/* ── Colour palette ───────────────────────────────────────────────────── */
const PALETTE = [
  { fill: '#ffffff', icon: '#1a73e8', ring: '#90caf9' }, // 0 white  (centre)
  { fill: '#f57c00', icon: '#ffffff', ring: '#ffcc80' }, // 1 orange
  { fill: '#2e7d32', icon: '#ffffff', ring: '#81c784' }, // 2 green
  { fill: '#1565c0', icon: '#ffffff', ring: '#64b5f6' }, // 3 blue
  { fill: '#f9a825', icon: '#ffffff', ring: '#fff9c4' }, // 4 gold
  { fill: '#00838f', icon: '#ffffff', ring: '#80deea' }, // 5 teal
  { fill: '#6a1b9a', icon: '#ffffff', ring: '#ce93d8' }, // 6 purple
  { fill: '#b71c1c', icon: '#ffffff', ring: '#ef9a9a' }, // 7 red
]

/* ── Node definitions (1200×700 landscape, centre at 600,350) ─────────── */
interface NDef {
  id: number; x: number; y: number; r: number; ci: number
  parentId: number | null; delay: number
}

const DEFS: NDef[] = [
  // L0 – large white centre
  { id: 0,  x: 600, y: 350, r: 32, ci: 0, parentId: null, delay: 100 },

  // L1 – 7 hubs spread across the landscape
  { id: 1,  x: 360, y: 248, r: 20, ci: 1, parentId: 0, delay: 440  }, // orange  upper-left
  { id: 2,  x: 445, y: 420, r: 20, ci: 2, parentId: 0, delay: 800  }, // green   left-lower
  { id: 3,  x: 520, y: 168, r: 20, ci: 3, parentId: 0, delay: 1160 }, // blue    top
  { id: 4,  x: 762, y: 195, r: 20, ci: 4, parentId: 0, delay: 1520 }, // gold    upper-right
  { id: 5,  x: 835, y: 355, r: 20, ci: 5, parentId: 0, delay: 1880 }, // teal    right
  { id: 6,  x: 698, y: 490, r: 20, ci: 6, parentId: 0, delay: 2240 }, // purple  lower-right
  { id: 7,  x: 362, y: 498, r: 20, ci: 7, parentId: 0, delay: 2600 }, // red     lower-left

  // L2 – orange
  { id: 8,  x: 235, y: 185, r: 13, ci: 1, parentId: 1, delay: 2960 },
  { id: 9,  x: 248, y: 325, r: 13, ci: 1, parentId: 1, delay: 3280 },

  // L2 – green
  { id: 10, x: 330, y: 422, r: 13, ci: 2, parentId: 2, delay: 3600 },
  { id: 11, x: 415, y: 522, r: 13, ci: 2, parentId: 2, delay: 3920 },

  // L2 – blue
  { id: 12, x: 415, y:  90, r: 13, ci: 3, parentId: 3, delay: 4240 },
  { id: 13, x: 625, y:  92, r: 13, ci: 3, parentId: 3, delay: 4560 },

  // L2 – gold
  { id: 14, x: 870, y: 130, r: 13, ci: 4, parentId: 4, delay: 4880 },
  { id: 15, x: 895, y: 248, r: 13, ci: 4, parentId: 4, delay: 5200 },

  // L2 – teal
  { id: 16, x: 942, y: 295, r: 13, ci: 5, parentId: 5, delay: 5520 },
  { id: 17, x: 952, y: 435, r: 13, ci: 5, parentId: 5, delay: 5840 },

  // L2 – purple
  { id: 18, x: 790, y: 565, r: 13, ci: 6, parentId: 6, delay: 6160 },
  { id: 19, x: 620, y: 565, r: 13, ci: 6, parentId: 6, delay: 6480 },

  // L2 – red
  { id: 20, x: 250, y: 468, r: 13, ci: 7, parentId: 7, delay: 6800 },
  { id: 21, x: 288, y: 568, r: 13, ci: 7, parentId: 7, delay: 7120 },

  // L3 – one deep terminal per cluster
  { id: 22, x: 152, y: 148, r:  9, ci: 1, parentId:  8, delay: 7440 },
  { id: 23, x: 365, y: 602, r:  9, ci: 2, parentId: 11, delay: 7760 },
  { id: 24, x: 338, y:  32, r:  9, ci: 3, parentId: 12, delay: 8080 },
  { id: 25, x: 960, y:  68, r:  9, ci: 4, parentId: 14, delay: 8400 },
  { id: 26, x:1040, y: 495, r:  9, ci: 5, parentId: 17, delay: 8720 },
  { id: 27, x: 862, y: 630, r:  9, ci: 6, parentId: 18, delay: 9040 },
  { id: 28, x: 148, y: 530, r:  9, ci: 7, parentId: 20, delay: 9360 },
]

/* ── Dashed cross-connection arcs ─────────────────────────────────────── */
const ARCS = [
  { id: 'a0', x1: 360, y1: 248, x2: 762, y2: 195, cx: 560, cy:  80, ci: 4, dur: 3.8 },
  { id: 'a1', x1: 362, y1: 498, x2: 445, y2: 420, cx: 370, cy: 448, ci: 2, dur: 2.6 },
  { id: 'a2', x1: 698, y1: 490, x2: 835, y2: 355, cx: 820, cy: 475, ci: 5, dur: 3.1 },
  { id: 'a3', x1: 520, y1: 168, x2: 835, y2: 355, cx: 790, cy: 168, ci: 3, dur: 3.5 },
]

const LINE_MS = 600

/* ── Person icon ──────────────────────────────────────────────────────── */
function Icon({ r, color = 'white' }: { r: number; color?: string }) {
  const hr = r * 0.34, bw = r * 0.56
  return (
    <g fill={color} opacity={0.95}>
      <circle cx={0} cy={-r * 0.2} r={hr}/>
      <path d={`M ${-bw} ${r * 0.44} C ${-bw} ${-r * 0.08} ${bw} ${-r * 0.08} ${bw} ${r * 0.44} Z`}/>
    </g>
  )
}

type Ph = 'placed' | 'visible'
interface AN { id: number; ph: Ph }
interface AE { id: number; on: boolean }
interface Props { reduced?: boolean }

export default function ConnectionGraphic({ reduced = false }: Props) {
  const nodesA  = useRef<AN[]>([])
  const edgesA  = useRef<AE[]>([])
  const fadeOut = useRef(false)
  const [, re]  = useReducer((c: number) => c + 1, 0)
  const flush   = (fn: () => void) => { fn(); re() }

  useEffect(() => {
    if (reduced) {
      nodesA.current  = DEFS.map(d => ({ id: d.id, ph: 'visible' as Ph }))
      edgesA.current  = DEFS.filter(d => d.parentId !== null).map((_, i) => ({ id: i, on: true }))
      fadeOut.current = false
      re()
      return
    }

    const ts: ReturnType<typeof setTimeout>[] = []
    const t = (f: () => void, ms: number) => { ts.push(setTimeout(f, ms)) }
    const clearTs = () => { ts.forEach(clearTimeout); ts.length = 0 }

    function run() {
      clearTs()
      flush(() => { nodesA.current = []; edgesA.current = []; fadeOut.current = false })

      t(() => {
        flush(() => nodesA.current.push({ id: 0, ph: 'placed' }))
        t(() => flush(() => { const n = nodesA.current[0]; if (n) n.ph = 'visible' }), 55)
      }, DEFS[0].delay)

      DEFS.slice(1).forEach((nd, idx) => {
        t(() => {
          flush(() => edgesA.current.push({ id: idx, on: false }))
          requestAnimationFrame(() => requestAnimationFrame(() => {
            flush(() => { const e = edgesA.current.find(e => e.id === idx); if (e) e.on = true })
          }))
        }, nd.delay)
        t(() => {
          flush(() => nodesA.current.push({ id: nd.id, ph: 'placed' }))
          t(() => flush(() => {
            const n = nodesA.current.find(n => n.id === nd.id)
            if (n) n.ph = 'visible'
          }), 55)
        }, nd.delay + LINE_MS + 80)
      })

      const last = DEFS[DEFS.length - 1].delay + LINE_MS + 2600
      t(() => { flush(() => { fadeOut.current = true }); t(run, 950) }, last)
    }

    run()
    return clearTs
  }, [reduced])

  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
      style={{
        opacity: fadeOut.current ? 0 : 1,
        transition: fadeOut.current ? 'opacity 0.9s ease-in' : 'none',
      }}
    >
      <defs>
        <radialGradient id="csBg" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#0d2a4e"/>
          <stop offset="100%" stopColor="#020c1b"/>
        </radialGradient>
        <filter id="csGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="csCenterGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="1200" height="700" fill="url(#csBg)"/>

      {/* (world-map dots removed) */}

      {/* Dashed arc cross-connections with animated traveling dot */}
      {ARCS.map(arc => {
        const d = `M ${arc.x1} ${arc.y1} Q ${arc.cx} ${arc.cy} ${arc.x2} ${arc.y2}`
        return (
          <g key={arc.id}>
            <path d={d} fill="none" stroke={PALETTE[arc.ci].fill}
              strokeWidth="1.4" opacity="0.38" strokeDasharray="8 6"/>
            <circle r="3.5" fill={PALETTE[arc.ci].fill} opacity="0.9"
              className="cs-arc-dot"
              style={{ offsetPath: `path('${d}')`, animationDuration: `${arc.dur}s` }}/>
          </g>
        )
      })}

      {/* Tree edges */}
      {DEFS.slice(1).map((nd, idx) => {
        const ea = edgesA.current.find(e => e.id === idx)
        if (!ea) return null
        const par = DEFS.find(d => d.id === nd.parentId)!
        const len = Math.hypot(nd.x - par.x, nd.y - par.y)
        return (
          <line key={`e${idx}`}
            className={`cs-net-line${ea.on ? ' cs-net-on' : ''}`}
            x1={par.x} y1={par.y} x2={nd.x} y2={nd.y}
            stroke="#e0f7fa" strokeWidth="1.4" strokeLinecap="round" opacity={0.75}
            style={{ '--len': len } as React.CSSProperties}/>
        )
      })}

      {/* Nodes */}
      {DEFS.map(nd => {
        const na = nodesA.current.find(n => n.id === nd.id)
        if (!na) return null
        const { fill, icon } = PALETTE[nd.ci]
        const vis = na.ph === 'visible'

        return (
          <g key={`n${nd.id}`} transform={`translate(${nd.x},${nd.y})`}>
            <g
              className={`cs-net-node${vis ? ' cs-net-vis' : ''}`}
            >
              {/* Solid filled circle */}
              <circle r={nd.r} fill={fill}/>

              {/* Person icon */}
              <Icon r={nd.r} color={icon}/>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
