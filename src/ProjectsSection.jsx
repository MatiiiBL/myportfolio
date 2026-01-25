import './ProjectsSection.css'
import project2Image from './assets/Project2.png'
import project3Image from './assets/Project3.png'
import project4Image from './assets/Project4.png'
export default function ProjectsSection() {
  const projects = [
    {
      tag: "END-TO-END APPLICATION",
      title: "Making Student Life Easier With Organized Schedules and Assignments App",
      description: "Creating a School Management app that helps students organize, manage, track, and improve their academic journey.",
      imageType: "phones",
      imagePosition: "left",
      //image: 
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
    <section className="projects-section">
      <div className="projects-section-content">
        {projects.map((project, index) => (
          <div 
            key={index} 
            className={`project-card ${project.imagePosition === 'right' ? 'reverse' : ''}`}
          >
            <div className="project-image">
              {project.image ? (
                <img src={project.image} alt={project.title} className="project-img" />
              ) : (
                <div className="image-placeholder">
                  {/* Placeholder for project images */}
                  <div className="placeholder-text">Project Image</div>
                </div>
              )}
            </div>
            
            <div className="project-content">
              <span className="project-tag">{project.tag}</span>
              <h2 className="project-title">{project.title}</h2>
              <p className="project-description">{project.description}</p>
              <a href="#" className="project-link">
                View Case Study
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
