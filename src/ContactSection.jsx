import { useState } from 'react'
import './ContactSection.css'
import Footer from './Footer.jsx'

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    company: '',
    message: ''
  })
  const [errors, setErrors] = useState({})

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone) => {
    // Check if it starts with + and country code
    const phoneRegex = /^\+\d{1,3}\s?\d{6,14}$/
    return phoneRegex.test(phone.replace(/[\s-]/g, ''))
  }

  const handleContactChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, contact: value })
    
    // Real-time validation
    if (value.includes('@')) {
      if (!validateEmail(value)) {
        setErrors({ ...errors, contact: 'Please enter a valid email address' })
      } else {
        const newErrors = { ...errors }
        delete newErrors.contact
        setErrors(newErrors)
      }
    } else if (value.startsWith('+')) {
      if (!validatePhone(value)) {
        setErrors({ ...errors, contact: 'Please enter a valid phone with country code (e.g., +1 234 567 890)' })
      } else {
        const newErrors = { ...errors }
        delete newErrors.contact
        setErrors(newErrors)
      }
    }
  }

  const handleMessageChange = (e) => {
    const value = e.target.value
    const maxChars = 1000
    
    if (value.length <= maxChars) {
      setFormData({ ...formData, message: value })
      const newErrors = { ...errors }
      delete newErrors.message
      setErrors(newErrors)
    } else {
      setErrors({ ...errors, message: `Maximum ${maxChars} characters allowed` })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    // Validate contact
    if (formData.contact.includes('@')) {
      if (!validateEmail(formData.contact)) {
        newErrors.contact = 'Please enter a valid email address'
      }
    } else {
      if (!validatePhone(formData.contact)) {
        newErrors.contact = 'Please enter a valid phone with country code (e.g., +1 234 567 890)'
      }
    }

    // Validate message character count
    if (formData.message.length > 1000) {
      newErrors.message = 'Maximum 1000 characters allowed'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Submit form
    console.log('Form submitted:', formData)
    alert('Thank you! I will get back to you soon.')
  }

  const messageCharCount = formData.message.length

  return (
    <section className="contact-section">
      <div className="contact-content">
        <div className="contact-text">
          <h2 className="contact-title">Let's Talk?</h2>
          <p className="contact-description">
            I'd love to hear about you and discuss how we can 
            <span className="highlight"> work together</span>.
          </p>
          <p className="contact-subtitle">
            Let's schedule a meeting and see where to start.
          </p>
        </div>
        
        <div className="contact-form-wrapper">
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name" className="animated-label">Name</label>
              <input 
                type="text" 
                id="name" 
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name and surname"
                maxLength="50"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="contact" className="animated-label">Phone</label>
              <input 
                type="text" 
                id="contact" 
                name="contact"
                value={formData.contact}
                onChange={handleContactChange}
                placeholder="+1 234 567 890"
                maxLength="20"
                required
              />
              {errors.contact && <span className="error-message">{errors.contact}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="company" className="animated-label">Company / Organization</label>
              <input 
                type="text" 
                id="company" 
                name="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Your organization name"
                maxLength="100"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="message" className="animated-label">
                Topics of Interest 
                <span className="word-count">({messageCharCount}/1000 characters)</span>
              </label>
              <textarea 
                id="message" 
                name="message"
                rows="4"
                value={formData.message}
                onChange={handleMessageChange}
                placeholder="Briefly describe what you'd like to discuss..."
                required
              ></textarea>
              {errors.message && <span className="error-message">{errors.message}</span>}
            </div>
            
            <button type="submit" className="btn-submit">
              Let's have a coffee
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
      
      <Footer />
    </section>
  )
}
