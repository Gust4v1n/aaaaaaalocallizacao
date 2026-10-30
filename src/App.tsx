import { useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import './App.css'

interface LocationResult {
  latitude: number
  longitude: number
  accuracy?: number
  source: 'GPS' | 'IP'
  info?: string
}

export default function App() {
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [source, setSource] = useState<'GPS' | 'IP' | null>(null)
  const [locationDetail, setLocationDetail] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [loadingMessage, setLoadingMessage] = useState('Buscando localização...')
  const [errorMsg, setErrorMsg] = useState('')
  const [warningMsg, setWarningMsg] = useState('')

  // Requisição de permissão nativa para Android
  const ensurePermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      return
    }

    try {
      const check = await Geolocation.checkPermissions()
      if (check.location === 'granted' || check.coarseLocation === 'granted') {
        return
      }

      const request = await Geolocation.requestPermissions()
      if (request.location === 'denied' && request.coarseLocation === 'denied') {
        throw new Error('PERMISSION_DENIED')
      }
    } catch (e: unknown) {
      console.warn('Erro ao checar/solicitar permissão:', e)
    }
  }

  // Fallback via IP (funciona mesmo sem satélite/GPS/permissão)
  const fetchLocationByIP = async (): Promise<LocationResult> => {
    setLoadingMessage('Consultando localização via IP...')

    // 1ª tentativa: ipwho.is
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 6000)
      const res = await fetch('https://ipwho.is/', { signal: controller.signal })
      clearTimeout(t)
      const data = await res.json()
      if (data && data.success !== false && data.latitude && data.longitude) {
        const place = [data.city, data.region, data.country].filter(Boolean).join(', ')
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: 2500, // Raio aproximado de IP
          source: 'IP',
          info: place || 'Rede / Provedor de Internet'
        }
      }
    } catch (e) {
      console.warn('Falha no ipwho.is, tentando freeipapi...', e)
    }

    // 2ª tentativa: freeipapi.com
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 6000)
      const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal })
      clearTimeout(t)
      const data = await res.json()
      if (data && data.latitude && data.longitude) {
        const place = [data.cityName, data.regionName, data.countryName].filter(Boolean).join(', ')
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          accuracy: 5000,
          source: 'IP',
          info: place || 'Rede / Provedor de Internet'
        }
      }
    } catch (e) {
      console.warn('Falha no freeipapi...', e)
    }

    throw new Error('Não foi possível obter a localização nem via GPS nem via IP.')
  }

  // Captura via GPS nativo com timeout inteligente
  const fetchLocationByGPS = async (): Promise<LocationResult> => {
    await ensurePermission()

    setLoadingMessage('Conectando ao hardware de GPS...')

    // Tenta alta precisão primeiro (timeout curto para não travar a UI)
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      })
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        source: 'GPS',
        info: 'Hardware GPS (Alta Precisão)'
      }
    } catch (highErr) {
      console.warn('GPS alta precisão falhou, tentando modo de rede/coarse...', highErr)
    }

    // Tenta baixa precisão (torres celulares / Wi-Fi)
    setLoadingMessage('Tentando localização por rede/antenas...')
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 30000,
    })

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      source: 'GPS',
      info: 'GPS / Rede Móvel'
    }
  }

  const applyLocation = (loc: LocationResult) => {
    setLatitude(loc.latitude)
    setLongitude(loc.longitude)
    setAccuracy(loc.accuracy || null)
    setSource(loc.source)
    setLocationDetail(loc.info || null)
    setTimestamp(new Date().toLocaleString('pt-BR'))
    setStatus('success')
  }

  // Fluxo principal: tenta GPS, e se der erro/timeout faz fallback automático por IP
  const getLocation = useCallback(async (preferIP = false) => {
    setStatus('loading')
    setErrorMsg('')
    setWarningMsg('')

    if (preferIP) {
      try {
        const ipLoc = await fetchLocationByIP()
        applyLocation(ipLoc)
        setWarningMsg('Localização obtida com sucesso via IP.')
      } catch (err: unknown) {
        setStatus('error')
        const message = err instanceof Error ? err.message : String(err)
        setErrorMsg(`❌ Erro ao obter por IP: ${message}`)
      }
      return
    }

    // Tenta GPS primeiro
    try {
      const gpsLoc = await fetchLocationByGPS()
      applyLocation(gpsLoc)
    } catch (gpsError: unknown) {
      console.warn('GPS indisponível ou tempo esgotado. Iniciando fallback por IP...', gpsError)
      setWarningMsg('⚠️ GPS demorou ou sem sinal. Buscando localização por IP...')

      // Fallback para IP
      try {
        const ipLoc = await fetchLocationByIP()
        applyLocation(ipLoc)
        setWarningMsg('⚠️ GPS indisponível no momento. Coordenadas aproximadas obtidas via IP com sucesso!')
      } catch (ipError: unknown) {
        setStatus('error')
        const msg = ipError instanceof Error ? ipError.message : String(ipError)
        setErrorMsg(`❌ Não foi possível obter localização: ${msg}`)
      }
    }
  }, [])

  const openGoogleMaps = () => {
    if (latitude && longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      window.open(url, '_blank')
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'idle':
        return { text: '📍 Pronto', className: 'idle' }
      case 'loading':
        return { text: `🔄 ${loadingMessage}`, className: 'loading' }
      case 'success':
        return {
          text: source === 'GPS' ? '🛰️ GPS Ativo' : '🌐 Localizado via IP',
          className: 'success'
        }
      case 'error':
        return { text: '❌ Erro', className: 'error' }
      default:
        return { text: '📍 Pronto', className: 'idle' }
    }
  }

  const statusInfo = getStatusLabel()

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>📍 GeoApp</h1>
        <p>Captura de Coordenadas (GPS + Fallback IP)</p>
        <div className={`status-badge ${statusInfo.className}`}>
          {status === 'loading' && <div className="spinner"></div>}
          {statusInfo.text}
        </div>
      </div>

      {/* Alerta de Aviso (Ex: Fallback ativado) */}
      {warningMsg && (
        <div className="card notice-card">
          <div className="notice-box">
            <span className="icon">ℹ️</span>
            <span>{warningMsg}</span>
          </div>
        </div>
      )}

      {/* Erro */}
      {errorMsg && (
        <div className="card">
          <div className="error-box">
            <span className="icon">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Coordenadas */}
      <div className="card">
        <div className="card-header-flex">
          <div className="card-title">📊 Coordenadas Capturadas</div>
          {source && (
            <span className={`source-tag ${source.toLowerCase()}`}>
              {source === 'GPS' ? '🛰️ Hardware GPS' : '🌐 Rede / IP'}
            </span>
          )}
        </div>

        <div className="coord-grid">
          <div className="coord-item">
            <div className="coord-label">Latitude</div>
            <div className={`coord-value ${latitude === null ? 'empty' : ''}`}>
              {latitude !== null ? latitude.toFixed(6) : '---'}
            </div>
          </div>
          <div className="coord-item">
            <div className="coord-label">Longitude</div>
            <div className={`coord-value ${longitude === null ? 'empty' : ''}`}>
              {longitude !== null ? longitude.toFixed(6) : '---'}
            </div>
          </div>
          <div className="coord-item full-width">
            <div className="coord-label">
              Precisão {source === 'IP' ? '(Aproximada por Cidade/IP)' : '(Hardware GPS)'}
            </div>
            <div className={`coord-value ${accuracy === null ? 'empty' : ''}`}>
              {accuracy !== null
                ? source === 'IP'
                  ? `± ${(accuracy / 1000).toFixed(1)} km (Região)`
                  : `± ${accuracy.toFixed(1)} m`
                : '---'}
            </div>
          </div>
          {locationDetail && (
            <div className="coord-item full-width detail-item">
              <div className="coord-label">Origem dos Dados</div>
              <div className="detail-text">{locationDetail}</div>
            </div>
          )}
        </div>

        {timestamp && (
          <div className="timestamp">
            🕐 Capturado em: {timestamp}
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="card">
        <div className="btn-group">
          <button
            className="btn btn-primary"
            onClick={() => getLocation(false)}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <div className="spinner"></div>
                {loadingMessage}
              </>
            ) : (
              <>📡 Obter Localização (GPS com Auto-IP)</>
            )}
          </button>

          <button
            className="btn btn-secondary-ip"
            onClick={() => getLocation(true)}
            disabled={status === 'loading'}
          >
            🌐 Buscar Direto por IP (Rápido)
          </button>

          {latitude !== null && longitude !== null && (
            <button
              className="btn btn-success"
              onClick={openGoogleMaps}
            >
              🗺️ Abrir no Google Maps
            </button>
          )}
        </div>
      </div>

      {/* Mapa / Card Informativo */}
      {latitude !== null && longitude !== null && (
        <div className="card">
          <div className="card-title">🗺️ Visualização no Mapa</div>
          <div className="map-placeholder">
            <div className="icon">🌍</div>
            <p>
              Localização atual: <strong>{latitude.toFixed(4)}, {longitude.toFixed(4)}</strong>
            </p>
            {locationDetail && <p className="sub-detail">{locationDetail}</p>}
            <button
              className="btn btn-outline map-cta"
              onClick={openGoogleMaps}
            >
              Abrir no Google Maps ↗
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        GeoApp • Capacitor + Geolocation + Fallback IP Geolocation
      </div>
    </div>
  )
}
