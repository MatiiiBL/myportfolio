import { useScrollReveal } from '../hooks/useScrollReveal'
import './ScrollReveal.css'

export default function ScrollReveal({ 
  children, 
  animation = 'fade-up', 
  delay = 0,
  duration = 0.8,
  threshold = 0.1,
  className = ''
}) {
  const [ref, isVisible] = useScrollReveal({ threshold })

  const style = {
    transitionDelay: `${delay}s`,
    transitionDuration: `${duration}s`,
  }

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${animation} ${isVisible ? 'visible' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
