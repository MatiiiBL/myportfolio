import ProjectsSection from '../ProjectsSection.jsx'
import Toolbar from '../Toolbar.jsx'
import CursorFollower from '../CursorFollower.jsx'
import Footer from '../Footer.jsx'
import ScrollReveal from '../components/ScrollReveal.jsx'
import '../App.css'
import './ProjectsPage.css'

export default function ProjectsPage() {
  return (
    <>
      <CursorFollower />
      <Toolbar />
      <div className="projects-page">
        <section className="projects-hero">
          <div className="projects-hero-content">
            <h1 className="projects-title">My Work</h1>
            <p className="projects-subtitle">Projects & Creations</p>
          </div>
          <div className="scroll-indicator">
            <p>SCROLL</p>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
        </section>
        <ProjectsSection />
        <ScrollReveal animation="fade-up" delay={0.1} duration={0.8}>
          <div className="projects-footer-section">
            <Footer />
          </div>
        </ScrollReveal>
      </div>
    </>
  )
}
