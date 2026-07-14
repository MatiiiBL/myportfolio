import Toolbar from '../Toolbar.jsx'
import CursorFollower from '../CursorFollower.jsx'
import ContactSection from '../ContactSection.jsx'
import './ContactPage.css'

export default function ContactPage() {
  return (
    <>
      <CursorFollower />
      <Toolbar />
      <div className="contact-page">
        <section className="contact-hero">
          <div className="contact-hero-content">
            <p className="page-eyebrow">
              <span className="prompt">~</span>
              <span className="sep"> $ </span>
              <span className="cmd">./connect</span>
            </p>
            <h1 className="contact-page-title">Get In Touch</h1>
            <p className="contact-page-subtitle">// let&apos;s build something together</p>
          </div>
        </section>
        <ContactSection />
      </div>
    </>
  )
}
