import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { consola } from 'consola'
import c from 'picocolors'
import { version } from '../package.json'
import { loadConfig, partitionTiers } from './config'
import { base64ToArrayBuffer, pngToDataUri, resolveAvatars, round, svgToPng } from './image'
import { SvgComposer, generateBadge } from './svg'
import { presets } from './presets'
import type { Sponsor, SponsorkitConfig, Sponsorship } from './types'
import { guessProviders, resolveProviders } from './providers'
import { customAddUser } from './customAddUser'

function r(path: string) {
  return `./${relative(process.cwd(), path)}`
}

export async function run(inlineConfig?: SponsorkitConfig, t = consola) {
  t.log(`\n${c.magenta(c.bold('SponsorKit'))} ${c.dim(`v${version}`)}\n`)
  const config = await loadConfig(inlineConfig)
  const type = config.type || 'tiers'
  const dir = resolve(process.cwd(), config.outputDir)
  const cacheFile = resolve(dir, config.cacheFile)
  const providers = resolveProviders(config.providers || guessProviders(config))

  let allSponsors: Sponsorship[] = []
  if (!fs.existsSync(cacheFile) || config.force) {
    for (const i of providers) {
      t.info(`Fetching sponsorships from ${i.name}...`)
      let sponsors: any[] = []
      try {
        sponsors = await i.fetchSponsors(config)
      }
      catch (error) {

      }
      sponsors.forEach(s => s.provider = i.name)
      sponsors = await config.onSponsorsFetched?.(sponsors, i.name) || sponsors
      t.success(`${sponsors.length} sponsorships fetched from ${i.name}`)
      allSponsors.push(...sponsors)
    }

    t.info('Resolving avatars...')
    await resolveAvatars(allSponsors, config.fallbackAvatar, t)
    t.success('Avatars resolved')

    await fs.ensureDir(dirname(cacheFile))
    await fs.writeJSON(cacheFile, allSponsors, { spaces: 2 })
  }
  else {
    allSponsors = await fs.readJSON(cacheFile)
    t.success(`Loaded from cache ${r(cacheFile)}`)
  }

  // Sort
  allSponsors.sort((a, b) =>
    b.monthlyDollars - a.monthlyDollars // DESC amount
    || Date.parse(b.createdAt!) - Date.parse(a.createdAt!) // DESC date
    || (b.sponsor.login || b.sponsor.name).localeCompare(a.sponsor.login || a.sponsor.name), // ASC name
  )

  await fs.ensureDir(dir)
  if (config.formats?.includes('json')) {
    const path = join(dir, `${config.name}.json`)
    await fs.writeJSON(path, allSponsors, { spaces: 2 })
    t.success(`Wrote to ${r(path)}`)
  }

  allSponsors = await config.onSponsorsReady?.(allSponsors) || allSponsors
  if (config.filter)
    allSponsors = allSponsors.filter(s => config.filter(s, allSponsors) !== false)
  if (!config.includePrivate)
    allSponsors = allSponsors.filter(s => s.privacyLevel !== 'PRIVATE')

  t.info('Composing SVG...')
  const composer = new SvgComposer(config)
  if (config.customGithubUser) {
    const customSponsors = await customAddUser(config.customGithubUser)
    await resolveAvatars(customSponsors, config.fallbackAvatar, t)
    allSponsors.push(...customSponsors)
  }
  let svg
  if (type === 'tiers') {
    await (config.customComposer || defaultComposer)(composer, allSponsors, config)

    svg = composer.generateSvg()

    svg = await config.onSvgGenerated?.(svg) || svg
  }
  else {
    const { hierarchy, pack } = await import('d3-hierarchy')
    const composer = new SvgComposer(config)

    const amountMax = Math.max(...allSponsors.map(sponsor => sponsor.monthlyDollars))
    const {
      radiusMax = 300,
      radiusMin = 10,
      radiusPast = 5,
      weightInterop = defaultInterop,
    } = config.circles || {}

    function defaultInterop(sponsor: Sponsorship) {
      return sponsor.monthlyDollars < 0
        ? radiusPast
        : lerp(radiusMin, radiusMax, (Math.max(0.1, sponsor.monthlyDollars || 0) / amountMax) ** 0.9)
    }

    if (!config.includePastSponsors)
      allSponsors = allSponsors.filter(sponsor => sponsor.monthlyDollars > 0)

    const root = hierarchy({ ...allSponsors[0], children: allSponsors, id: 'root' })
      .sum(d => weightInterop(d, amountMax))
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const p = pack<typeof sponsors[0]>()
    p.size([config.width, config.width])
    p.padding(config.width / 400)
    const circles = p(root as any).descendants().slice(1)

    for (const circle of circles) {
      composer.addRaw(generateBadge(
        circle.x - circle.r,
        circle.y - circle.r,
        await getRoundedAvatars(circle.data.sponsor),
        {
          name: false,
          boxHeight: circle.r * 2,
          boxWidth: circle.r * 2,
          avatar: {
            size: circle.r * 2,
          },
        },
      ))
    }

    composer.height = config.width

    svg = composer.generateSvg()
  }
  if (config.formats?.includes('svg')) {
    const path = join(dir, `${config.name}.svg`)
    await fs.writeFile(path, svg, 'utf-8')
    t.success(`Wrote to ${r(path)}`)
  }

  if (config.formats?.includes('png')) {
    const path = join(dir, `${config.name}.png`)
    await fs.writeFile(path, await svgToPng(svg))
    t.success(`Wrote to ${r(path)}`)
  }

  function lerp(a: number, b: number, t: number) {
    if (t < 0)
      return a
    return a + (b - a) * t
  }

  async function getRoundedAvatars(sponsor: Sponsor) {
    if (!sponsor.avatarBuffer || sponsor.type === 'User')
      return sponsor

    const data = base64ToArrayBuffer(sponsor.avatarBuffer)
    /// keep-sorted
    return {
      ...sponsor,
      avatarUrlHighRes: pngToDataUri(await round(data, 0.5, 120)),
      avatarUrlLowRes: pngToDataUri(await round(data, 0.5, 50)),
      avatarUrlMediumRes: pngToDataUri(await round(data, 0.5, 80)),
    }
  }
}

export async function defaultComposer(composer: SvgComposer, sponsors: Sponsorship[], config: SponsorkitConfig) {
  const tierPartitions = partitionTiers(sponsors, config.tiers!)

  composer.addSpan(config.padding?.top ?? 20)

  tierPartitions
    .forEach(({ tier: t, sponsors }) => {
      t.composeBefore?.(composer, sponsors, config)
      if (t.compose) {
        t.compose(composer, sponsors, config)
      }
      else {
        const preset = t.preset || presets.base
        if (sponsors.length && preset.avatar.size) {
          const paddingTop = t.padding?.top ?? 20
          const paddingBottom = t.padding?.bottom ?? 10
          if (paddingTop)
            composer.addSpan(paddingTop)
          if (t.title) {
            composer
              .addTitle(t.title)
              .addSpan(5)
          }
          composer.addSponsorGrid(sponsors, preset)
          if (paddingBottom)
            composer.addSpan(paddingBottom)
        }
      }
      t.composeAfter?.(composer, sponsors, config)
    })

  composer.addSpan(config.padding?.bottom ?? 20)
}
