import { Link } from 'react-router-dom'
import './ProjectsSection.css'
import ScrollReveal from './components/ScrollReveal.jsx'
import project1Image from './assets/project1.png'
import project2Image from './assets/Project2.png'
import project3Image from './assets/Project3.png'
import project4Image from './assets/project4.png'

export default function ProjectsSection() {
  const projects = [
    {
      tag: "END-TO-END APPLICATION",
      title: "Making Student Life Easier With Organized Schedules and Assignments App",
      description: "Creating a School Management app that helps students organize, manage, track, and improve their academic journey.",
      imageType: "phones",
      imagePosition: "left",
      image: project1Image
    },
    {
      tag: "END-TO-END APPLICATION",
      title: "Building an Online Social Media Application for Travelers",
      description: "Designing a responsive application that will enable travelers to share photos of their trips, chat with other fellows, and organize events to gather their communities.",
      imageType: "laptop",
      imagePosition: "right",
      image: project2Image
    },
    {
      tag: "RESPONSIVE WEBSITE",
      title: "Building an Online eLearning platform for Tech Students",
      description: "Designing a responsive eLearning website that enables students to improve their tech skills through structured courses and hands-on learning.",
      imageType: "laptop",
      imagePosition: "left",
      image: project3Image
    },
    {
      tag: "ADDING A FEATURE TO A APPLICATION",
      title: "Kaiden Team: Helping Businesses Stay Secure and Thrive Safely Online",
      description: "Enhancing website functionality by designing intuitive forms and connecting backend services to Kaiden's operations.",
      imageType: "phones",
      imagePosition: "right",
      image: project4Image
    }
  ]

  return (
    <section id="projects-section" className="projects-section">
      <div className="projects-section-content">
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
                  <span className="project-tag">{project.tag}</span>
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.2} duration={0.6}>
                  <h2 className="project-title">{project.title}</h2>
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.3} duration={0.6}>
                  <p className="project-description">{project.description}</p>
                </ScrollReveal>
                <ScrollReveal animation="scale-up" delay={0.4} duration={0.5}>
                  <Link to="/contact" className="project-link">
                    Contact Me for Details
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
