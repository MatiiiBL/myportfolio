import './Toolbar.css'

export default function Toolbar() {
  return (
    <nav className="toolbar">
  <div className="toolbar-logo">Matias' Portfolio</div>
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