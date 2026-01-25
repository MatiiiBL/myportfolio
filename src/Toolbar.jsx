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
      <Link to="/" className="toolbar-logo">Matias's Portfolio</Link>
      <ul className="toolbar-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/projects">Work</Link></li>
        <li>
          <button className="btn-contact" onClick={() => navigate('/contact')}>
            ✦ Get in touch
          </button>
        </li>
      </ul>
    </nav>
  )
}