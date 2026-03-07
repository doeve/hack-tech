import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../../store'

const CATEGORY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'gate', label: 'Gates' },
  { value: 'food', label: 'Food' },
  { value: 'restroom', label: 'Restrooms' },
  { value: 'checkin', label: 'Check-in' },
  { value: 'security', label: 'Security' },
  { value: 'lounge', label: 'Lounges' },
  { value: 'retail', label: 'Retail' },
  { value: 'charging', label: 'Charging' },
]

export default function SearchBar({ onSelectDestination }) {
  const { pois } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!pois?.length) return []
    return pois.filter((p) => {
      const matchCategory = !category || p.category === category
      const matchQuery = !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.gate_number && p.gate_number.toLowerCase().includes(query.toLowerCase()))
      return matchCategory && matchQuery
    })
  }, [pois, query, category])

  const handleSelect = (poi) => {
    setQuery(poi.name)
    setIsOpen(false)
    if (onSelectDestination) onSelectDestination(poi.poi_id || poi.id)
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search gates, food, restrooms..."
            className="w-full pl-10 pr-4 py-2.5 bg-white backdrop-blur-sm
                       border border-slate-200 rounded-xl text-sm text-slate-900
                       placeholder-slate-400 focus:outline-none focus:ring-2
                       focus:ring-[#1e3a8a]/30/50 focus:border-[#1e3a8a]/50"
          />
        </div>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setIsOpen(true) }}
          className="px-3 py-2.5 bg-white backdrop-blur-sm
                     border border-slate-200 rounded-xl text-sm text-slate-900
                     focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30/50"
        >
          {CATEGORY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white
                        backdrop-blur-sm border border-slate-200 rounded-xl
                        shadow-xl max-h-60 overflow-y-auto z-[1000]">
          {filtered.map((poi) => (
            <button
              key={poi.poi_id || poi.id}
              onClick={() => handleSelect(poi)}
              className="w-full px-4 py-3 text-left hover:bg-slate-100
                         flex items-center gap-3 border-b border-slate-200
                         last:border-b-0 transition-colors"
            >
              <span className="text-xs uppercase tracking-wider text-slate-500 w-16">
                {poi.category}
              </span>
              <span className="text-sm text-slate-900 flex-1">{poi.name}</span>
              {poi.gate_number && (
                <span className="text-xs bg-[#1e3a8a]/20 text-[#1e3a8a] px-2 py-0.5 rounded">
                  {poi.gate_number}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


