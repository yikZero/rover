import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'

const width = 1200
const height = 630

const interRegular = await fetch(
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff',
).then((res) => res.arrayBuffer())

const interSemiBold = await fetch(
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.woff',
).then((res) => res.arrayBuffer())

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#fafafa',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'svg',
          props: {
            width: '56',
            height: '56',
            viewBox: '0 0 32 32',
            children: {
              type: 'rect',
              props: {
                width: '32',
                height: '32',
                rx: '8',
                fill: '#171717',
              },
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '56px',
                    fontWeight: 600,
                    color: '#0a0a0a',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  },
                  children: 'Rover',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '22px',
                    fontWeight: 400,
                    color: '#737373',
                    lineHeight: 1.4,
                  },
                  children:
                    'AI-curated daily tech digest',
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: interRegular,
        weight: 400,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: interSemiBold,
        weight: 600,
        style: 'normal' as const,
      },
    ],
  },
)

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: width * 2 },
})

const pngData = resvg.render()
const pngBuffer = pngData.asPng()

writeFileSync('public/og-image.png', pngBuffer)
console.log(`Generated OG image: public/og-image.png (${pngBuffer.length} bytes)`)
