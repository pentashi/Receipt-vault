// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import api from './api'
import { login } from './auth'

const respondWith = (status: number, data: unknown) => {
  api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) {
      return Promise.reject(Object.assign(new Error(`Request failed with status code ${status}`), { config, response }))
    }
    return Promise.resolve(response)
  }
}

describe('401 handling', () => {
  const location = { href: 'http://localhost:3000/' }

  beforeEach(() => {
    localStorage.clear()
    location.href = 'http://localhost:3000/'
    vi.stubGlobal('location', location)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the page and surfaces the error when login fails with a wrong password', async () => {
    respondWith(401, { message: 'Invalid email or password' })

    await expect(login('accountant@firm.ae', 'wrong')).rejects.toMatchObject({
      response: { status: 401, data: { message: 'Invalid email or password' } },
    })
    expect(location.href).toBe('http://localhost:3000/')
  })

  it('ends the session and returns to sign-in when an authenticated request gets a 401', async () => {
    localStorage.setItem('token', 'expired')
    localStorage.setItem('companyId', '1')
    location.href = 'http://localhost:3000/receipts'
    respondWith(401, { msg: 'Token has expired' })

    await expect(api.get('/receipts/')).rejects.toMatchObject({ response: { status: 401 } })
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('companyId')).toBeNull()
    expect(location.href).toBe('/')
  })
})
