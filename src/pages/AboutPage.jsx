import Toolbar from '../Toolbar.jsx'
import CursorFollower from '../CursorFollower.jsx'
import Footer from '../Footer.jsx'
import './AboutPage.css'

export default function AboutPage() {
  return (
    <>
      <CursorFollower />
      <Toolbar />
      <div className="about-page">
        <section className="about-hero">
          <div className="about-hero-content">
            <h1 className="about-title">About Me</h1>
            <p className="about-subtitle">Software Engineer & Creative Problem Solver</p>
          </div>
          <div className="scroll-indicator">
            <p>SCROLL</p>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
          </div>
        </section>

        <section className="about-content-section">
          <div className="about-container">
            <div className="about-grid">
              <div className="about-card full-width">
                <h2 className="card-title">My Story</h2>
                <p className="card-text">
                  I'm a passionate Student at Columbia University studying CS focused on Software Engineering and ML. 
                  I have a strong background in frontend and backend development, and I really like eveything related to CS.
                  My journey in this field started as a hobby, but it now turned into the career I am most passionate about.
                  I really look forward to working with new and impactful ideas!
                </p>
                <p className="card-text">
                  When I'm not coding or exploring new technologies (just for fun!), you'll find me swimming, playing soccer with friends, 
                  or sharing some mates around (a tasty beverage from Uruguay, my country of origin!). I believe that learing is something I will do forever, 
                  so while on it, I also think that building friendships that will last a lifetime is equally important :)
                </p>
              </div>

              <div className="about-card">
                <h2 className="card-title">Skills & Expertise</h2>
                <div className="skills-grid">
                  <div className="skill-item">
                    <h3>Frontend Development</h3>
                    <p>React, JavaScript, CSS, HTML</p>
                  </div>
                  <div className="skill-item">
                    <h3>Backend Development</h3>
                    <p>Node.js, Python, Java, C#, Dart, REST APIs</p>
                  </div>
                  <div className="skill-item">
                    <h3>Tools & Technologies</h3>
                    <p>Git, Docker, Azure, MongoDB, PostgreSQL</p>
                  </div>
                  <div className="skill-item">
                    <h3>Design & UI/UX</h3>
                    <p>Figma, User-centered design, Responsive layouts</p>
                  </div>
                </div>
              </div>

              <div className="about-card">
                <h2 className="card-title">Education & Achievements</h2>
                <div className="achievement-item">
                  <h3>Bachelor's in Computer Science</h3>
                  <p>Columbia University, Class of 2029</p>
                </div>
                <div className="achievement-item">
                  <h3>Intermediate Machine Learning</h3>
                  <p>Kaggle, 2024</p>
                </div>
                <div className="achievement-item">
                  <h3>Introduction to data science</h3>
                  <p>Santander Open Academy, 2024</p>
                </div>
                <div className="achievement-item">
                  <h3>Introduction to Machine Learning</h3>
                  <p>Kaggle, 2024</p>
                </div>
                <div className="achievement-item">
                  <h3>Scrum Fundamentals Certified</h3>
                  <p>ScrumStudy, 2024</p>
                </div>
                <div className="achievement-item">
                  <h3>Cybersecurity Essentials</h3>
                  <p>Cisco, 2023</p>
                </div>
              </div>

              <div className="about-card offset-up">
                <h2 className="card-title">Experience</h2>
                <div className="experience-item">
                  <h3>Software Developer</h3>
                  <p className="company">Kaiden Team (Uruguay, remote)</p>
                  <p className="duration">December 2025</p>
                  <p className="description">
                    Contributed to the design of a startup's website focused on helping businesses secure their work environments and improve cyber-hygiene awareness.
                  </p>
                </div>
                <div className="experience-item">
                  <h3>Software Developer</h3>
                  <p className="company">Ad Astra (Uruguay)</p>
                  <p className="duration">March 2024 - December 2024</p>
                  <p className="description">
                    Worked in a startup dedicated to designing an innovative social media platform for travelers, implementing AI to enhance and personalize the user experience.
                  </p>
                </div>
                <div className="experience-item">
                  <h3>IT Infrastructure Analyst</h3>
                  <p className="company">Willin By Zonamerica (Uruguay)</p>
                  <p className="duration">March 2025 - August 2025</p>
                  <p className="description">
                    I was part of a team responsible for the operation, maintenance, and scaling of the IT infrastructure for Uruguay's largest free-trade zone.
                  </p>
                </div>
                <div className="experience-item">
                  <h3>IT Support Specialist Intern</h3>
                  <p className="company">National Administration of Public Education (Uruguay)</p>
                  <p className="duration"> July 2023 - January 2025</p>
                  <p className="description">
                    My first hands on experience in the world of IT Support. I was responsible for maintaining the overall infrastructure and help other departaments
                    with their IT operations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="about-footer-section">
          <Footer />
        </div>
      </div>
    </>
  )
}
