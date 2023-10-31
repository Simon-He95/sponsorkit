import { defineConfig, presets } from 'sponsorkit'
import type { Sponsorship } from '../src'
import { customAddUser } from '../src/customAddUser'

const customSponsors = [{
  user: 'simon',
  monthlyDollars: 1,
}, {
  user: 'even_you',
  monthlyDollars: 1,
}, {
  user: 'simon',
  monthlyDollars: 1,
}]
export default defineConfig({
  // includePrivate: true,
  tiers: [
    {
      title: 'Past Sponsors',
      monthlyDollars: -1,
      preset: presets.xs,
    },
    {
      title: 'Backers',
      // to replace the entire tier rendering
      // compose: (composer, tierSponsors, config) => {
      //   composer.addRaw(
      //     '<-- custom svg -->',
      //   )
      // },
    },
    {
      title: 'Sponsors',
      monthlyDollars: 10,
      preset: presets.medium,
      // to insert custom elements after the tier block
      composeAfter: (composer, _tierSponsors, _config) => {
        composer.addSpan(10)
      },
    },
    {
      title: 'Silver Sponsors',
      monthlyDollars: 50,
      preset: presets.large,
    },
    {
      title: 'Gold Sponsors',
      monthlyDollars: 100,
      preset: presets.xl,
    },
  ],
  async customComposer(composer, sponsorships: Sponsorship[], config) {
    composer.addSpan(100)

    composer
      .addTitle('Sponsors')
      .addSpan(5)

    sponsorships.push(...await customAddUser(customSponsors))
    composer.addSponsorGrid(sponsorships, config.tiers[2].preset)
  },
})
