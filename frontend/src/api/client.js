import axios from 'axios'
import { useStore } from '../store'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const login             = (u, p)       => api.post('/auth/login', { username: u, password: p })
export const register          = (data)        => api.post('/auth/register', data)
export const getAirports       = ()            => api.get('/airports')
export const getAirportPOIs    = (id, params)  => api.get(`/airports/${id}/pois`, { params })
export const getNavGraph       = (id)          => api.get(`/airports/${id}/graph`)
export const getRoute          = (body)        => api.post('/route', body)
export const createSession     = (body)        => api.post('/sessions', body)
export const getSession        = (id)          => api.get(`/sessions/${id}`)
export const updateSession     = (id, body)    => api.patch(`/sessions/${id}`, body)
export const postIMUBatch      = (id, readings)=> api.post(`/sessions/${id}/imu`, { readings })
export const postStep          = (id, body)    => api.post(`/sessions/${id}/steps`, body)
export const getReplayTracks   = (airportId)   => api.get('/replay/tracks', { params: { airport_id: airportId } })
export const startReplay       = (body)        => api.post('/replay/start', body)
export const stopReplay        = (sid)         => api.post(`/replay/stop/${sid}`)
export const enrollFace        = (body)        => api.post('/identity/enroll-face', body)
export const getFaceDescriptor = (uid)         => api.get(`/identity/face-descriptor/${uid}`)
export const submitDocument    = (body)        => api.post('/identity/document', body)
export const issueToken        = (flightNum)   => api.post('/identity/issue-token', { flight_number: flightNum })
export const getIdentityStatus = ()            => api.get('/identity/status')
export const verifyAtTouchpoint = (tpId, body) => api.post(`/touchpoints/${tpId}/verify`, body)
export const getFlights        = (params)      => api.get('/flights', { params })
export const subscribeFlight   = (id)          => api.post(`/flights/${id}/subscribe`)
export const getMyFlights      = ()            => api.get('/flights/subscribed')
export const getAccessProfile  = (key)         => api.get('/accessibility', { params: { device_key: key } })
export const updateAccessProfile = (body)      => api.put('/accessibility', body)
export const getHapticPatterns = ()            => api.get('/haptic-patterns')

export default api
