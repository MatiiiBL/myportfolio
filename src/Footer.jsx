import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <h3 className="footer-title">Matias's Portfolio</h3>
          <p className="footer-subtitle">
            Software Engineer<br />
            Designing Backend and Frontend Services
          </p>
          <a href="mailto:mcb2324@columbia.edu" className="footer-email">
            mcb2324@columbia.edu
          </a>
        </div>
        
        <div className="footer-right">
          <div className="footer-links">
            <div className="footer-column">
              <Link to="/projects" className="footer-link">Work</Link>
              <Link to="/about" className="footer-link">About</Link>
              <a href="#contact" className="footer-link">Contact me</a>
            </div>
            <div className="footer-column">
              <a href="https://www.linkedin.com/in/matias-blanco-uy/" target="_blank" rel="noopener noreferrer" className="footer-link">LinkedIn</a>
              <a href="https://github.com/MatiiiBL" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
            </div>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p className="footer-credit">© 2026 Matias Blanco Balaguer. All rights reserved.</p>
      </div>
    </footer>
  )
}
