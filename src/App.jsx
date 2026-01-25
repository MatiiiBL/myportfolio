import './App.css'
import Toolbar from './Toolbar.jsx'
import ProjectsSection from './ProjectsSection.jsx'
import ContactSection from './ContactSection.jsx'
import CursorFollower from './CursorFollower.jsx'

function App() {
  const scrollToProjects = () => {
    document.getElementById('projects-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <CursorFollower />
      <Toolbar />
      <main className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">I'm Matías.</h1>
          <p className="hero-subtitle">Welcome.</p>
          <p className="hero-description">
            Designing and engineering digital experiences that people can truly feel and enjoy.
          </p>
          <div className="hero-buttons">
            <a href="#/contact" className="btn-hero btn-contact-hero">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M22 7l-10 7L2 7"/>
              </svg>
              Contact
            </a>
            <button className="btn-hero btn-explore" onClick={scrollToProjects}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 9l-7 7-7-7"/>
              </svg>
              Explore
            </button>
          </div>
        </div>
        <div className="scroll-indicator">
          <p>SCROLL</p>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </main>
      <ProjectsSection />
      <ContactSection />
    </>
  )
}

export default App
