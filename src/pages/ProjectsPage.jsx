import ProjectsSection from '../ProjectsSection.jsx'
import Toolbar from '../Toolbar.jsx'
import CursorFollower from '../CursorFollower.jsx'
import Footer from '../Footer.jsx'
import '../App.css'
import './ProjectsPage.css'

export default function ProjectsPage() {
  return (
    <>
      <CursorFollower />
      <Toolbar />
      <div style={{ paddingTop: '80px', minHeight: '100vh', background: '#f5f5f5' }}>
        <ProjectsSection />
        <div className="projects-footer-section">
          <Footer />
        </div>
      </div>
    </>
  )
}
