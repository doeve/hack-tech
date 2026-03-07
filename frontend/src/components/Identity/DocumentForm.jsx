import { useState } from 'react'
import { useStore } from '../../store'
import { submitDocument } from '../../api/client'

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
      const { data } = await submitDocument(form)
      setDocumentId(data.document_id)
      if (onComplete) onComplete(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit document')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `w-full px-3 py-2 bg-slate-700 border border-slate-600
    rounded-lg text-sm text-white placeholder-slate-400
    focus:outline-none focus:ring-2 focus:ring-blue-500/50`

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Document Type</label>
        <select name="document_type" value={form.document_type}
          onChange={handleChange} className={inputClass}>
          <option value="passport">Passport</option>
          <option value="national_id">National ID</option>
          <option value="residence_permit">Residence Permit</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Document Number</label>
        <input name="document_number" value={form.document_number}
          onChange={handleChange} placeholder="P123456789" className={inputClass} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Surname</label>
          <input name="surname" value={form.surname}
            onChange={handleChange} placeholder="SMITH" className={inputClass} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Given Names</label>
          <input name="given_names" value={form.given_names}
            onChange={handleChange} placeholder="JOHN" className={inputClass} required />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Date of Birth</label>
        <input type="date" name="dob" value={form.dob}
          onChange={handleChange} className={inputClass} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nationality</label>
          <input name="nationality_code" value={form.nationality_code}
            onChange={handleChange} placeholder="GB" maxLength={2} className={inputClass} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Issuing Country</label>
          <input name="issuing_country" value={form.issuing_country}
            onChange={handleChange} placeholder="GB" maxLength={2} className={inputClass} required />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Expiry Date</label>
        <input type="date" name="expiry_date" value={form.expiry_date}
          onChange={handleChange} className={inputClass} required />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                   text-white rounded-xl font-medium transition-colors">
        {submitting ? 'Submitting...' : 'Submit Document'}
      </button>
    </form>
  )
}
