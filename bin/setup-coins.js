const { sleep } = require('../src/utils')
const coingecko = require('../src/providers/coingecko')
const sequelize = require('../src/db/sequelize')
const Coin = require('../src/db/models/Coin')
const Platform = require('../src/db/models/Platform')
const Language = require('../src/db/models/Language')

async function start() {
  await sequelize.sync()

  const languages = await Language.findAll()
  const coins = await fetchCoins()
  console.log('Fetched new coins')

  for (const coin of coins) {
    await fetchInfo(coin.coingecko_id, languages)
    await sleep(1100)
  }
}

async function fetchCoins(page = 1, limit = 4000) {
  const coinsPerPage = 250
  const coins = await coingecko.getMarkets(null, page, coinsPerPage)

  console.log(`Fetched coins ${coins.length}; Page: ${page}; Limit: ${limit}`)

  if (coins.length < coinsPerPage || coins.length >= limit) {
    return coins
  }

  return coins.concat(
    await fetchCoins(page + 1, limit - coinsPerPage)
  )
}

async function fetchInfo(id, languages) {
  console.log('fetching info for', id)

  try {
    const data = await coingecko.getCoinInfo(id)
    data.description = descriptionsMap(data.description, languages)

    const [coin] = await Coin.upsert(data)
    await createPlatform(coin, data.platforms)
  } catch (error) {
    console.log(error.message)
    const response = error.response
    if (response && response.status === 429) {
      await sleep(10000)
      await fetchInfo(id, languages)
    }
  }
}

async function createPlatform(coin, platforms) {
  switch (coin.uid) {
    case 'bitcoin':
    case 'ethereum':
    case 'binancecoin':
      return
  }

  for (const [platform, contract] of Object.entries(platforms)) {
    let type = platform
    if (type === '') {
      continue
    }

    switch (platform) {
      case 'ethereum':
        type = 'erc20'
        break
      case 'binancecoin':
        type = 'bep2'
        break
      case 'binance-smart-chain':
        type = 'bep20'
        break
    }

    try {
      await Platform.upsert({
        type: platform,
        reference: contract,
        decimal: 18, // todo: Need to fetch decimal number from appropriate sources
        coin_id: coin.id
      })
    } catch (err) {
      console.error(err)
    }
  }
}

function descriptionsMap(descriptions, languages) {
  return languages.reduce((memo, lang) => {
    memo[lang.code] = descriptions[lang.code]
    return memo
  }, {})
}

start()
  .catch(err => {
    console.log(err.stack)
  })
  .finally(() => {
    process.exit(0)
  })
