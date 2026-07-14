import './App.css'
import Toolbar from './Toolbar.jsx'
import ProjectsSection from './ProjectsSection.jsx'
import ContactSection from './ContactSection.jsx'
import CursorFollower from './CursorFollower.jsx'

const STACK = ['React', 'JavaScript', 'Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'Docker', 'Azure']

const STATS = [
  { value: '4+', label: 'projects shipped' },
  { value: '6+', label: 'languages' },
  { value: '24/7', label: 'uptime' },
]

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

          <div className="terminal" role="img" aria-label="Terminal window introducing Matías Blanco, full-stack engineer">
            <div className="terminal-bar">
              <span className="terminal-dots" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
              <span className="terminal-file">matias@portfolio: ~/whoami</span>
            </div>
            <div className="terminal-body">
              <p className="terminal-line">
                <span className="prompt">matias@dev</span>
                <span className="sep">:</span>
                <span className="path">~</span>
                <span className="sep">$</span>
                <span className="cmd"> whoami</span>
              </p>
              <h1 className="hero-title">Matías Blanco</h1>
              <p className="hero-role">
                <span className="role-key">role</span>
                <span className="role-eq">=</span>
                <span className="role-val">"Full-Stack Engineer · ML &amp; Systems"</span>
              </p>
              <p className="hero-description">
                CS student <span className="kw">@Columbia</span>, engineering performant,
                scalable products end-to-end. From <span className="kw">React</span> frontends to
                <span className="kw"> Python</span> backends and <span className="kw">ML</span> pipelines.
          
              </p>

              <p className="terminal-line muted-line">
                <span className="prompt">matias@dev</span>
                <span className="sep">:</span>
                <span className="path">~</span>
                <span className="sep">$</span>
                <span className="cmd"> cat stack.json</span>
                <span className="caret" aria-hidden="true"></span>
              </p>
              <div className="stack-row" aria-label="Tech stack">
                {STACK.map((tech) => (
                  <span className="stack-chip" key={tech}>{tech}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-buttons">
            <button className="btn-hero btn-primary" onClick={scrollToProjects}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 17l6-6-6-6M12 19h8"/>
              </svg>
              ./view-projects
            </button>
            <a href="#/contact" className="btn-hero btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M22 7l-10 7L2 7"/>
              </svg>
              git connect
            </a>
          </div>

          <dl className="hero-stats">
            {STATS.map((s) => (
              <div className="stat" key={s.label}>
                <dt className="stat-value">{s.value}</dt>
                <dd className="stat-label">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
      <ProjectsSection />
      <ContactSection />
    </>
  )
}

export default App
