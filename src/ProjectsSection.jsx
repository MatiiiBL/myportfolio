import { Link } from 'react-router-dom'
import './ProjectsSection.css'
import ScrollReveal from './components/ScrollReveal.jsx'
import project1Image from './assets/Project1.png'
import project2Image from './assets/Project2.png'
import project3Image from './assets/Project3.png'
import project4Image from './assets/Project4.png'

export default function ProjectsSection() {
  const projects = [
    {
      tag: "END_TO_END",
      title: "Making Student Life Easier With Organized Schedules and Assignments App",
      description: "Cross-platform mobile app built on a React Native client backed by a Node.js/Express REST API. Designed normalized MongoDB schemas for courses, assignments, and deadlines, with token-based auth, optimistic UI updates, and push-notification reminders for upcoming due dates.",
      stack: ["React Native", "Node.js", "MongoDB", "REST"],
      imagePosition: "left",
      image: project1Image
    },
    {
      tag: "END_TO_END",
      title: "Building an Online Social Media Application for Travelers",
      description: "Social platform with a component-driven React frontend and a Python service layer over PostgreSQL. Modeled relational data for users, posts, and events, exposed paginated feed endpoints, and integrated an ML recommendation pipeline that ranks content and surfaces personalized trip suggestions in real time.",
      stack: ["React", "Python", "AI/ML", "PostgreSQL"],
      imagePosition: "right",
      image: project2Image
    },
    {
      tag: "RESPONSIVE_WEB",
      title: "Building an Online eLearning Platform for Tech Students",
      description: "Responsive eLearning SPA built with React on a Vite toolchain, consuming a REST API for courses and lesson content. Implemented client-side routing, reusable UI components, and progress tracking with a mobile-first, accessible layout and lazy-loaded media to keep load times low.",
      stack: ["React", "Vite", "REST API", "CSS"],
      imagePosition: "left",
      image: project3Image
    },
    {
      tag: "FEATURE_BUILD",
      title: "Kaiden Team: Helping Businesses Stay Secure and Thrive Safely Online",
      description: "Shipped a feature into a cyber-hygiene product: built validated, accessible form flows in JavaScript and wired them to backend service endpoints. Added client- and server-side input validation, error handling, and sanitization to harden submissions and reliably route data into live operations.",
      stack: ["JavaScript", "Forms", "Backend", "Security"],
      imagePosition: "right",
      image: project4Image
    }
  ]

  return (
    <section id="projects-section" className="projects-section">
      <div className="projects-section-content">
        <ScrollReveal animation="fade-up" duration={0.6}>
          <div className="section-header">
            <p className="section-eyebrow">
              <span className="prompt">~/projects</span>
              <span className="sep"> $ </span>
              <span className="cmd">ls -la --sort=impact</span>
            </p>
            <h2 className="section-heading">Selected Builds</h2>
            <p className="section-sub">
              Things I&apos;ve designed, engineered, and shipped — frontend to backend.
            </p>
          </div>
        </ScrollReveal>

        {projects.map((project, index) => (
          <ScrollReveal
            key={index}
            animation={project.imagePosition === 'left' ? 'fade-right' : 'fade-left'}
            delay={index * 0.1}
            duration={0.8}
          >
            <div
              className={`project-card ${project.imagePosition === 'right' ? 'reverse' : ''}`}
            >
              <ScrollReveal
                animation={project.imagePosition === 'left' ? 'fade-right' : 'fade-left'}
                delay={0.2}
                duration={0.7}
              >
                <div className="project-image">
                  {project.image ? (
                    <img src={project.image} alt={project.title} className="project-img" />
                  ) : (
                    <div className="image-placeholder">
                      <div className="placeholder-text">Project Image</div>
                    </div>
                  )}
                </div>
              </ScrollReveal>

              <div className="project-content">
                <ScrollReveal animation="fade-up" delay={0.1} duration={0.5}>
                  <div className="project-meta">
                    <span className="project-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="project-tag">{project.tag}</span>
                  </div>
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.2} duration={0.6}>
                  <h2 className="project-title">{project.title}</h2>
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.3} duration={0.6}>
                  <p className="project-description">{project.description}</p>
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.35} duration={0.6}>
                  <div className="project-stack">
                    {project.stack.map((tech) => (
                      <span className="tech-badge" key={tech}>{tech}</span>
                    ))}
                  </div>
                </ScrollReveal>
                <ScrollReveal animation="scale-up" delay={0.4} duration={0.5}>
                  <Link to="/contact" className="project-link">
                    Request a walkthrough
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </Link>
                </ScrollReveal>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
