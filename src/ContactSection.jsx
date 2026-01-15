import './ContactSection.css'

export default function ContactSection() {
  return (
    <section className="contact-section">
      <div className="contact-content">
        <div className="contact-text">
          <h2 className="contact-title">Let's Talk?</h2>
          <p className="contact-description">
            I'd love to hear about your organization and discuss how we can 
            <span className="highlight"> strengthen your digital capabilities</span>.
          </p>
          <p className="contact-subtitle">
            Let's schedule a meeting and see where to start.
          </p>
        </div>
        
        <div className="contact-form-wrapper">
          <form className="contact-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input 
                type="text" 
                id="name" 
                name="name"
                placeholder="Your name and surname"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email / Phone</label>
              <input 
                type="text" 
                id="email" 
                name="email"
                placeholder="your@email.com / +1 234 567 890"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="company">Company / Organization</label>
              <input 
                type="text" 
                id="company" 
                name="company"
                placeholder="Your organization name"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="message">Topics of Interest</label>
              <textarea 
                id="message" 
                name="message"
                rows="4"
                placeholder="Tell us briefly what you'd like to discuss..."
                required
              ></textarea>
            </div>
            
            <button type="submit" className="btn-submit">
              ☕ Let's have a coffee
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
