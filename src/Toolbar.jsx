import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Toolbar.css'

export default function Toolbar() {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const heroHeight = window.innerHeight

      if (currentScrollY < 100) {
        // Always show at the very top
        setIsVisible(true)
      } else if (currentScrollY > heroHeight * 0.8) {
        // Past the hero section - hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY) {
          setIsVisible(false) // Scrolling down
        } else {
          setIsVisible(true) // Scrolling up
        }
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <nav className={`toolbar ${!isVisible ? 'toolbar-hidden' : ''}`}>
      <Link to="/" className="toolbar-logo">
        <span className="logo-prompt">~/</span>matias<span className="logo-caret">_</span>
      </Link>
      <ul className="toolbar-links">
        <li><Link to="/">home</Link></li>
        <li><Link to="/about">about</Link></li>
        <li><Link to="/projects">work</Link></li>
        <li>
          <button className="btn-contact" onClick={() => navigate('/contact')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 17l6-6-6-6M12 19h8"/>
            </svg>
            ./connect
          </button>
        </li>
      </ul>
    </nav>
  )
}