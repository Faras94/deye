/**
 * Cloudflare Worker for Deye Solar Monitor V2
 * Handles POST /api/collect to fetch live telemetry from DeyeCloud API
 * and store it into Supabase, while serving static frontend assets for all other routes.
 */

const STATE_MAP = {
  1: 'online',
  '1': 'online',
  NORMAL: 'online',
  ONLINE: 'online',
  2: 'alert',
  '2': 'alert',
  ALERT: 'alert',
  3: 'offline',
  '3': 'offline',
  OFFLINE: 'offline',
}

function normalizeStatus(raw) {
  if (raw === null || raw === undefined) return 'unknown'
  if (raw in STATE_MAP) return STATE_MAP[raw]
  return STATE_MAP[String(raw).trim().toUpperCase()] || 'unknown'
}

function toFloat(val) {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function normalizeTimestamp(rawTs) {
  if (rawTs === null || rawTs === undefined || rawTs === '') {
    return new Date().toISOString()
  }
  const num = Number(rawTs)
  if (Number.isFinite(num) && String(rawTs).trim() !== '') {
    const ms = num > 1e12 ? num : num * 1000
    return new Date(ms).toISOString()
  }
  const parsed = Date.parse(String(rawTs))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString()
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function supabaseFetch(supabaseUrl, serviceKey, path, options = {}) {
  const url = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const resp = await fetch(url, { ...options, headers })
  const text = await resp.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!resp.ok) {
    throw new Error(`Supabase ${resp.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }
  return data
}

async function verifyUserSession(request, supabaseUrl, serviceKey) {
  const authHeader = request.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'Missing Bearer token' }
  }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, reason: 'Empty Bearer token' }

  const resp = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
    },
  })
  if (resp.ok) return { ok: true }
  const errText = await resp.text().catch(() => '')
  return { ok: false, reason: `Auth ${resp.status}: ${errText.slice(0, 100)}` }
}

async function getDeyeToken(env, supabaseUrl, serviceKey, deyeBaseUrl, endpointCounts) {
  const nowSec = Date.now() / 1000
  try {
    const cached = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      'system_settings?select=value&key=eq.deye_token_cache&limit=1',
    )
    const val = cached?.[0]?.value
    if (val?.access_token && Number(val.expires_at) > nowSec + 60) {
      return val.access_token
    }
  } catch {
    // Ignore cache read failure
  }

  endpointCounts['/v1.0/account/token'] = (endpointCounts['/v1.0/account/token'] || 0) + 1
  const payload = {
    appSecret: env.DEYE_APP_SECRET.trim(),
    email: env.DEYE_EMAIL.trim(),
    password: await sha256Hex(env.DEYE_PASSWORD),
  }
  const companyId = Number(env.DEYE_COMPANY_ID || 0)
  if (companyId > 0) payload.companyId = companyId

  const tokenResp = await fetch(
    `${deyeBaseUrl}/v1.0/account/token?appId=${encodeURIComponent(env.DEYE_APP_ID.trim())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  const tokenData = await tokenResp.json()
  if (!tokenResp.ok || tokenData.success === false || !tokenData.accessToken) {
    throw new Error(`DeyeCloud auth failed: ${tokenData.msg || tokenResp.status}`)
  }

  const expiresIn = Number(tokenData.expiresIn || 3600)
  const expiresAt = nowSec + expiresIn
  try {
    await supabaseFetch(supabaseUrl, serviceKey, 'system_settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        key: 'deye_token_cache',
        value: { access_token: tokenData.accessToken, expires_at: expiresAt },
        description: 'Cached DeyeCloud access token to minimize auth API calls',
      }),
    })
  } catch {
    // Non-fatal
  }

  return tokenData.accessToken
}

async function handleLiveCollect(request, env) {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEYE_BASE_URL',
    'DEYE_APP_ID',
    'DEYE_APP_SECRET',
    'DEYE_EMAIL',
    'DEYE_PASSWORD',
  ]
  const missing = required.filter((k) => !env[k] || !String(env[k]).trim())
  if (missing.length > 0) {
    return jsonResponse(
      {
        error: `Cloudflare Worker missing secrets: ${missing.join(', ')}. Add them in Cloudflare Workers → Settings → Variables and Secrets.`,
      },
      503,
    )
  }

  const supabaseUrl = env.SUPABASE_URL.trim().replace(/\/+$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY.trim()

  const authCheck = await verifyUserSession(request, supabaseUrl, serviceKey)
  if (!authCheck.ok) {
    return jsonResponse(
      { error: `Unauthorized: please sign in to fetch live API data. (${authCheck.reason})` },
      401,
    )
  }

  let deyeBase = env.DEYE_BASE_URL.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
  if (!deyeBase.startsWith('http://') && !deyeBase.startsWith('https://')) {
    deyeBase = `https://${deyeBase}`
  }

  const startedAt = new Date().toISOString()
  const endpointCounts = {}
  let logId = null

  try {
    const logRows = await supabaseFetch(supabaseUrl, serviceKey, 'collection_logs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ started_at: startedAt, status: 'running' }),
    })
    logId = logRows?.[0]?.id ?? null

    const inverters = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      'inverters?select=*&is_active=eq.true&order=display_order.asc',
    )
    const panels = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      'panels?select=*&is_active=eq.true&order=channel_index.asc',
    )

    const invBySn = new Map((inverters || []).map((i) => [i.device_sn, i]))
    const deviceSns = Array.from(invBySn.keys())
    if (deviceSns.length === 0) {
      throw new Error('No active inverters configured in Supabase.')
    }

    const token = await getDeyeToken(env, supabaseUrl, serviceKey, deyeBase, endpointCounts)

    endpointCounts['/v1.0/device/latest'] = (endpointCounts['/v1.0/device/latest'] || 0) + 1
    const latestResp = await fetch(`${deyeBase}/v1.0/device/latest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceList: deviceSns }),
    })
    const latestData = await latestResp.json()
    if (!latestResp.ok || latestData.success === false) {
      throw new Error(`DeyeCloud /device/latest failed: ${latestData.msg || latestResp.status}`)
    }

    const items = latestData.deviceDataList || []
    const invRows = []
    const panelRows = []

    for (const item of items) {
      const sn = item.deviceSn
      const inv = invBySn.get(sn)
      if (!inv) continue

      const dataMap = {}
      for (const entry of item.dataList || []) {
        if (entry && entry.key) dataMap[String(entry.key)] = entry.value
      }

      const recordedAt = normalizeTimestamp(item.collectionTime)
      const status = normalizeStatus(item.deviceState)
      const powerW = toFloat(dataMap.TotalActiveACOutputPower)
      const dailyKwh = toFloat(dataMap.DailyActiveProduction)
      const monthlyKwh = toFloat(dataMap.MonthlyActiveProduction)
      const totalKwh = toFloat(dataMap.TotalActiveProduction)

      invRows.push({
        inverter_id: inv.id,
        device_sn: sn,
        recorded_at: recordedAt,
        power_w: powerW,
        daily_energy_kwh: dailyKwh,
        monthly_energy_kwh: monthlyKwh,
        total_energy_kwh: totalKwh,
        ac_voltage_v: toFloat(dataMap.ACVoltage1),
        ac_current_a: toFloat(dataMap.ACCurrent1),
        ac_frequency_hz: toFloat(dataMap.ACOutputFrequencyR),
        temperature_c: toFloat(dataMap.InverterTemperature),
        status,
        raw_payload: item,
      })

      await supabaseFetch(
        supabaseUrl,
        serviceKey,
        `inverters?device_sn=eq.${encodeURIComponent(sn)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, last_communication_at: recordedAt }),
        },
      )

      if (dailyKwh !== null) {
        const readingDate = recordedAt.slice(0, 10)
        await supabaseFetch(supabaseUrl, serviceKey, 'daily_energy?on_conflict=device_sn,reading_date', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            inverter_id: inv.id,
            device_sn: sn,
            reading_date: readingDate,
            energy_kwh: dailyKwh,
            peak_power_w: powerW,
          }),
        })
      }

      if (monthlyKwh !== null) {
        const yearMonth = recordedAt.slice(0, 7)
        await supabaseFetch(supabaseUrl, serviceKey, 'monthly_energy?on_conflict=device_sn,year_month', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            inverter_id: inv.id,
            device_sn: sn,
            year_month: yearMonth,
            energy_kwh: monthlyKwh,
          }),
        })
      }

      for (const panel of panels || []) {
        if (panel.inverter_id !== inv.id) continue
        const ch = Number(panel.channel_index)
        const pW = toFloat(dataMap[panel.deye_power_key || `DCPowerPV${ch}`])
        const vV = toFloat(dataMap[panel.deye_voltage_key || `DCVoltagePV${ch}`])
        const cA = toFloat(dataMap[panel.deye_current_key || `DCCurrentPV${ch}`])
        const tE = toFloat(dataMap[panel.deye_energy_key || `TotalProduction{ch}`.replace('{ch}', ch)])
        if (pW === null && vV === null && cA === null && tE === null) continue
        const ratedW = Number(panel.rated_capacity_w || 630)
        panelRows.push({
          panel_id: panel.id,
          inverter_id: inv.id,
          device_sn: sn,
          channel_index: ch,
          recorded_at: recordedAt,
          power_w: pW,
          voltage_v: vV,
          current_a: cA,
          daily_energy_kwh: null,
          total_energy_kwh: tE,
          performance_pct: pW !== null && ratedW > 0 ? Math.round((pW / ratedW) * 10000) / 100 : null,
          is_estimated: false,
        })
      }
    }

    if (invRows.length > 0) {
      await supabaseFetch(
        supabaseUrl,
        serviceKey,
        'inverter_readings?on_conflict=device_sn,recorded_at',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(invRows),
        },
      )
    }

    if (panelRows.length > 0) {
      await supabaseFetch(
        supabaseUrl,
        serviceKey,
        'panel_readings?on_conflict=panel_id,recorded_at',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(panelRows),
        },
      )
    }

    const totalCalls = Object.values(endpointCounts).reduce((a, b) => a + b, 0)
    const totalInserted = invRows.length + panelRows.length

    if (logId !== null) {
      await supabaseFetch(supabaseUrl, serviceKey, `collection_logs?id=eq.${logId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          finished_at: new Date().toISOString(),
          status: 'success',
          devices_queried: deviceSns.length,
          readings_inserted: totalInserted,
          api_calls_made: totalCalls,
          error_message: null,
          details: {
            endpoints: endpointCounts,
            inverter_readings: invRows.length,
            panel_readings: panelRows.length,
            trigger: 'live_button',
          },
        }),
      })
    }

    return jsonResponse({
      ok: true,
      devices_queried: deviceSns.length,
      readings_inserted: totalInserted,
      api_calls_made: totalCalls,
      endpoints: endpointCounts,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Collection failed'
    const totalCalls = Object.values(endpointCounts).reduce((a, b) => a + b, 0)
    if (logId !== null) {
      try {
        await supabaseFetch(supabaseUrl, serviceKey, `collection_logs?id=eq.${logId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            finished_at: new Date().toISOString(),
            status: 'failed',
            devices_queried: 0,
            readings_inserted: 0,
            api_calls_made: totalCalls,
            error_message: msg,
            details: { endpoints: endpointCounts, trigger: 'live_button' },
          }),
        })
      } catch {
        // Ignore log error
      }
    }
    return jsonResponse({ error: msg }, 500)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/collect') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405)
      }
      return handleLiveCollect(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
