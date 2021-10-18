const { nullOrString, valueInCurrency } = require('../../utils')

function mapPlatforms(platforms) {
  return platforms.map(platform => ({
    type: platform.type,
    decimals: platform.decimals,
    address: platform.address,
    symbol: platform.symbol
  }))
}

function mapCoinAttribute(coin, field, currencyRate) {
  switch (field) {
    case 'name':
    case 'code':
    case 'coingecko_id':
      return coin[field]

    case 'price':
      return valueInCurrency(coin.price, currencyRate)
    case 'price_change_24h':
      return nullOrString(coin.price_change['24h'])
    case 'price_change_7d':
      return nullOrString(coin.price_change['7d'])
    case 'price_change_14d':
      return nullOrString(coin.price_change['14d'])
    case 'price_change_30d':
      return nullOrString(coin.price_change['30d'])
    case 'price_change_200d':
      return nullOrString(coin.price_change['200d'])
    case 'price_change_1y':
      return nullOrString(coin.price_change['1y'])
    case 'ath':
      return nullOrString(coin.price_change.ath)
    case 'atl':
      return nullOrString(coin.price_change.atl)
    case 'market_cap':
      return valueInCurrency(coin.market_data.market_cap, currencyRate)
    case 'market_cap_rank':
      return coin.market_data.market_cap_rank
    case 'total_volume':
      return valueInCurrency(coin.market_data.total_volume, currencyRate)
    case 'last_updated':
      return new Date(coin.last_updated).getTime()
    case 'platforms':
      return mapPlatforms(coin.Platforms)

    default:
      return null
  }
}

exports.serializeList = (coins, fields, currencyRate) => {
  return coins.map(item => {
    const coin = {
      uid: item.uid
    }

    fields.forEach(attribute => {
      coin[attribute] = mapCoinAttribute(item, attribute, currencyRate)
    })

    return coin
  })
}

exports.serializeShow = (coin, language, currencyPrice) => {
  const market = coin.market_data || {}

  return {
    uid: coin.uid,
    name: coin.name,
    code: coin.code,
    genesis_date: coin.genesis_date,
    description: coin.description[language],
    links: coin.links,
    price: valueInCurrency(coin.price, currencyPrice),
    market_data: {
      total_supply: nullOrString(market.total_supply),
      total_volume: valueInCurrency(market.total_volume, currencyPrice),
      market_cap: valueInCurrency(market.market_cap, currencyPrice),
      market_cap_rank: market.market_cap_rank,
      circulating_supply: nullOrString(market.circulating_supply),
      fully_diluted_valuation: valueInCurrency(market.fully_diluted_valuation, currencyPrice),
      total_value_locked: valueInCurrency(market.total_value_locked, currencyPrice)
    },
    performance: coin.performance,
    categories: coin.Categories.map(category => category.uid)
  }
}
