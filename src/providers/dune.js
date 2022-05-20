/* eslint-disable prefer-destructuring */
const axios = require('axios')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const utils = require('../utils')

class DuneAnalytics {
  constructor(username, password) {
    this.duneUsername = username
    this.dunePassword = password
    const jar = new CookieJar()
    this.baseUrl = 'https://dune.xyz'
    this.axiosBase = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        withCredentials: true,
        timeout: 180000,
        headers: {
          origin: this.baseUrl,
          dnt: '1',
          accept:
            'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'content-type': 'application/json;charset=utf-8',
          'sec-ch-ua': '"Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'upgrade-insecure-requests': '1'
        },
        jar
      })
    )

    this.axiosGraph = axios.create({
      baseURL: 'https://core-hsr.duneanalytics.com/v1/graphql',
      timeout: 180000
    })
  }

  async fetchAuthRefreshToken() {
    try {
      const csrfResp = await this.axiosBase.post('api/auth/csrf')
      const authResp = await this.axiosBase.post('/api/auth', {
        action: 'login',
        username: this.duneUsername,
        password: this.dunePassword,
        csrf: csrfResp.data.csrf,
        next: this.baseUrl
      })

      const cookieItems = authResp.request._headers.cookie.split(';')
      cookieItems.some(items => {
        const cookie = items.split('=')
        this.authRefreshKey = cookie[1]
        return cookie[0] === 'auth-refresh'
      })
      console.log(`Auth-Refresh-Token: ${this.authRefreshKey}`)
    } catch (e) {
      console.log(e.message)
    }
  }

  async fetchAuthToken() {
    try {
      if (!this.authRefreshKey) {
        await this.fetchAuthRefreshToken()
      }

      if (this.authRefreshKey) {
        const response = await this.axiosBase.post('/api/auth/session')
        return response.data.token
      }
    } catch (e) {
      console.log(e.message)
    }

    return null
  }

  async executeQuery(authToken, queryId, params) {
    console.log('Executing query ... ')

    const queryData = {
      operationName: 'ExecuteQuery',
      variables: {
        query_id: queryId,
        parameters: params
      },
      query: `
        mutation ExecuteQuery($query_id: Int!, $parameters: [Parameter!]!) {
          execute_query(query_id: $query_id, parameters: $parameters) {
            job_id
            __typename
          }
        }
      `
    }

    return this.axiosGraph
      .post('', queryData, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      .then(({ data }) => {
        if (data.errors) {
          console.log(JSON.stringify(data.errors))
          return null
        }

        return data.data.execute_query.job_id
      })
      .catch(e => {
        console.log(e)
        return null
      })
  }

  async getQueryResultByJobId(authToken, jobId) {
    console.log(`Fetching query result by jobID: ${jobId}`)

    const queryData = {
      operationName: 'FindResultDataByJob',
      variables: { job_id: jobId },
      query: `
        query FindResultDataByJob($job_id: uuid!) {
          query_results(where: {job_id: {_eq: $job_id}, error: {_is_null: true}}) {
            id
            job_id
            runtime
            generated_at
            columns
            __typename
          }
          query_errors(where: {job_id: {_eq: $job_id}}) {
            id
            job_id
            runtime
            message
            metadata
            type
            generated_at
            __typename
          }
          get_result_by_job_id(args: {want_job_id: $job_id}) {
            data
            __typename
          }
        }
      `
    }

    return this.axiosGraph
      .post('', queryData, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      .then(({ data }) => {
        if (data.errors) {
          console.log(JSON.stringify(data.errors))
          return { query_results: [] }
        }

        return data.data
      })
      .catch(e => {
        console.log(e)
        return { query_results: [] }
      })
  }

  async getQueryResults(queryId, params) {

    const authToken = await this.fetchAuthToken()

    if (authToken) {
      const jobId = await this.executeQuery(authToken, queryId, params)

      if (jobId) {
        let response = []
        for (let lc = 0; lc <= 40; lc += 1) {
          response = await this.getQueryResultByJobId(authToken, jobId)
          if (response.query_results.length > 0) {
            return response.get_result_by_job_id.map(i => i.data)
          }
          await utils.sleep(8000)
        }
      }
    }

    return []
  }

  async getAddressStats(dateFrom) {
    const params = [{ key: 'date_from', type: 'text', value: dateFrom }]
    return this.getQueryResults(756108, params)
  }

  async getTopNftCollections(limit = 100) {
    const params = [{ key: 'top', type: 'number', value: `${limit}` }]
    return this.getQueryResults(785004, params)
  }
}

module.exports = new DuneAnalytics(process.env.DUNE_USERNAME, process.env.DUNE_PASSWORD)
