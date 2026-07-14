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
            <p className="page-eyebrow">
              <span className="prompt">~/projects</span>
              <span className="sep"> $ </span>
              <span className="cmd">git log --oneline</span>
            </p>
            <h1 className="projects-title">My Work</h1>
            <p className="projects-subtitle">// builds, experiments &amp; ships</p>
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
