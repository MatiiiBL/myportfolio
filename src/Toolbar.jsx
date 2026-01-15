import { useEffect, useState } from 'react'
import './Toolbar.css'

export default function Toolbar() {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

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
      <div className="toolbar-logo">Matias's Portfolio</div>
      <ul className="toolbar-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#work">Work</a></li>
        <li><a href="#resume">Resume</a></li>
        <li>
          <button className="btn-contact">
            ✦ Get in touch
          </button>
        </li>
      </ul>
    </nav>
  )
}