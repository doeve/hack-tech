import { useState } from 'react'
import { useStore } from '../../store'
import api from '../../api/client'

export default function DocumentForm({ onComplete }) {
  const { setDocumentId } = useStore()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    document_type: 'passport',
    document_number: '',
    surname: '',
    given_names: '',
    dob: '',
    nationality_code: '',
    issuing_country: '',
    expiry_date: '',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { data } = await api.post('/identity/document', form)
      setDocumentId(data.document_id)
      if (onComplete) onComplete(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit document')
    } finally {
      setSubmitting(false)
    }
  }

<<<<<<< HEAD
  
  const inputClass = `w-full px-3 py-2.5 bg-coolWhite border border-gray-200
    rounded-lg text-sm text-anthracite placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-aviation/50 focus:border-aviation transition-all`

  const labelClass = `block text-[11px] font-bold text-aviation uppercase mb-1 tracking-wider`
=======
  const inputClass = `w-full px-3 py-2 bg-slate-100 border border-slate-300
    rounded-lg text-sm text-slate-900 placeholder-slate-400
    focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30/50`
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <header className="text-center mb-4">
        <div className="inline-block px-3 py-1 bg-aviation/10 text-aviation text-[10px] font-bold rounded-full">
          PDI SECURE ENROLLMENT
        </div>
      </header>

      <div>
<<<<<<< HEAD
        <label className={labelClass}>Document Type</label>
=======
        <label className="block text-xs text-slate-500 mb-1">Document Type</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        <select name="document_type" value={form.document_type}
          onChange={handleChange} className={inputClass}>
          <option value="passport">Passport</option>
          <option value="national_id">National ID</option>
          <option value="residence_permit">Residence Permit</option>
        </select>
      </div>

      <div>
<<<<<<< HEAD
        <label className={labelClass}>Document Number</label>
=======
        <label className="block text-xs text-slate-500 mb-1">Document Number</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        <input name="document_number" value={form.document_number}
          onChange={handleChange} placeholder="P123456789" className={inputClass} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
<<<<<<< HEAD
          <label className={labelClass}>Surname</label>
=======
          <label className="block text-xs text-slate-500 mb-1">Surname</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
          <input name="surname" value={form.surname}
            onChange={handleChange} placeholder="SMITH" className={inputClass} required />
        </div>
        <div>
<<<<<<< HEAD
          <label className={labelClass}>Given Names</label>
=======
          <label className="block text-xs text-slate-500 mb-1">Given Names</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
          <input name="given_names" value={form.given_names}
            onChange={handleChange} placeholder="JOHN" className={inputClass} required />
        </div>
      </div>

      <div>
<<<<<<< HEAD
        <label className={labelClass}>Date of Birth</label>
=======
        <label className="block text-xs text-slate-500 mb-1">Date of Birth</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        <input type="date" name="dob" value={form.dob}
          onChange={handleChange} className={inputClass} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
<<<<<<< HEAD
          <label className={labelClass}>Nationality</label>
=======
          <label className="block text-xs text-slate-500 mb-1">Nationality</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
          <input name="nationality_code" value={form.nationality_code}
            onChange={handleChange} placeholder="GB" maxLength={2} className={inputClass} required />
        </div>
        <div>
<<<<<<< HEAD
          <label className={labelClass}>Issuing Country</label>
=======
          <label className="block text-xs text-slate-500 mb-1">Issuing Country</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
          <input name="issuing_country" value={form.issuing_country}
            onChange={handleChange} placeholder="GB" maxLength={2} className={inputClass} required />
        </div>
      </div>

      <div>
<<<<<<< HEAD
        <label className={labelClass}>Expiry Date</label>
=======
        <label className="block text-xs text-slate-500 mb-1">Expiry Date</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        <input type="date" name="expiry_date" value={form.expiry_date}
          onChange={handleChange} className={inputClass} required />
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-red-600 text-xs font-medium">{error}</p>
        </div>
      )}

      <button type="submit" disabled={submitting}
<<<<<<< HEAD
        className="w-full py-3 bg-aviation hover:bg-aviation/90 disabled:bg-gray-300
                   text-white rounded-xl font-bold text-sm transition-all shadow-md">
=======
        className="w-full py-2.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 disabled:bg-slate-100
                   text-white rounded-xl font-medium transition-colors">
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        {submitting ? 'Submitting...' : 'Submit Document'}
      </button>

      <footer className="text-center mt-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">
          SECURED VIA AES-256-GCM
        </p>
      </footer>
    </form>
  )
<<<<<<< HEAD
}
=======
}


>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
