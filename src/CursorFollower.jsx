import { useEffect, useState } from 'react'
import './CursorFollower.css'

export default function CursorFollower() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isClicking, setIsClicking] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    const handleMouseDown = () => {
      setIsClicking(true)
    }

    const handleMouseUp = () => {
      setTimeout(() => setIsClicking(false), 400)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <>
      <div
        className="cursor-follower"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      />
      {isClicking && (
        <div
          className="cursor-ripple"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        />
      )}
    </>
  )
}
