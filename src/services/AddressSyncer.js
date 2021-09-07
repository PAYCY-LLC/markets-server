const cron = require('node-cron')
const Address = require('../db/models/Address')
const bigquery = require('../db/bigquery')

class AddressSyncer {

  interval = '* */2 * * *' // every 2 hours
  initialSyncDate = '2021-09-01'

  async start() {
    const lastSyncDate = await this.getLastSyncDate()

    // This fetch is unnecessary for the app restart
    if (!this.isSameDay(lastSyncDate)) {
      await this.fetchAndSave(lastSyncDate)
    }

    // Schedule cron task
    cron.schedule(this.interval, this.sync.bind(this), {})
  }

  async sync() {
    const lastSyncDate = await this.getLastSyncDate()
    await this.fetchAndSave(lastSyncDate)
  }

  async fetchAndSave(fromDate) {
    const addresses = await bigquery.getAddresses(fromDate)

    await Address.bulkCreate(addresses, {
      updateOnDuplicate: ['count']
    })
  }

  async getLastSyncDate() {
    const address = await Address.getLast()
    return address ? address.date : new Date(this.initialSyncDate)
  }

  isSameDay(date) {
    const today = new Date()
    return (
      today.getFullYear() === date.getFullYear() &&
      today.getDate() === date.getDate() &&
      today.getMonth() === date.getMonth()
    )
  }

}

module.exports = AddressSyncer