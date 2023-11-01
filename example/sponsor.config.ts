import { defineConfig, presets } from 'sponsorkit'

const customGithubUser = [{
  user: 'geekris1',
  monthlyDollars: 1,
}, {
  user: 'ShenQingchuan',
  monthlyDollars: 10000,
}, {
  user: 'yyx990803',
  monthlyDollars: 1000,
}, {
  user: 'antfu',
  monthlyDollars: 100,
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
  customGithubUser
})
